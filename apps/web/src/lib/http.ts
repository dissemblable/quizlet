import { type ErrorCode, isApiErrorBody } from '@quizlet/shared'

export type ClientErrorCode = ErrorCode | 'SESSION_EXPIRED' | 'NETWORK_ERROR' | 'UNKNOWN'

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ClientErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
  }

  /** La session Authelia a expiré (ou l'identité n'est plus transmise) : il faut se reconnecter. */
  get needsLogin(): boolean {
    return this.code === 'SESSION_EXPIRED' || this.code === 'UNAUTHENTICATED'
  }
}

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

function defaultMessage(status: number): string {
  if (status === 404) return 'Ressource introuvable.'
  if (status === 403) return "Vous n'avez pas accès à cette ressource."
  if (status >= 500) return 'Le serveur a rencontré une erreur. Réessayez dans un instant.'
  return 'La requête a échoué.'
}

export async function toApiError(response: { status: number; json(): Promise<unknown> }) {
  let body: unknown = null
  try {
    body = await response.json()
  } catch {
    // Corps absent ou non JSON (page d'erreur d'un proxy, par exemple).
  }
  if (isApiErrorBody(body)) {
    const { code, message, details } = body.error
    return new ApiError(response.status, code, message, details)
  }
  return new ApiError(response.status, 'UNKNOWN', defaultMessage(response.status))
}

interface JsonResponse<T> {
  ok: boolean
  status: number
  json(): Promise<T>
}

/** Attend une réponse du client RPC : renvoie son JSON typé, ou lève une ApiError lisible. */
export async function unwrap<T>(request: Promise<JsonResponse<T>>): Promise<T> {
  const response = await request
  if (!response.ok) throw await toApiError(response)
  if (response.status === 204) return undefined as T
  return response.json()
}

/** Message affichable pour n'importe quelle erreur. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message
  return 'Une erreur inattendue est survenue.'
}
