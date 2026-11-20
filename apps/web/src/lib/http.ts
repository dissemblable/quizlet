import { ApiError } from '@quizlet/shared'

const SESSION_EXPIRED_MESSAGE = 'Votre session a expiré. Reconnectez-vous pour continuer.'

/**
 * fetch utilisé par le client RPC. Derrière nginx, une session expirée se traduit par un 302 vers
 * le portail Authelia : on ne suit jamais la redirection (elle échouerait en CORS) et on la signale.
 */
export const apiFetch: typeof fetch = async (input, init) => {
  let response: Response
  try {
    response = await fetch(input, { ...init, credentials: 'same-origin', redirect: 'manual' })
  } catch {
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      'Impossible de joindre le serveur. Vérifiez votre connexion.',
    )
  }
  if (response.type === 'opaqueredirect' || (response.status >= 300 && response.status < 400)) {
    throw new ApiError(401, 'SESSION_EXPIRED', SESSION_EXPIRED_MESSAGE)
  }
  return response
}
