import { describe, expect, it } from 'vitest'
import { LIMITS, MESSAGES } from './constants'
import { setInputSchema } from './sets'

const valid = {
  title: '  Capitales  ',
  description: '',
  visibility: 'private',
  cards: [{ term: ' France ', definition: ' Paris ' }],
}

describe('setInputSchema', () => {
  it('nettoie les espaces et transforme une description vide en null', () => {
    expect(setInputSchema.parse(valid)).toEqual({
      title: 'Capitales',
      description: null,
      visibility: 'private',
      cards: [{ term: 'France', definition: 'Paris' }],
    })
  })

  it('accepte un set sans carte', () => {
    expect(setInputSchema.safeParse({ ...valid, cards: [] }).success).toBe(true)
  })

  it('exige un titre et des cartes complètes, avec des messages en français', () => {
    const result = setInputSchema.safeParse({
      ...valid,
      title: '   ',
      cards: [{ term: 'France', definition: '' }],
    })
    expect(result.success).toBe(false)
    const messages = result.error?.issues.map((issue) => issue.message)
    expect(messages).toContain(MESSAGES.titleRequired)
    expect(messages).toContain(MESSAGES.definitionRequired)
  })

  it('refuse une visibilité inconnue et un identifiant de carte invalide', () => {
    expect(setInputSchema.safeParse({ ...valid, visibility: 'shared' }).success).toBe(false)
    expect(
      setInputSchema.safeParse({ ...valid, cards: [{ id: '42', term: 'a', definition: 'b' }] })
        .success,
    ).toBe(false)
  })

  it('limite la taille du set', () => {
    const cards = Array.from({ length: LIMITS.cards + 1 }, () => ({ term: 'a', definition: 'b' }))
    const result = setInputSchema.safeParse({ ...valid, cards })
    expect(result.error?.issues[0]?.message).toBe(MESSAGES.tooManyCards)
  })
})
