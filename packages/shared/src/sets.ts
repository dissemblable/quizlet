import { z } from 'zod'
import { LIMITS, MESSAGES, VISIBILITIES } from './constants'

export const visibilitySchema = z.enum(VISIBILITIES)

export const titleSchema = z
  .string()
  .trim()
  .min(1, MESSAGES.titleRequired)
  .max(LIMITS.title, MESSAGES.titleTooLong)

/** Description facultative : une chaîne vide devient null. */
export const descriptionSchema = z
  .string()
  .trim()
  .max(LIMITS.description, MESSAGES.descriptionTooLong)
  .nullish()
  .transform((value) => (value ? value : null))

export const cardInputSchema = z.object({
  /** Absent pour une nouvelle carte ; présent pour conserver une carte existante du set. */
  id: z.uuid().optional(),
  term: z.string().trim().min(1, MESSAGES.termRequired).max(LIMITS.term, MESSAGES.termTooLong),
  definition: z
    .string()
    .trim()
    .min(1, MESSAGES.definitionRequired)
    .max(LIMITS.definition, MESSAGES.definitionTooLong),
})

/** Contenu complet d'un set : métadonnées et liste ordonnée des cartes. */
export const setInputSchema = z.object({
  title: titleSchema,
  description: descriptionSchema,
  visibility: visibilitySchema,
  cards: z.array(cardInputSchema).max(LIMITS.cards, MESSAGES.tooManyCards),
})

export type CardInput = z.input<typeof cardInputSchema>
export type SetInput = z.input<typeof setInputSchema>

export const setIdParamSchema = z.object({ id: z.uuid() })

export const setsQuerySchema = z.object({
  q: z.string().trim().max(LIMITS.search).optional(),
})
