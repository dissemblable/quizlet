import type { Endpoints } from './endpoints'
import { AuthFlowError, type FetchLike, OIDC_TIMEOUT_MS, postForm, readJson } from './http'
import type { StatusStore } from './status'
import type { AuthStore } from './store'
import { type Tokens, tokensFromResponse } from './tokens'

export const STORAGE_ERROR_MESSAGE = "Impossible d'enregistrer la session sur cet appareil."

/** Attente avant le second essai d'un refresh qui a répondu 500 (Authelia : jeton mort OU panne). */
const SERVER_ERROR_RETRY_DELAY_MS = 1000
/** Une déconnexion hors ligne ne doit pas faire attendre l'utilisateur : la révocation continue sans lui. */
const REVOKE_WAIT_MS = 1500

/**
 * - `ok` : jetons valides (nouveaux, ou déjà remplacés par un autre refresh) ;
 * - `dead` : refresh refusé, la session est morte (statut `expired`, reconnexion nécessaire) ;
 * - `transient` : panne passagère (réseau, 429, 5xx) : jetons conservés, aucune bannière.
 */
export type RefreshResult =
  | { kind: 'ok'; tokens: Tokens }
  | { kind: 'dead' }
  | { kind: 'transient' }

type RefreshAttempt = RefreshResult | { kind: 'server-error' }

export interface SessionDeps {
  store: AuthStore
  status: StatusStore
  getEndpoints: () => Promise<Endpoints>
  fetch: FetchLike
  clientId: string
  now: () => number
  /** Attente injectée (aucun timer réel dans les tests). */
  delay: (ms: number) => Promise<void>
  /** Appelé APRÈS l'effacement des jetons, par `signOut()` seulement (jamais à l'expiration). */
  onSignedOut?: () => void | Promise<void>
  timeoutMs?: number
}

export interface Session {
  /** Lit le stockage et quitte `loading` (mémorisé : un seul accès au stockage). Ne rejette jamais. */
  init(): Promise<void>
  /** Jetons courants (valables après `init`). */
  getTokens(): Tokens | null
  /** Connexion réussie : enregistre les jetons PUIS passe à `signedIn`. */
  startSession(tokens: Tokens): Promise<void>
  /** Refresh partagé : `failedAccessToken` est le jeton qui vient d'échouer (ou de passer la marge). */
  refresh(failedAccessToken: string): Promise<RefreshResult>
  /** La requête relancée avec un jeton neuf a encore été refusée : session morte. */
  markExpired(failedAccessToken: string): void
  signOut(): Promise<void>
  /** Réessaie la révocation en attente (`revoke.v1`), au démarrage par exemple. */
  retryPendingRevocation(): Promise<void>
}

const noop = () => {}

