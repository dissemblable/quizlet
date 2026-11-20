import { ApiError } from '@quizlet/shared'
import { describe, expect, it } from 'vitest'
import {
  buildGradeVariables,
  GRADE_WAIT_MS,
  GradeAbortedError,
  isDeferred,
  isGradeVariables,
  isRetryable,
  retryDelay,
} from './grade-policy'

const apiError = (status: number, code: ApiError['code'] = 'UNKNOWN') =>
  new ApiError(status, code, 'message')

describe('isRetryable', () => {
  it('réessaie le réseau, les 5xx et la session expirée', () => {
    expect(isRetryable(apiError(0, 'NETWORK_ERROR'))).toBe(true)
    expect(isRetryable(apiError(500, 'INTERNAL_ERROR'))).toBe(true)
    expect(isRetryable(apiError(503))).toBe(true)
    expect(isRetryable(apiError(0, 'SESSION_EXPIRED'))).toBe(true)
  })

  it('vérifie les codes de session avant le statut 4xx', () => {
    expect(isRetryable(apiError(401, 'SESSION_EXPIRED'))).toBe(true)
    expect(isRetryable(apiError(401, 'UNAUTHENTICATED'))).toBe(true)
  })

  it('abandonne les refus définitifs', () => {
    expect(isRetryable(apiError(404, 'NOT_FOUND'))).toBe(false)
    expect(isRetryable(apiError(400, 'VALIDATION_ERROR'))).toBe(false)
    expect(isRetryable(apiError(403, 'FORBIDDEN'))).toBe(false)
  })

  it('réessaie les 4xx transitoires (408, 429)', () => {
    expect(isRetryable(apiError(408))).toBe(true)
    expect(isRetryable(apiError(429))).toBe(true)
  })

  it('réessaie une erreur inconnue, jamais un envoi abandonné', () => {
    expect(isRetryable(new TypeError('Network request failed'))).toBe(true)
    expect(isRetryable('boom')).toBe(true)
    expect(isRetryable(new GradeAbortedError())).toBe(false)
  })
})

describe('retryDelay', () => {
  it('double à chaque échec, plafonné à 30 s', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map(retryDelay)).toEqual([
      1000, 2000, 4000, 8000, 16000, 30000, 30000,
    ])
    expect(retryDelay(2000)).toBe(30000)
  })
})

describe('buildGradeVariables', () => {
  it("date la note à l'instant donné, en ISO UTC avec le Z", () => {
    const variables = buildGradeVariables(
      { id: 'c1', state: 'learning' },
      3,
      new Date('2026-11-20T10:15:30.123Z'),
    )
    expect(variables).toEqual({
      cardId: 'c1',
      rating: 3,
      reviewedAt: '2026-11-20T10:15:30.123Z',
      cardState: 'learning',
    })
  })

  it("prend l'heure courante par défaut", () => {
    const before = Date.now()
    const { reviewedAt } = buildGradeVariables({ id: 'c1', state: 'new' }, 1)
    expect(reviewedAt).toMatch(/Z$/)
    expect(Date.parse(reviewedAt)).toBeGreaterThanOrEqual(before)
  })
})

describe('isGradeVariables', () => {
  const valid = {
    cardId: 'c1',
    rating: 2,
    reviewedAt: '2026-11-20T10:00:00.000Z',
    cardState: 'new',
  }

  it('accepte des variables complètes', () => {
    expect(isGradeVariables(valid)).toBe(true)
  })

  it('refuse une forme inattendue', () => {
    expect(isGradeVariables(undefined)).toBe(false)
    expect(isGradeVariables({ ...valid, rating: 5 })).toBe(false)
    expect(isGradeVariables({ ...valid, cardState: 'x' })).toBe(false)
    expect(isGradeVariables({ ...valid, cardId: 1 })).toBe(false)
    expect(isGradeVariables({ cardId: 'c1', rating: 3 })).toBe(false)
  })
})

describe('isDeferred', () => {
  it('une note a attendu au-delà de la fenêtre de useGrade', () => {
    const at = Date.parse('2026-11-20T10:00:00.000Z')
    expect(isDeferred('2026-11-20T10:00:00.000Z', at + GRADE_WAIT_MS)).toBe(false)
    expect(isDeferred('2026-11-20T10:00:00.000Z', at + GRADE_WAIT_MS + 1)).toBe(true)
    expect(isDeferred('pas une date', at)).toBe(false)
  })
})
