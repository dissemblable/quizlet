import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, MESSAGES } from './constants'
import { gradeSchema, isValidTimeZone, settingsSchema } from './review'

describe('settingsSchema', () => {
  it('accepte les paramètres par défaut et un autre fuseau IANA', () => {
    expect(settingsSchema.safeParse(DEFAULT_SETTINGS).success).toBe(true)
    expect(
      settingsSchema.safeParse({ ...DEFAULT_SETTINGS, timezone: 'America/New_York' }).success,
    ).toBe(true)
  })

  it('refuse un fuseau inconnu, des limites hors bornes et une rétention hors bornes', () => {
    const messages = (input: object) =>
      settingsSchema
        .safeParse({ ...DEFAULT_SETTINGS, ...input })
        .error?.issues.map((issue) => issue.message)
    expect(messages({ timezone: 'Mars/Olympus' })).toEqual([MESSAGES.timezoneInvalid])
    expect(messages({ newCardsPerDay: -1 })).toEqual([MESSAGES.perDayInvalid])
    expect(messages({ reviewsPerDay: 1.5 })).toEqual([MESSAGES.perDayInvalid])
    expect(messages({ desiredRetention: 1 })).toEqual([MESSAGES.retentionInvalid])
  })
})

describe('gradeSchema', () => {
  it('accepte les notes 1 à 4 uniquement', () => {
    expect(gradeSchema.safeParse({ rating: 4 }).success).toBe(true)
    expect(gradeSchema.safeParse({ rating: 0 }).success).toBe(false)
    expect(gradeSchema.safeParse({ rating: '3' }).success).toBe(false)
  })

  it('accepte une note sans reviewedAt (le web n’en envoie pas)', () => {
    expect(gradeSchema.safeParse({ rating: 3 }).data).toEqual({ rating: 3 })
  })

  it('accepte reviewedAt en ISO 8601 UTC, avec ou sans millisecondes', () => {
    for (const reviewedAt of ['2026-10-13T08:00:00Z', '2026-10-13T08:00:00.123Z']) {
      expect(gradeSchema.safeParse({ rating: 3, reviewedAt }).data).toEqual({
        rating: 3,
        reviewedAt,
      })
    }
  })

  it('refuse un reviewedAt avec décalage horaire, une date seule ou un type incorrect', () => {
    const invalid = [
      '2026-10-13T08:00:00+02:00',
      '2026-10-13T08:00:00',
      '2026-10-13',
      '2026-13-45T08:00:00Z',
      'hier',
      '',
      1_760_342_400_000,
      null,
    ]
    for (const reviewedAt of invalid) {
      expect(gradeSchema.safeParse({ rating: 3, reviewedAt }).success, String(reviewedAt)).toBe(
        false,
      )
    }
  })
})

describe('isValidTimeZone', () => {
  it('reconnaît les fuseaux IANA', () => {
    expect(isValidTimeZone('Europe/Paris')).toBe(true)
    expect(isValidTimeZone('UTC')).toBe(true)
    expect(isValidTimeZone('Paris')).toBe(false)
  })
})
