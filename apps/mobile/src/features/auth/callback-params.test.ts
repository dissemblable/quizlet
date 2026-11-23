import { describe, expect, it } from 'vitest'
import { noParamsAction, readCallbackParams } from './callback-params'

describe('readCallbackParams', () => {
  it('lit les cinq champs du relais', () => {
    expect(
      readCallbackParams({
        code: 'c',
        state: 's',
        iss: 'https://auth.example.com',
        error: 'access_denied',
        error_description: 'Refusé',
      }),
    ).toEqual({
      code: 'c',
      state: 's',
      iss: 'https://auth.example.com',
      error: 'access_denied',
      error_description: 'Refusé',
    })
  })

  it('paramètre répété : première valeur ; vides et inconnus ignorés', () => {
    expect(readCallbackParams({ code: ['un', 'deux'], state: '', foo: 'bar' })).toEqual({
      code: 'un',
    })
  })

  it('aucun paramètre utile : null (route ouverte à la main)', () => {
    expect(readCallbackParams({})).toBeNull()
    expect(readCallbackParams({ foo: 'bar', code: undefined, state: [] })).toBeNull()
  })
})

describe('noParamsAction', () => {
  it('suit la session : accueil si connecté ou expiré, connexion sinon, attente au chargement', () => {
    expect(noParamsAction('loading')).toBe('wait')
    expect(noParamsAction('signedIn')).toBe('home')
    expect(noParamsAction('expired')).toBe('home')
    expect(noParamsAction('signedOut')).toBe('login')
  })
})
