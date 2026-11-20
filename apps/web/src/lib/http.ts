import { ApiError, NETWORK_ERROR_MESSAGE, SESSION_EXPIRED_MESSAGE } from '@quizlet/shared'

/**
 * fetch utilisé par le client RPC. Derrière nginx, une session expirée se traduit par un 302 vers
 * le portail Authelia : on ne suit jamais la redirection (elle échouerait en CORS) et on la signale.
 */
export const apiFetch: typeof fetch = async (input, init) => {
  let response: Response
  try {
    response = await fetch(input, { ...init, credentials: 'same-origin', redirect: 'manual' })
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', NETWORK_ERROR_MESSAGE)
  }
  if (response.type === 'opaqueredirect' || (response.status >= 300 && response.status < 400)) {
    throw new ApiError(401, 'SESSION_EXPIRED', SESSION_EXPIRED_MESSAGE)
  }
  return response
}
