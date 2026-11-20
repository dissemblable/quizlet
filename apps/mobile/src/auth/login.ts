import type { AppConfig } from '@/config'
import { parseCallbackUrl } from './callback-url'
import { DISCOVERY_NETWORK_MESSAGE, type Endpoints } from './endpoints'
import {
  AuthFlowError,
  type FetchLike,
  NetworkFailure,
  OIDC_TIMEOUT_MS,
  postForm,
  readJson,
  stripTrailingSlashes,
} from './http'
import { createObservable, type Observable } from './observable'
import { buildAuthorizationUrl, pushAuthorizationRequest } from './par'
import { createPkce, createState, type RandomBytes, type Sha256, safeEqual } from './pkce'
import type { Session } from './session'
import type { AuthStore } from './store'
import { type Tokens, tokensFromResponse } from './tokens'
import type { CallbackParams, LoginResult } from './types'

export const MESSAGES = {
  alreadyOpen: "Une connexion est déjà en cours. Revenez à l'application puis réessayez.",
  browser: "Impossible d'ouvrir le navigateur de connexion.",
  expired: 'La connexion a expiré. Réessayez.',
  invalid: 'La réponse de connexion est invalide. Réessayez.',
  stateMismatch: 'La réponse de connexion ne correspond à aucune connexion en cours. Réessayez.',
  issuer: "La réponse de connexion provient d'un serveur inattendu.",
  denied: 'La connexion a été refusée.',
  codeRejected: 'Le code de connexion est invalide ou a expiré. Réessayez.',
  exchange: "L'échange du code de connexion a échoué. Réessayez.",
  tokens: "La réponse du serveur d'authentification est invalide.",
  network: DISCOVERY_NETWORK_MESSAGE,
  unknown: 'La connexion a échoué. Réessayez.',
} as const

/** Attente d'un callback après `dismiss`/`cancel` : `AppState 'active'` précède souvent l'évènement `url`. */
export const CALLBACK_GRACE_MS = 2000

/** `idle` : rien en cours ; `opening` : préparation et Custom Tab ouvert ; `exchanging` : échange du code. */
export type LoginPhase = 'idle' | 'opening' | 'exchanging'

/** Ce que `openAuthSessionAsync` renvoie, réduit au nécessaire. */
export type BrowserResult = { type: 'success'; url: string } | { type: string }

export interface LoginDeps {
  config: Pick<
    AppConfig,
    'clientId' | 'scope' | 'apiUrl' | 'resource' | 'redirectUri' | 'callbackUrl'
  >
  getEndpoints: () => Promise<Endpoints>
  store: AuthStore
  session: Pick<Session, 'init' | 'startSession'>
  fetch: FetchLike
  now: () => number
  random: RandomBytes
  sha256: Sha256
  openAuthSession: (url: string, callbackUrl: string) => Promise<BrowserResult>
  delay: (ms: number) => Promise<void>
  timeoutMs?: number
}

export interface Login {
  /** Parcours complet (PAR, Custom Tab, échange). Ne rejette jamais. */
  startLogin(): Promise<LoginResult>
  /** Termine la connexion depuis `quizlet://callback`. Idempotent par `state`. Ne rejette jamais. */
  completeLogin(params: CallbackParams): Promise<LoginResult>
  phase: Observable<LoginPhase>
}

const MAX_SETTLED_RESULTS = 8

/** Au plus 200 caractères, sans caractère de contrôle (texte reçu par un lien profond). */
function sanitize(text: string): string {
  let out = ''
  for (const char of text) {
    const code = char.charCodeAt(0)
    out += code < 32 || code === 127 ? ' ' : char
  }
  return out.trim().slice(0, 200)
}

function toResult(error: unknown): LoginResult {
  if (error instanceof AuthFlowError) return { kind: 'error', message: error.message }
  if (error instanceof NetworkFailure) return { kind: 'error', message: MESSAGES.network }
  return { kind: 'error', message: MESSAGES.unknown }
}

