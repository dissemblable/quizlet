/** Codes d'erreur renvoyés par l'API, dans un corps `{ error: { code, message } }`. */
export const ERROR_CODES = [
  'UNAUTHENTICATED',
  'UNTRUSTED_PROXY',
  'CSRF_REJECTED',
  'FORBIDDEN',
  'NOT_FOUND',
  'VALIDATION_ERROR',
  'PAYLOAD_TOO_LARGE',
  'QUIZ_NOT_ENOUGH_CARDS',
  'TOO_MANY_REQUESTS',
  'AI_UNAVAILABLE',
  'INTERNAL_ERROR',
] as const

export type ErrorCode = (typeof ERROR_CODES)[number]

export interface ApiErrorBody {
  error: {
    code: ErrorCode
    /** Message en français, affichable tel quel. */
    message: string
    details?: unknown
  }
}

export function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== 'object' || value === null || !('error' in value)) return false
  const { error } = value
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string' &&
    'message' in error &&
    typeof error.message === 'string'
  )
}
