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

export const tagNameSchema = z
  .string()
  .trim()
  .min(1, MESSAGES.tagRequired)
  .max(LIMITS.tagName, MESSAGES.tagTooLong)

/** Contenu complet d'un set : métadonnées et liste ordonnée des cartes. */
export const setInputSchema = z.object({
  title: titleSchema,
  description: descriptionSchema,
  visibility: visibilitySchema,
  cards: z.array(cardInputSchema).max(LIMITS.cards, MESSAGES.tooManyCards),
  /** Absent : les tags du set ne changent pas. Un tag inconnu est créé à la volée. */
  tags: z.array(tagNameSchema).max(LIMITS.tagsPerSet, MESSAGES.tooManyTags).optional(),
})

export type CardInput = z.input<typeof cardInputSchema>
export type SetInput = z.input<typeof setInputSchema>

export const idParamSchema = z.object({ id: z.uuid() })
export const setIdParamSchema = idParamSchema

/** Bibliothèque : recherche, filtres (dossier, tags) et page. */
export const setsQuerySchema = z.object({
  q: z.string().trim().max(LIMITS.search).optional(),
  /** Absent : tous les sets ; « none » : les sets sans dossier. */
  folder: z.union([z.literal('none'), z.uuid()]).optional(),
  /** Identifiants séparés par des virgules : un set doit porter tous ces tags. */
  tags: z
    .string()
    .transform((value) => value.split(',').filter(Boolean))
    .pipe(z.array(z.uuid()).max(LIMITS.tagsPerSet))
    .optional(),
  page: z
    .string()
    .regex(/^[1-9]\d{0,5}$/)
    .transform(Number)
    .optional(),
})

export const folderNameSchema = z
  .string()
  .trim()
  .min(1, MESSAGES.folderNameRequired)
  .max(LIMITS.folderName, MESSAGES.folderNameTooLong)

export const folderInputSchema = z.object({ name: folderNameSchema })

/** Déplacement d'un set : `null` le sort de son dossier. */
export const moveSetSchema = z.object({ folderId: z.uuid().nullable() })