export function createLogin(deps: LoginDeps): Login {
  const { config, store, session } = deps
  const timeoutMs = deps.timeoutMs ?? OIDC_TIMEOUT_MS
  const phase = createObservable<LoginPhase>('idle')
  let starting: Promise<LoginResult> | null = null

  /**
   * Résultats par `state`, GARDÉS après le règlement : le callback arrive jusqu'à trois fois (route
   * /callback, écouteur `Linking`, résultat de `openAuthSessionAsync`), la dernière peut venir quand
   * le `pending` est déjà consommé et ne doit pas y lire « connexion expirée ».
   */
  const results = new Map<string, Promise<LoginResult>>()
  const settledOrder: string[] = []
  const waiters = new Map<string, Set<(result: Promise<LoginResult>) => void>>()

  async function exchangeCode(
    endpoints: Endpoints,
    code: string,
    verifier: string,
  ): Promise<Tokens> {
    // `redirect_uri` doit être celui de l'autorisation : l'URL https du relais, pas `quizlet://`.
    const response = await postForm(
      deps.fetch,
      endpoints.tokenEndpoint,
      {
        grant_type: 'authorization_code',
        client_id: config.clientId,
        code,
        redirect_uri: config.redirectUri,
        code_verifier: verifier,
      },
      timeoutMs,
    )
    const body = await readJson(response)
    if (response.status !== 200) {
      throw new AuthFlowError(response.status === 400 ? MESSAGES.codeRejected : MESSAGES.exchange)
    }
    const tokens = tokensFromResponse(body, deps.now())
    if (!tokens) throw new AuthFlowError(MESSAGES.tokens)
    return tokens
  }

  /** Erreur renvoyée par le relais ou le portail. Le détail n'est affiché que si le `state` est le nôtre. */
  function relayedError(params: CallbackParams, trusted: boolean): string {
    if (!trusted) return MESSAGES.invalid
    if (params.error === 'access_denied') return MESSAGES.denied
    const description = sanitize(params.error_description ?? '')
    return description ? `La connexion a échoué : ${description}` : MESSAGES.invalid
  }

  async function settle(params: CallbackParams): Promise<LoginResult> {
    try {
      await session.init()
      const pending = await store.readPending(deps.now())
      const stateMatches =
        pending !== null && params.state !== undefined && safeEqual(pending.state, params.state)

      if (params.error) {
        if (stateMatches) await store.clearPending()
        return { kind: 'error', message: relayedError(params, stateMatches) }
      }
      if (!params.code || !params.state) return { kind: 'error', message: MESSAGES.invalid }
      if (!pending) return { kind: 'error', message: MESSAGES.expired }
      // Un `state` étranger n'annule PAS la connexion en cours : le vrai callback peut encore venir.
      if (!stateMatches) return { kind: 'error', message: MESSAGES.stateMismatch }

      const endpoints = await deps.getEndpoints()
      // RFC 9207 : l'émetteur de la réponse doit être celui de la découverte (attaque de confusion).
      if (params.iss && stripTrailingSlashes(params.iss) !== endpoints.issuer) {
        await store.clearPending()
        return { kind: 'error', message: MESSAGES.issuer }
      }

      // Consommé AVANT l'échange : le code est à usage unique, le verifier ne doit servir qu'une fois.
      await store.clearPending()
      phase.set('exchanging')
      try {
        const tokens = await exchangeCode(endpoints, params.code, pending.verifier)
        await session.startSession(tokens)
      } finally {
        // Sous `startLogin`, c'est lui qui remet `idle` ; via /callback, personne d'autre ne le fait.
        if (!starting) phase.set('idle')
      }
      return { kind: 'signedIn' }
    } catch (error) {
      return toResult(error)
    }
  }

  function completeLogin(params: CallbackParams): Promise<LoginResult> {
    const state = params.state
    // Sans `state` (erreur du relais) : aucun effet de bord à dédoublonner.
    if (!state) return settle(params)
    const known = results.get(state)
    if (known) return known

    const result = settle(params)
    results.set(state, result)
    void result.then(() => {
      settledOrder.push(state)
      while (settledOrder.length > MAX_SETTLED_RESULTS) {
        const oldest = settledOrder.shift()
        if (oldest !== undefined) results.delete(oldest)
      }
    })
    for (const notify of waiters.get(state) ?? []) notify(result)
    waiters.delete(state)
    return result
  }

  /** Un callback pour `state` est-il (ou sera-t-il sous peu) en cours de traitement ? */
  function waitForCallback(state: string): Promise<LoginResult | null> {
    const known = results.get(state)
    if (known) return known
    return new Promise((resolve) => {
      let done = false
      const arrive = (result: Promise<LoginResult>) => {
        if (done) return
        done = true
        // Le délai de grâce ne décide que de l'ARRIVÉE du callback : l'échange peut durer.
        resolve(result)
      }
      const set = waiters.get(state) ?? new Set()
      set.add(arrive)
      waiters.set(state, set)
      void deps.delay(CALLBACK_GRACE_MS).then(() => {
        if (done) return
        done = true
        set.delete(arrive)
        resolve(null)
      })
    })
  }

  async function run(): Promise<LoginResult> {
    await session.init()
    const endpoints = await deps.getEndpoints()
    const { verifier, challenge } = await createPkce(deps.random, deps.sha256)
    const state = await createState(deps.random)

    // Écrit AVANT d'ouvrir : un démarrage à froid sur le callback doit retrouver le verifier.
    await store.writePending({ state, verifier, createdAt: deps.now() })
    let requestUri: string
    try {
      requestUri = await pushAuthorizationRequest(
        { fetch: deps.fetch, endpoint: endpoints.parEndpoint, timeoutMs },
        {
          clientId: config.clientId,
          scope: config.scope,
          audience: config.apiUrl,
          resource: config.resource,
          redirectUri: config.redirectUri,
          codeChallenge: challenge,
          state,
        },
      )
    } catch (error) {
      await store.clearPending().catch(() => {})
      throw error
    }

    // Tout de suite après le PAR : le `request_uri` est de courte durée.
    let browser: BrowserResult
    try {
      browser = await deps.openAuthSession(
        buildAuthorizationUrl(endpoints.authorizationEndpoint, config.clientId, requestUri),
        config.callbackUrl,
      )
    } catch (error) {
      await store.clearPending().catch(() => {})
      const alreadyOpen = error instanceof Error && /already open/i.test(error.message)
      throw new AuthFlowError(alreadyOpen ? MESSAGES.alreadyOpen : MESSAGES.browser)
    }

    // Le résultat n'est qu'un indice : /callback est le chemin canonique, `completeLogin` dédoublonne.
    if (browser.type === 'success' && 'url' in browser) {
      const params = parseCallbackUrl(browser.url, config.callbackUrl)
      if (params) return completeLogin(params)
    }
    // `dismiss` (le plus fréquent sur Android) peut précéder le callback valide.
    return (await waitForCallback(state)) ?? { kind: 'cancelled' }
  }

  function startLogin(): Promise<LoginResult> {
    if (!starting) {
      phase.set('opening')
      starting = run()
        .catch(toResult)
        .finally(() => {
          starting = null
          phase.set('idle')
        })
    }
    return starting
  }

  return { startLogin, completeLogin, phase }
}
