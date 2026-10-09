import { LIMITS, MESSAGES, setInputSchema } from '@quizlet/shared'
import { describe, expect, it } from 'vitest'
import {
  countFilledCards,
  newSetFormValues,
  setFormSchema,
  setToFormValues,
  toSetInput,
} from './set-form'

const messagesOf = (values: unknown) =>
  setFormSchema
    .safeParse(values)
    .error?.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`)

describe('setFormSchema', () => {
  it('ignore les lignes entièrement vides', () => {
    const values = { ...newSetFormValues(), title: 'Vocabulaire' }
    expect(setFormSchema.safeParse(values).success).toBe(true)
  })

  it('signale le champ manquant d’une carte à moitié remplie', () => {
    const values = {
      ...newSetFormValues(),
      title: 'Vocabulaire',
      cards: [
        { term: 'a knife', definition: '' },
        { term: '  ', definition: 'une cuillère' },
      ],
    }
    expect(messagesOf(values)).toEqual([
      `cards.0.definition: ${MESSAGES.definitionRequired}`,
      `cards.1.term: ${MESSAGES.termRequired}`,
    ])
  })

  it('exige un titre', () => {
    expect(messagesOf({ ...newSetFormValues(), title: '   ' })).toEqual([
      `title: ${MESSAGES.titleRequired}`,
    ])
  })

  it('compte la limite de cartes sans les lignes vides', () => {
    const filled = Array.from({ length: LIMITS.cards }, () => ({ term: 'a', definition: 'b' }))
    const base = { ...newSetFormValues(), title: 'Grand set' }
    expect(
      setFormSchema.safeParse({ ...base, cards: [...filled, { term: '', definition: '' }] })
        .success,
    ).toBe(true)
    expect(
      setFormSchema.safeParse({ ...base, cards: [...filled, { term: 'x', definition: 'y' }] })
        .success,
    ).toBe(false)
  })
})

describe('toSetInput', () => {
  it('retire les lignes vides, nettoie les espaces et produit une entrée valide pour l’API', () => {
    const parsed = setFormSchema.parse({
      title: '  Anglais ',
      description: '   ',
      visibility: 'public',
      cards: [
        {
          cardId: '0a6e3c2a-9b1f-4c3d-8e5f-6a7b8c9d0e1f',
          term: ' a knife ',
          definition: ' un couteau ',
        },
        { term: '', definition: '' },
        { term: 'a spoon', definition: 'une cuillère' },
      ],
    })
    const input = toSetInput(parsed)
    expect(input).toEqual({
      title: 'Anglais',
      description: null,
      visibility: 'public',
      cards: [
        { id: '0a6e3c2a-9b1f-4c3d-8e5f-6a7b8c9d0e1f', term: 'a knife', definition: 'un couteau' },
        { term: 'a spoon', definition: 'une cuillère' },
      ],
    })
    expect(setInputSchema.safeParse(input).success).toBe(true)
  })
})

describe('setToFormValues', () => {
  it('reprend les cartes existantes avec leur identifiant', () => {
    const values = setToFormValues({
      title: 'Chimie',
      description: null,
      visibility: 'private',
      cards: [{ id: 'c1', term: 'H', definition: 'Hydrogène' }],
    })
    expect(values).toEqual({
      title: 'Chimie',
      description: '',
      visibility: 'private',
      cards: [{ cardId: 'c1', term: 'H', definition: 'Hydrogène' }],
    })
  })

  it('propose une ligne vide pour un set sans carte', () => {
    const values = setToFormValues({
      title: 'Vide',
      description: null,
      visibility: 'private',
      cards: [],
    })
    expect(values.cards).toEqual([{ term: '', definition: '' }])
  })
})

describe('countFilledCards', () => {
  it('ne compte que les lignes remplies', () => {
    expect(countFilledCards(newSetFormValues().cards)).toBe(0)
    expect(
      countFilledCards([
        { term: 'a', definition: '' },
        { term: ' ', definition: ' ' },
      ]),
    ).toBe(1)
  })
})
