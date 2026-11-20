import { ApiError } from '@quizlet/shared'
import { describe, expect, it } from 'vitest'
import {
  buildGradeVariables,
  GRADE_WAIT_MS,
  GradeAbortedError,
  isDeferred,
  isGradeVariables,
  isRetryable,
  MAX_SERVER_RETRIES,
  OwnerCheckError,
  ownerIdFromMe,
  retryDelay,
  shouldRetryGrade,
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

describe('shouldRetryGrade', () => {
  const MANY = 100_000

  it('attend sans limite le réseau, la session, 408 et 429', () => {
    for (const error of [
      apiError(0, 'NETWORK_ERROR'),
      apiError(401, 'SESSION_EXPIRED'),
      apiError(401, 'UNAUTHENTICATED'),
      apiError(408),
      apiError(429),
    ]) {
      expect(shouldRetryGrade(0, error)).toBe(true)
      expect(shouldRetryGrade(MANY, error)).toBe(true)
    }
  })

  it('plafonne les 5xx et les erreurs inconnues à MAX_SERVER_RETRIES réessais', () => {
    expect(MAX_SERVER_RETRIES).toBe(10)
    for (const error of [
      apiError(500, 'INTERNAL_ERROR'),
      apiError(503),
      new TypeError('boom'),
      new OwnerCheckError(apiError(404, 'NOT_FOUND')),
    ]) {
      expect(shouldRetryGrade(0, error)).toBe(true)
      expect(shouldRetryGrade(MAX_SERVER_RETRIES - 1, error)).toBe(true)
      expect(shouldRetryGrade(MAX_SERVER_RETRIES, error)).toBe(false)
    }
  })

  it('n’essaie jamais deux fois un refus définitif ni un envoi abandonné', () => {
    expect(shouldRetryGrade(0, apiError(404, 'NOT_FOUND'))).toBe(false)
    expect(shouldRetryGrade(0, apiError(400, 'VALIDATION_ERROR'))).toBe(false)
    expect(shouldRetryGrade(0, new GradeAbortedError())).toBe(false)
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

  it('porte le compte qui a donné la note, seulement s’il est connu', () => {
    const now = new Date('2026-11-20T10:00:00.000Z')
    expect(buildGradeVariables({ id: 'c1', state: 'new' }, 3, now, 'alice').ownerId).toBe('alice')
    expect('ownerId' in buildGradeVariables({ id: 'c1', state: 'new' }, 3, now)).toBe(false)
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

  it('accepte des variables complètes, avec ou sans ownerId', () => {
    expect(isGradeVariables(valid)).toBe(true)
    expect(isGradeVariables({ ...valid, ownerId: 'alice' })).toBe(true)
  })

  it('refuse une forme inattendue', () => {
    expect(isGradeVariables(undefined)).toBe(false)
    expect(isGradeVariables({ ...valid, rating: 5 })).toBe(false)
    expect(isGradeVariables({ ...valid, cardState: 'x' })).toBe(false)
    expect(isGradeVariables({ ...valid, cardId: 1 })).toBe(false)
    expect(isGradeVariables({ cardId: 'c1', rating: 3 })).toBe(false)
    expect(isGradeVariables({ ...valid, ownerId: 42 })).toBe(false)
  })
})

describe('ownerIdFromMe', () => {
  it('lit me.user.id', () => {
    expect(ownerIdFromMe({ user: { id: 'alice', name: 'A' } })).toBe('alice')
  })

  it('inconnu : undefined (jamais de supposition)', () => {
    for (const me of [
      undefined,
      null,
      'x',
      {},
      { user: null },
      { user: {} },
      { user: { id: 1 } },
    ]) {
      expect(ownerIdFromMe(me)).toBeUndefined()
    }
    expect(ownerIdFromMe({ user: { id: '' } })).toBeUndefined()
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
