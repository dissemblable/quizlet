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
})

describe('isValidTimeZone', () => {
  it('reconnaît les fuseaux IANA', () => {
    expect(isValidTimeZone('Europe/Paris')).toBe(true)
    expect(isValidTimeZone('UTC')).toBe(true)
    expect(isValidTimeZone('Paris')).toBe(false)
  })
})
