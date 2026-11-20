import { ApiError } from '@quizlet/shared'
import { describe, expect, it } from 'vitest'
import { createAppQueryClient, createOfflineClient, shouldRetry } from './client-factory'
import { GRADE_MUTATION_KEY } from './keys'

const apiError = (status: number, code: ApiError['code'] = 'UNKNOWN') =>
  new ApiError(status, code, 'message')

describe('shouldRetry (requêtes)', () => {
  it('réessaie deux fois les pannes réseau et les 5xx', () => {
    expect(shouldRetry(0, apiError(0, 'NETWORK_ERROR'))).toBe(true)
    expect(shouldRetry(1, apiError(503))).toBe(true)
    expect(shouldRetry(2, apiError(503))).toBe(false)
    expect(shouldRetry(0, new TypeError('Network request failed'))).toBe(true)
  })

  it('ne réessaie jamais un 4xx ni une session expirée', () => {
    expect(shouldRetry(0, apiError(404, 'NOT_FOUND'))).toBe(false)
    expect(shouldRetry(0, apiError(400, 'VALIDATION_ERROR'))).toBe(false)
    expect(shouldRetry(0, apiError(0, 'SESSION_EXPIRED'))).toBe(false)
    expect(shouldRetry(0, apiError(401, 'UNAUTHENTICATED'))).toBe(false)
  })
})

describe('client', () => {
  it('requêtes persistables : jamais ramassées, fraîches 30 s, pas de refetch au focus', () => {
    const { queries } = createAppQueryClient().getDefaultOptions()
    expect(queries?.gcTime).toBe(Number.POSITIVE_INFINITY)
    expect(queries?.staleTime).toBe(30_000)
    expect(queries?.refetchOnWindowFocus).toBe(false)
    expect(queries?.retry).toBe(shouldRetry)
  })

  it('la mutation de note a ses valeurs par défaut dès la création du client', () => {
    const client = createOfflineClient({
      postGrade: async () => ({ card: null, ignored: false }),
      whenReadyToSend: async () => {},
      report: () => {},
    })
    const defaults = client.getMutationDefaults(GRADE_MUTATION_KEY)
    expect(defaults.scope).toEqual({ id: 'review-grade' })
    expect(typeof defaults.mutationFn).toBe('function')
    expect(typeof defaults.retry).toBe('function')
    expect(typeof defaults.onSuccess).toBe('function')
  })
})
