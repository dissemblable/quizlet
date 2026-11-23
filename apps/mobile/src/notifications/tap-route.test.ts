import { describe, expect, it } from 'vitest'
import { type TapResponse, tapKey, tapTarget } from './tap-route'

function response(data: unknown, date = 1000): TapResponse {
  return {
    notification: { date, request: { identifier: 'daily-reminder', content: { data } } },
  }
}

describe('tapKey', () => {
  it('distingue deux distributions du même rappel quotidien', () => {
    expect(tapKey(response({}, 1000))).not.toBe(tapKey(response({}, 2000)))
  })

  it('est stable pour une même réponse', () => {
    expect(tapKey(response({}, 1000))).toBe(tapKey(response({}, 1000)))
  })
})

describe('tapTarget', () => {
  it('route du rappel → révision', () => {
    expect(tapTarget(response({ route: '/review' }))).toBe('/review')
  })

  it.each([undefined, null, {}, { route: '/settings' }, { route: 42 }, 'texte'])(
    'aucune navigation pour %j',
    (data) => {
      expect(tapTarget(response(data))).toBeNull()
    },
  )
})
