import { describe, expect, it } from 'vitest'
import { createScheduler, fromFsrsCard, fromFsrsLog, previewDue, toFsrsCard } from './scheduler'

const now = new Date('2026-10-13T08:00:00Z')
const MINUTE = 60_000
const DAY = 24 * 60 * MINUTE
const scheduler = createScheduler(0.9)

function gradeNew(rating: 1 | 2 | 3 | 4) {
  return scheduler.next(toFsrsCard(undefined, now), now, rating)
}

describe('planification FSRS', () => {
  it('une carte nouvelle notée « Bien » passe en apprentissage, à revoir dans 10 minutes', () => {
    const { card, log } = gradeNew(3)
    expect(fromFsrsCard(card)).toMatchObject({ state: 'learning', reps: 1, lapses: 0 })
    expect(card.due).toEqual(new Date(now.getTime() + 10 * MINUTE))
    expect(fromFsrsLog(log)).toMatchObject({ rating: 3, state: 'new', reviewedAt: now })
  })

  it('« À revoir » ramène la carte dans une minute, « Facile » la planifie à plusieurs jours', () => {
    expect(gradeNew(1).card.due).toEqual(new Date(now.getTime() + MINUTE))
    const easy = gradeNew(4).card
    expect(fromFsrsCard(easy).state).toBe('review')
    expect(easy.due.getTime() - now.getTime()).toBeGreaterThanOrEqual(DAY)
  })

  it('« À revoir » sur une carte en révision la fait réapprendre (un oubli de plus)', () => {
    const learned = gradeNew(4).card
    const later = new Date(learned.due.getTime() + DAY)
    const { card } = scheduler.next(learned, later, 1)
    expect(fromFsrsCard(card)).toMatchObject({ state: 'relearning', lapses: 1 })
    expect(card.due).toEqual(new Date(later.getTime() + 10 * MINUTE))
  })

  it('prévoit des échéances croissantes de « À revoir » à « Facile »', () => {
    const learned = gradeNew(4).card
    const dues = previewDue(scheduler, learned, learned.due).map((due) => due.getTime())
    expect(dues).toHaveLength(4)
    expect(dues).toEqual([...dues].sort((a, b) => a - b))
  })

  it('raccourcit les intervalles quand la rétention cible augmente', () => {
    const learned = gradeNew(4).card
    const interval = (retention: number) =>
      createScheduler(retention).next(learned, learned.due, 3).card.scheduled_days
    expect(interval(0.95)).toBeLessThan(interval(0.8))
  })

  it('retrouve la même carte après un aller-retour par la base', () => {
    const { card } = scheduler.next(gradeNew(3).card, new Date(now.getTime() + 10 * MINUTE), 3)
    expect(toFsrsCard(fromFsrsCard(card), now)).toEqual(card)
  })
})
