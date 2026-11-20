import { ApiError } from '@quizlet/shared'
import { describe, expect, it } from 'vitest'
import { profileLoginState } from './gate'

const unauthenticated = new ApiError(401, 'UNAUTHENTICATED', 'Non connecté')

describe('profileLoginState', () => {
  it('relance quand la session est valide malgré un 401 (reconnexion récente)', () => {
    expect(profileLoginState(unauthenticated, 'signedIn')).toBe('stale')
    expect(profileLoginState(new ApiError(401, 'SESSION_EXPIRED', 'Expirée'), 'signedIn')).toBe(
      'stale',
    )
  })

  it('ne montre rien quand la session est expirée (la bannière suffit)', () => {
    expect(profileLoginState(unauthenticated, 'expired')).toBe('expired')
  })

  it('laisse l’écran d’erreur pour les autres cas', () => {
    expect(profileLoginState(unauthenticated, 'signedOut')).toBe('none')
    expect(profileLoginState(new ApiError(500, 'UNKNOWN', 'Boum'), 'signedIn')).toBe('none')
    expect(profileLoginState(new Error('réseau'), 'expired')).toBe('none')
    expect(profileLoginState(null, 'signedIn')).toBe('none')
  })
})
