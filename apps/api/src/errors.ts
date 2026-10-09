import type { ApiErrorBody, ErrorCode } from '@quizlet/shared'
import type { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type { ContentfulStatusCode } from 'hono/utils/http-status'

/** Erreur métier : convertie en réponse `{ error: { code, message } }` par `handleError`. */
export class ApiError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export function errorBody(code: ErrorCode, message: string, details?: unknown): ApiErrorBody {
  return { error: details === undefined ? { code, message } : { code, message, details } }
}

export const notFound = (message = 'Ressource introuvable.') =>
  new ApiError(404, 'NOT_FOUND', message)

export const forbidden = (message = "Vous n'avez pas le droit d'effectuer cette action.") =>
  new ApiError(403, 'FORBIDDEN', message)

export function handleError(error: Error, c: Context) {
  if (error instanceof ApiError) {
    return c.json(errorBody(error.code, error.message, error.details), error.status)
  }
  if (error instanceof HTTPException) {
    const status = error.status
    const code: ErrorCode =
      status === 404 ? 'NOT_FOUND' : status === 413 ? 'PAYLOAD_TOO_LARGE' : 'VALIDATION_ERROR'
    return c.json(errorBody(code, error.message || 'Requête invalide.'), status)
  }
  console.error(error)
  return c.json(errorBody('INTERNAL_ERROR', 'Erreur interne du serveur.'), 500)
}
