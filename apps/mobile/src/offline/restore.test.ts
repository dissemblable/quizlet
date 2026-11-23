import { describe, expect, it } from 'vitest'
import type { AuthStatus } from '@/auth/types'
import { isReconnection } from './restore'

const STATUSES: AuthStatus[] = ['loading', 'signedOut', 'signedIn', 'expired']

describe('isReconnection', () => {
  it.each(['expired', 'signedOut', 'loading'] as const)(
    '%s → signedIn est une reconnexion',
    (from) => {
      expect(isReconnection(from, 'signedIn')).toBe(true)
    },
  )

  it('signedIn → signedIn et toute transition vers un autre état : non', () => {
    expect(isReconnection('signedIn', 'signedIn')).toBe(false)
    for (const from of STATUSES) {
      for (const to of ['loading', 'signedOut', 'expired'] as const) {
        expect(isReconnection(from, to)).toBe(false)
      }
    }
  })
})
