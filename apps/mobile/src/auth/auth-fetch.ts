import { ApiError, NETWORK_ERROR_MESSAGE, SESSION_EXPIRED_MESSAGE } from '@quizlet/shared'
import { OIDC_TIMEOUT_MS } from './http'
import type { Session } from './session'
import type { StatusStore } from './status'
import { isAccessExpired } from './tokens'

export const REQUEST_TIMEOUT_MS = OIDC_TIMEOUT_MS

export interface AuthFetchDeps {
  session: Session
  status: StatusStore
  fetch: typeof fetch
  now: () => number
  timeoutMs?: number
}

const sessionExpired = () => new ApiError(401, 'SESSION_EXPIRED', SESSION_EXPIRED_MESSAGE)
const networkError = () => new ApiError(0, 'NETWORK_ERROR', NETWORK_ERROR_MESSAGE)

/**
 * Le nginx du stack transforme le 401 d'Authelia en 302 (`error_page 401 =302`) : avec
 * `redirect: 'manual'`, 3xx et 401 veulent dire « jeton refusé » (docs/app-mobile.md, « Expiration »).
 */
function isAuthFailure(response: Response): boolean {
  // 304 : réponse à une requête conditionnelle, pas un refus.
  return (
    response.status === 401 ||
    (response.status >= 300 && response.status < 400 && response.status !== 304)
  )
}

/**
 * `fetch` authentifié (passé à `hc<AppType>`) : ajoute le Bearer, ne suit jamais les redirections,
 * borne la durée, et sur 302/401 fait UN refresh partagé puis UNE relance. Les pannes réseau
 * (y compris un refresh en panne passagère) sont des `NETWORK_ERROR`, jamais « session expirée ».
 */
export function createAuthFetch(deps: AuthFetchDeps): typeof fetch {
  const { session, status } = deps
  const timeoutMs = deps.timeoutMs ?? REQUEST_TIMEOUT_MS

  async function send(
    input: Parameters<typeof fetch>[0],
    init: RequestInit | undefined,
    token: string,
  ): Promise<Response> {
    const isRequest = typeof input === 'object' && 'clone' in input
    const headers = new Headers(init?.headers ?? (isRequest ? input.headers : undefined))
    headers.set('Authorization', `Bearer ${token}`)

    const controller = new AbortController()
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, timeoutMs)
    const callerSignal = init?.signal
    const abortWithCaller = () => controller.abort()
    if (callerSignal?.aborted) controller.abort()
    else callerSignal?.addEventListener('abort', abortWithCaller)

    try {
      // Un corps de `Request` ne se lit qu'une fois : chaque tentative part d'un clone.
      return await deps.fetch(isRequest ? input.clone() : input, {
        ...init,
        headers,
        redirect: 'manual',
        signal: controller.signal,
      })
    } catch (error) {
      // Annulation voulue par l'appelant (TanStack Query) : on la lui renvoie telle quelle.
      if (callerSignal?.aborted && !timedOut) throw error
      throw networkError()
    } finally {
      clearTimeout(timer)
      callerSignal?.removeEventListener('abort', abortWithCaller)
    }
  }

  return async (input, init) => {
    await session.init()
    if (status.get() === 'expired') throw sessionExpired()
    let tokens = session.getTokens()
    // Pas de jeton : déconnecté (ou déconnexion en cours). Ne touche pas au statut.
    if (!tokens) throw sessionExpired()

    if (isAccessExpired(tokens, deps.now())) {
      const refreshed = await session.refresh(tokens.accessToken)
      if (refreshed.kind === 'dead') throw sessionExpired()
      // `transient` : on tente quand même avec le jeton courant (il peut encore valoir quelques secondes).
      if (refreshed.kind === 'ok') tokens = refreshed.tokens
    }

    const first = await send(input, init, tokens.accessToken)
    if (!isAuthFailure(first)) return first

    const refreshed = await session.refresh(tokens.accessToken)
    if (refreshed.kind === 'dead') throw sessionExpired()
    if (refreshed.kind === 'transient') throw networkError()

    const second = await send(input, init, refreshed.tokens.accessToken)
    if (!isAuthFailure(second)) return second
    // Un jeton neuf refusé aussi : relancer n'y changerait rien (pas de boucle).
    session.markExpired(refreshed.tokens.accessToken)
    throw sessionExpired()
  }
}
