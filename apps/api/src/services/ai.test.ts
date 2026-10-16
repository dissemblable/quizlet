import { LIMITS } from '@quizlet/shared'
import { describe, expect, it } from 'vitest'
import { countCards, GenerationError, toDraft } from './ai'

describe('toDraft', () => {
  it('garde les cartes valides, rognées, et compte celles qui sont écartées', () => {
    expect(
      toDraft({
        title: '  Anglais  ',
        description: '',
        cards: [
          { term: ' cat ', definition: ' chat ' },
          { term: '', definition: 'vide' },
          { term: 'long', definition: 'x'.repeat(LIMITS.definition + 1) },
        ],
      }),
    ).toEqual({
      draft: { title: 'Anglais', description: null, cards: [{ term: 'cat', definition: 'chat' }] },
      skipped: 2,
    })
  })

  it('borne le titre et le nombre de cartes', () => {
    const card = { term: 'a', definition: 'b' }
    const { draft, skipped } = toDraft({
      title: 'T'.repeat(LIMITS.title + 10),
      description: 'Résumé',
      cards: Array.from({ length: LIMITS.cards + 3 }, () => card),
    })
    expect(draft.title).toHaveLength(LIMITS.title)
    expect(draft.cards).toHaveLength(LIMITS.cards)
    expect(skipped).toBe(3)
  })

  it('échoue sans carte valide ou sur une forme inattendue', () => {
    expect(() => toDraft({ title: 'T', description: '', cards: [] })).toThrow(GenerationError)
    expect(() => toDraft({ cards: 'non' })).toThrow(GenerationError)
  })
})

describe('countCards', () => {
  it('compte les cartes commencées dans un JSON partiel', () => {
    expect(countCards('{"title":"T","cards":[{"term":"a","definition":"b"},{"term" : "c')).toBe(2)
    expect(countCards('')).toBe(0)
  })
})
