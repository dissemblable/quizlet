import { z } from 'zod'
import { MESSAGES, RATINGS, SETTINGS_LIMITS } from './constants'

/** Fuseau IANA reconnu par le moteur JavaScript (« Europe/Paris », « UTC »…). */
export function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('fr-FR', { timeZone: value })
    return true
  } catch {
    return false
  }
}

const perDaySchema = z
  .number({ error: MESSAGES.perDayInvalid })
  .int(MESSAGES.perDayInvalid)
  .min(0, MESSAGES.perDayInvalid)
  .max(SETTINGS_LIMITS.perDay, MESSAGES.perDayInvalid)

/** Paramètres de révision : limites quotidiennes, fuseau horaire, rétention cible FSRS. */
export const settingsSchema = z.object({
  timezone: z.string().trim().max(64).refine(isValidTimeZone, MESSAGES.timezoneInvalid),
  newCardsPerDay: perDaySchema,
  reviewsPerDay: perDaySchema,
  desiredRetention: z
    .number({ error: MESSAGES.retentionInvalid })
    .min(SETTINGS_LIMITS.minRetention, MESSAGES.retentionInvalid)
    .max(SETTINGS_LIMITS.maxRetention, MESSAGES.retentionInvalid),
})

export type SettingsInput = z.input<typeof settingsSchema>

export const gradeSchema = z.object({ rating: z.literal(RATINGS) })

export const cardIdParamSchema = z.object({ cardId: z.uuid() })

/** File de révision : tous mes sets, ou un seul (`setId`). */
export const reviewQueueQuerySchema = z.object({ setId: z.uuid().optional() })

export const dueCardsQuerySchema = z.object({ setId: z.uuid() })
