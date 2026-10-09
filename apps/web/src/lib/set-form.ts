import {
  LIMITS,
  MESSAGES,
  type SetInput,
  titleSchema,
  type Visibility,
  visibilitySchema,
} from '@quizlet/shared'
import { z } from 'zod'

/**
 * Carte telle qu'éditée dans le formulaire. L'identifiant s'appelle `cardId` : `useFieldArray`
 * réserve la clé `id` pour ses propres clés de rendu.
 */
const cardFormSchema = z
  .object({
    cardId: z.string().optional(),
    term: z.string().max(LIMITS.term, MESSAGES.termTooLong),
    definition: z.string().max(LIMITS.definition, MESSAGES.definitionTooLong),
  })
  .superRefine((card, ctx) => {
    const term = card.term.trim()
    const definition = card.definition.trim()
    if (!term && !definition) return // ligne vide : ignorée à l'enregistrement
    if (!term) ctx.addIssue({ code: 'custom', path: ['term'], message: MESSAGES.termRequired })
    if (!definition) {
      ctx.addIssue({ code: 'custom', path: ['definition'], message: MESSAGES.definitionRequired })
    }
  })

export const setFormSchema = z.object({
  title: titleSchema,
  description: z.string().max(LIMITS.description, MESSAGES.descriptionTooLong),
  visibility: visibilitySchema,
  cards: z
    .array(cardFormSchema)
    .refine((list) => list.filter(isFilled).length <= LIMITS.cards, MESSAGES.tooManyCards),
})

export type SetFormValues = z.input<typeof setFormSchema>
export type SetFormOutput = z.output<typeof setFormSchema>
export type CardFormValues = SetFormValues['cards'][number]

function isFilled(card: { term: string; definition: string }): boolean {
  return card.term.trim() !== '' || card.definition.trim() !== ''
}

export function countFilledCards(list: ReadonlyArray<{ term: string; definition: string }>) {
  return list.filter(isFilled).length
}

export function emptyCard(): CardFormValues {
  return { term: '', definition: '' }
}

export function newSetFormValues(): SetFormValues {
  return {
    title: '',
    description: '',
    visibility: 'private',
    cards: [emptyCard(), emptyCard(), emptyCard()],
  }
}

interface EditableSet {
  title: string
  description: string | null
  visibility: Visibility
  cards: ReadonlyArray<{ id: string; term: string; definition: string }>
}

export function setToFormValues(set: EditableSet): SetFormValues {
  return {
    title: set.title,
    description: set.description ?? '',
    visibility: set.visibility,
    cards:
      set.cards.length > 0
        ? set.cards.map(({ id, term, definition }) => ({ cardId: id, term, definition }))
        : [emptyCard()],
  }
}

/** Valeurs validées du formulaire → corps de requête de l'API (lignes vides retirées). */
export function toSetInput(values: SetFormOutput): SetInput {
  return {
    title: values.title,
    description: values.description.trim() || null,
    visibility: values.visibility,
    cards: values.cards.filter(isFilled).map(({ cardId, term, definition }) => ({
      ...(cardId ? { id: cardId } : {}),
      term: term.trim(),
      definition: definition.trim(),
    })),
  }
}
