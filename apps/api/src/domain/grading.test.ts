import { describe, expect, it } from 'vitest'
import { FUTURE_TOLERANCE_MS, MAX_AGE_MS, notBefore, resolveReviewedAt } from './grading'
import { createScheduler, previewDue, toFsrsCard } from './scheduler'

const now = new Date('2026-10-13T08:00:00Z')
const MINUTE = 60_000
const HOUR = 60 * MINUTE
const offset = (ms: number) => new Date(now.getTime() + ms)

describe('resolveReviewedAt', () => {
  it('fixe les bornes à 5 minutes dans le futur et 30 jours dans le passé', () => {
    expect(FUTURE_TOLERANCE_MS).toBe(5 * MINUTE)
    expect(MAX_AGE_MS).toBe(30 * 24 * HOUR)
  })

  it('sans reviewedAt : maintenant, sans aucune garde', () => {
    expect(resolveReviewedAt(undefined, now)).toEqual({ at: now, provided: false, stale: false })
  })

  it('reprend tel quel un instant passé, millisecondes comprises', () => {
    const reviewedAt = '2026-10-13T06:15:30.123Z'
    expect(resolveReviewedAt(reviewedAt, now)).toEqual({
      at: new Date(reviewedAt),
      provided: true,
      stale: false,
    })
  })

  it('reprend tel quel un instant futur dans la tolérance (sinon un rejeu changerait d’heure)', () => {
    for (const ms of [2 * MINUTE, FUTURE_TOLERANCE_MS]) {
      expect(resolveReviewedAt(offset(ms).toISOString(), now)).toEqual({
        at: offset(ms),
        provided: true,
        stale: false,
      })
    }
  })

  it('ramène à maintenant un instant au-delà de la tolérance, d’une milliseconde ou de beaucoup', () => {
    for (const ms of [FUTURE_TOLERANCE_MS + 1, HOUR, 400 * 24 * HOUR]) {
      expect(resolveReviewedAt(offset(ms).toISOString(), now)).toEqual({
        at: now,
        provided: true,
        stale: false,
      })
    }
  })

  it('juge périmée une note de plus de 30 jours, pas une note d’exactement 30 jours', () => {
    expect(resolveReviewedAt(offset(-MAX_AGE_MS).toISOString(), now).stale).toBe(false)
    const old = resolveReviewedAt(offset(-MAX_AGE_MS - 1).toISOString(), now)
    expect(old).toEqual({ at: offset(-MAX_AGE_MS - 1), provided: true, stale: true })
  })
})

describe('notBefore', () => {
  const lastReview = offset(2 * MINUTE)

  it('garde l’instant demandé quand il est postérieur ou égal à la dernière révision', () => {
    expect(notBefore(offset(3 * MINUTE), lastReview)).toEqual(offset(3 * MINUTE))
    expect(notBefore(lastReview, lastReview)).toEqual(lastReview)
  })

  it('remonte à la dernière révision quand l’instant demandé la précède', () => {
    expect(notBefore(now, lastReview)).toEqual(lastReview)
  })

  it('ne change rien sans dernière révision (carte nouvelle)', () => {
    expect(notBefore(now, null)).toEqual(now)
    expect(notBefore(now, undefined)).toEqual(now)
  })
})

// Ce qui justifie `notBefore` : voir `gradeCard` et `toQueueCard`.
describe('ts-fsrs face à une note antérieure à last_review', () => {
  const scheduler = createScheduler(0.9)
  // Note mobile datée dans la tolérance de 5 min, sur le jour UTC suivant l'horloge du serveur.
  const lastReview = new Date('2026-10-14T00:00:30Z')
  const serverNow = new Date('2026-10-13T23:59:00Z')

  const cards = {
    apprentissage: scheduler.next(toFsrsCard(undefined, lastReview), lastReview, 3).card,
    révision: scheduler.next(toFsrsCard(undefined, lastReview), lastReview, 4).card,
  }

  for (const [state, card] of Object.entries(cards)) {
    it(`lève sur un jour UTC antérieur (carte en ${state}) : planification et prévisions`, () => {
      expect(() => scheduler.next(card, serverNow, 3)).toThrow(/delta_t/)
      expect(() => previewDue(scheduler, card, serverNow)).toThrow(/delta_t/)
    })

    it(`ne lève pas le même jour UTC (carte en ${state}), le temps écoulé est nul`, () => {
      const sameDay = new Date('2026-10-14T00:00:00Z')
      expect(() => scheduler.next(card, sameDay, 3)).not.toThrow()
      expect(() => previewDue(scheduler, card, sameDay)).not.toThrow()
    })

    it(`ne lève plus avec notBefore (carte en ${state})`, () => {
      const at = notBefore(serverNow, card.last_review)
      expect(at).toEqual(lastReview)
      expect(() => scheduler.next(card, at, 3)).not.toThrow()
      expect(() => previewDue(scheduler, card, at)).not.toThrow()
    })
  }
})
