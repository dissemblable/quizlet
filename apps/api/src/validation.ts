import { zValidator } from '@hono/zod-validator'
import type { ValidationTargets } from 'hono'
import type { z } from 'zod'
import { ApiError, notFound } from './errors'

export interface ValidationIssue {
  path: string
  message: string
}

/**
 * zValidator avec le format d'erreur de l'API : 400 VALIDATION_ERROR (détail par champ), ou 404
 * pour un paramètre de chemin invalide (un identifiant mal formé ne peut désigner aucun set).
 */
export const validate = <T extends z.ZodType, Target extends keyof ValidationTargets>(
  target: Target,
  schema: T,
) =>
  zValidator(target, schema, (result) => {
    if (result.success) return
    if (target === 'param') throw notFound()
    const issues: ValidationIssue[] = result.error.issues.map((issue) => ({
      path: issue.path.map(String).join('.'),
      message: issue.message,
    }))
    throw new ApiError(400, 'VALIDATION_ERROR', issues[0]?.message ?? 'Données invalides.', {
      issues,
    })
  })
