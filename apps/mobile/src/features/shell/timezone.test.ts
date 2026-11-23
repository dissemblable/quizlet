import { describe, expect, it } from 'vitest'
import { withDeviceTimeZone } from './timezone'

const settings = {
  timezone: null,
  newCardsPerDay: 20,
  reviewsPerDay: 200,
  desiredRetention: 0.9,
}

describe('withDeviceTimeZone', () => {
  it('reprend le fuseau de l’appareil et garde les autres réglages', () => {
    expect(withDeviceTimeZone(settings, 'America/New_York')).toEqual({
      ...settings,
      timezone: 'America/New_York',
    })
  })

  it('ne fait rien quand l’appareil ne donne pas de fuseau (comme le web)', () => {
    expect(withDeviceTimeZone(settings, null)).toBeNull()
  })

  it('ne fait rien si un fuseau est déjà choisi', () => {
    expect(
      withDeviceTimeZone({ ...settings, timezone: 'Asia/Tokyo' }, 'America/New_York'),
    ).toBeNull()
  })
})