export function createSession(deps: SessionDeps): Session {
  const { store, status } = deps
  const timeoutMs = deps.timeoutMs ?? OIDC_TIMEOUT_MS

  let current: Tokens | null = null
  let initPromise: Promise<void> | null = null
  let inFlight: Promise<RefreshResult> | null = null
  let signingOut: Promise<void> | null = null
  /** Change à chaque connexion et déconnexion : un refresh démarré avant ne doit pas ressusciter l'ancienne session. */
  let epoch = 0

  function init(): Promise<void> {
    if (!initPromise) {
      initPromise = (async () => {
        const tokens = await store.readTokens()
        // Une connexion par /callback peut avoir fini avant cette lecture : elle fait foi.
        if (status.get() !== 'loading') return
        current = tokens
        status.settle(tokens ? 'signedIn' : 'signedOut')
      })()
    }
    return initPromise
  }

  async function startSession(tokens: Tokens): Promise<void> {
    await init()
    epoch++
    try {
      await store.writeTokens(tokens)
    } catch {
      throw new AuthFlowError(STORAGE_ERROR_MESSAGE)
    }
    current = tokens
    status.markSignedIn()
  }

  async function attemptRefresh(refreshToken: string): Promise<RefreshAttempt> {
    let endpoints: Endpoints
    let response: Response
    try {
      endpoints = await deps.getEndpoints()
      response = await postForm(
        deps.fetch,
        endpoints.tokenEndpoint,
        { grant_type: 'refresh_token', client_id: deps.clientId, refresh_token: refreshToken },
        timeoutMs,
      )
    } catch {
      return { kind: 'transient' }
    }
    if (response.status === 200) {
      const tokens = tokensFromResponse(await readJson(response), deps.now(), refreshToken)
      return tokens ? { kind: 'ok', tokens } : { kind: 'transient' }
    }
    // Authelia répond 500 pour un refresh token révoqué ; un seul nouvel essai écarte une panne.
    if (response.status === 500) return { kind: 'server-error' }
    if (response.status === 408 || response.status === 429 || response.status >= 500) {
      return { kind: 'transient' }
    }
    // 400 `invalid_grant` et autres 4xx : refusé pour de bon.
    return { kind: 'dead' }
  }

  async function runRefresh(tokens: Tokens): Promise<RefreshResult> {
    const startEpoch = epoch
    let attempt = await attemptRefresh(tokens.refreshToken)
    if (attempt.kind === 'server-error') {
      await deps.delay(SERVER_ERROR_RETRY_DELAY_MS)
      attempt = await attemptRefresh(tokens.refreshToken)
      if (attempt.kind === 'server-error') attempt = { kind: 'dead' }
    }

    if (epoch !== startEpoch) {
      // Connexion ou déconnexion pendant le refresh : on jette ce résultat, et le refresh token
      // neuf (qu'on ne gardera pas) est révoqué pour ne pas laisser de session fantôme.
      if (attempt.kind === 'ok') void revokeAndForget(attempt.tokens.refreshToken)
      return { kind: 'dead' }
    }
    if (attempt.kind === 'ok') {
      current = attempt.tokens
      // Écrit AVANT de résoudre : le refresh token précédent est consommé côté serveur, le perdre
      // (app tuée juste après) forcerait une reconnexion. En cas d'échec d'écriture, la session
      // continue en mémoire seulement.
      await store.writeTokens(attempt.tokens).catch(noop)
      return attempt
    }
    if (attempt.kind === 'dead') {
      current = null
      await store.clearTokens().catch(noop)
      status.markExpired()
    }
    return attempt.kind === 'dead' ? { kind: 'dead' } : { kind: 'transient' }
  }

  function refresh(failedAccessToken: string): Promise<RefreshResult> {
    const tokens = current
    if (!tokens) return Promise.resolve({ kind: 'dead' })
    // Un autre appel a déjà remplacé le jeton : rafraîchir encore consommerait le nouveau refresh
    // token, et rejouer un refresh token consommé révoque toute la famille.
    if (tokens.accessToken !== failedAccessToken) return Promise.resolve({ kind: 'ok', tokens })
    if (!inFlight) {
      inFlight = runRefresh(tokens).finally(() => {
        inFlight = null
      })
    }
    return inFlight
  }

  function markExpired(failedAccessToken: string): void {
    if (current?.accessToken !== failedAccessToken) return
    current = null
    void store.clearTokens().catch(noop)
    status.markExpired()
  }

  /** `true` : plus rien à faire (révoqué, ou refusé définitivement) ; `false` : à réessayer. */
  async function revokeToken(token: string): Promise<boolean> {
    try {
      const { revocationEndpoint } = await deps.getEndpoints()
      if (!revocationEndpoint) return true
      const response = await postForm(
        deps.fetch,
        revocationEndpoint,
        { client_id: deps.clientId, token },
        timeoutMs,
      )
      if (response.status === 200) return true
      const retryable = response.status === 408 || response.status === 429 || response.status >= 500
      return !retryable
    } catch {
      return false
    }
  }

  async function revokeAndForget(token: string): Promise<void> {
    if (!(await revokeToken(token))) return
    if ((await store.readRevoke()) === token) await store.clearRevoke().catch(noop)
  }

  async function runSignOut(): Promise<void> {
    await init()
    epoch++
    const refreshToken = current?.refreshToken
    current = null
    let revocation: Promise<void> | null = null
    if (refreshToken) {
      // Le jeton est noté AVANT l'appel : si l'app est tuée en route, la révocation reprendra.
      await store.writeRevoke(refreshToken).catch(noop)
      revocation = revokeAndForget(refreshToken)
    }
    await store.clearTokens().catch(noop)
    await store.clearPending().catch(noop)
    if (revocation) await Promise.race([revocation, deps.delay(REVOKE_WAIT_MS)])
    try {
      await deps.onSignedOut?.()
    } catch {
      // La purge locale ne doit pas empêcher la déconnexion.
    }
    status.markSignedOut()
  }

  function signOut(): Promise<void> {
    if (!signingOut) {
      signingOut = runSignOut().finally(() => {
        signingOut = null
      })
    }
    return signingOut
  }

  async function retryPendingRevocation(): Promise<void> {
    const token = await store.readRevoke()
    if (token) await revokeAndForget(token)
  }

  return {
    init,
    getTokens: () => current,
    startSession,
    refresh,
    markExpired,
    signOut,
    retryPendingRevocation,
  }
}
