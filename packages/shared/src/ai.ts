import { z } from 'zod'
import { AI_FILE_TYPES, AI_LIMITS, IMPORT_MAX_BYTES, MESSAGES } from './constants'
import { utf8Size } from './import'

const courseFileSchema = z
  .file()
  .mime([...AI_FILE_TYPES], MESSAGES.aiFileType)
  .refine(
    (file) => !file.type.startsWith('image/') || file.size <= AI_LIMITS.imageBytes,
    MESSAGES.aiImageTooLarge,
  )

/** Génération par IA (multipart) : la consigne, un cours collé et des fichiers, tous facultatifs sauf la consigne. */
export const aiGenerateSchema = z.object({
  prompt: z
    .string()
    .trim()
    .min(1, MESSAGES.aiPromptRequired)
    .max(AI_LIMITS.prompt, MESSAGES.aiPromptTooLong),
  text: z
    .string()
    .refine((text) => utf8Size(text) <= IMPORT_MAX_BYTES, MESSAGES.aiTextTooLarge)
    .optional(),
  // FormData : un fichier seul arrive tel quel, plusieurs fichiers arrivent en tableau.
  files: z
    .union([courseFileSchema, z.array(courseFileSchema)])
    .optional()
    .transform((files) => (files === undefined ? [] : Array.isArray(files) ? files : [files]))
    .refine((files) => files.length <= AI_LIMITS.files, MESSAGES.aiTooManyFiles),
})

/** Brouillon de set produit par l'IA : jamais enregistré par l'API, relu dans l'éditeur. */
export interface AiDraft {
  title: string
  description: string | null
  cards: Array<{ term: string; definition: string }>
}

/** Événements du flux NDJSON de `POST /api/ai/generate`, un objet JSON par ligne. */
export type AiEvent =
  | { type: 'progress'; cards: number }
  | { type: 'ping' }
  | { type: 'done'; draft: AiDraft; skipped: number }
  | { type: 'error'; message: string }
