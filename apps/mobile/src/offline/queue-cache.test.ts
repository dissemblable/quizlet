import { describe, expect, it } from 'vitest'
import { effectiveQueue, effectiveSummary } from './queue-cache'

const cards = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]

describe('effectiveQueue', () => {
  it('retire les cartes dont la note est en attente', () => {
    expect(effectiveQueue(cards, ['b'])).toEqual([{ id: 'a' }, { id: 'c' }])
  })

  it('renvoie le même tableau quand rien ne change', () => {
    expect(effectiveQueue(cards, [])).toBe(cards)
    expect(effectiveQueue(cards, ['inconnue'])).toBe(cards)
  })

  it('peut tout retirer', () => {
    expect(effectiveQueue(cards, ['a', 'b', 'c'])).toEqual([])
  })

  it('conserve le type des cartes', () => {
    const rich = [{ id: 'a', term: 'chat' }]
    expect(effectiveQueue(rich, [])[0]?.term).toBe('chat')
  })
})

describe('effectiveSummary', () => {
  const summary = { due: 5, new: 3 }

  it('retire une « nouvelle » pour une carte nouvelle, une « due » pour les autres', () => {
    expect(
      effectiveSummary(summary, [
        { cardState: 'new' },
        { cardState: 'review' },
        { cardState: 'learning' },
        { cardState: 'relearning' },
      ]),
    ).toEqual({ due: 2, new: 2 })
  })

  it('ne descend jamais sous zéro', () => {
    expect(
      effectiveSummary({ due: 1, new: 0 }, [
        { cardState: 'new' },
        { cardState: 'review' },
        { cardState: 'review' },
      ]),
    ).toEqual({ due: 0, new: 0 })
  })

  it('renvoie le même objet sans note en attente', () => {
    expect(effectiveSummary(summary, [])).toBe(summary)
  })

  it('conserve les autres champs', () => {
    const extended = { due: 2, new: 1, extra: 'x' }
    expect(effectiveSummary(extended, [{ cardState: 'new' }])).toEqual({
      due: 2,
      new: 0,
      extra: 'x',
    })
  })
})
