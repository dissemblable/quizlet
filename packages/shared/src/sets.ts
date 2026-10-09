import { z } from 'zod'

export const VISIBILITIES = ['private', 'public'] as const
export const visibilitySchema = z.enum(VISIBILITIES)
export type Visibility = z.infer<typeof visibilitySchema>

/** Limites partagées par la validation de l'API et celle des formulaires. */
export const LIMITS = {
  title: 120,
  description: 1000,
  term: 500,
  definition: 1000,
  cards: 500,
  search: 100,
} as const

/** Nombre minimal de cartes (aux définitions distinctes) pour générer un quiz. */
export const QUIZ_MIN_CARDS = 4

/** Suffixe ajouté au titre d'un set dupliqué. */
export const COPY_SUFFIX = ' (copie)'

export const MESSAGES = {
  titleRequired: 'Le titre est requis',
  titleTooLong: `Le titre ne peut pas dépasser ${LIMITS.title} caractères`,
  descriptionTooLong: `La description ne peut pas dépasser ${LIMITS.description} caractères`,
  termRequired: 'Le terme est requis',
  termTooLong: `Le terme ne peut pas dépasser ${LIMITS.term} caractères`,
  definitionRequired: 'La définition est requise',
  definitionTooLong: `La définition ne peut pas dépasser ${LIMITS.definition} caractères`,
  tooManyCards: `Un set ne peut pas contenir plus de ${LIMITS.cards} cartes`,
} as const

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
