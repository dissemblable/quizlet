import { describe, expect, it } from 'vitest'
import type { QueueCard } from './queries'
import { formatInterval, initReviewSession, reviewReducer } from './review'

const now = new Date('2026-10-13T08:00:00Z')
const later = (ms: number) => new Date(now.getTime() + ms)
const MINUTE = 60_000
const DAY = 24 * 60 * MINUTE

describe('formatInterval', () => {
  it('arrondit le délai à l’unité la plus parlante', () => {
    expect(formatInterval(later(0), now)).toBe('1 min')
    expect(formatInterval(later(10 * MINUTE), now)).toBe('10 min')
    expect(formatInterval(later(3 * 60 * MINUTE), now)).toBe('3 h')
    expect(formatInterval(later(DAY), now)).toBe('1 j')
    expect(formatInterval(later(12 * DAY), now)).toBe('12 j')
    expect(formatInterval(later(61 * DAY), now)).toBe('2 mois')
    expect(formatInterval(later(400 * DAY), now)).toBe('1 an')
    expect(formatInterval(later(800 * DAY), now)).toBe('2 ans')
  })
})

const card = (id: string): QueueCard => ({
  id,
  setId: 's',
  term: `terme ${id}`,
  definition: `définition ${id}`,
  state: 'new',
  intervals: [],
})

describe('séance de révision', () => {
  it('retourne la carte puis passe à la suivante après la note', () => {
    let state = initReviewSession([card('a'), card('b')])
    state = reviewReducer(state, { type: 'flip' })
    expect(state.flipped).toBe(true)
    state = reviewReducer(state, { type: 'graded', rating: 4, requeue: null })
    expect(state.queue.map((item) => item.id)).toEqual(['b'])
    expect(state).toMatchObject({ flipped: false, ratings: { 1: 0, 2: 0, 3: 0, 4: 1 } })
  })

  it('remet en fin de séance une carte encore due aujourd’hui', () => {
    let state = initReviewSession([card('a'), card('b')])
    const updated: QueueCard = { ...card('a'), state: 'learning' }
    state = reviewReducer(state, { type: 'graded', rating: 1, requeue: updated })
    expect(state.queue).toEqual([card('b'), updated])
    expect(state.ratings[1]).toBe(1)
  })
})
