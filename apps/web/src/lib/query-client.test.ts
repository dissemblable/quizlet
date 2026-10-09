import { describe, expect, it } from 'vitest'
import { ApiError } from './http'
import { shouldRetry } from './query-client'

describe('shouldRetry', () => {
  it('ne réessaie pas les erreurs métier ni une session expirée', () => {
    expect(shouldRetry(0, new ApiError(404, 'NOT_FOUND', 'Introuvable'))).toBe(false)
    expect(shouldRetry(0, new ApiError(401, 'SESSION_EXPIRED', 'Expirée'))).toBe(false)
  })

  it('réessaie au plus deux fois les pannes réseau et serveur', () => {
    const network = new ApiError(0, 'NETWORK_ERROR', 'Hors ligne')
    expect(shouldRetry(0, network)).toBe(true)
    expect(shouldRetry(1, new ApiError(502, 'UNKNOWN', 'Bad gateway'))).toBe(true)
    expect(shouldRetry(2, network)).toBe(false)
  })
})
