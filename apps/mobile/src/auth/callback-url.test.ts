import { describe, expect, it } from 'vitest'
import { parseCallbackUrl } from './callback-url'

const CB = 'quizlet://callback'

describe('parseCallbackUrl', () => {
  it('lit code, state et iss', () => {
    expect(
      parseCallbackUrl(`${CB}?code=abc.def&state=0123&iss=https%3A%2F%2Fauth.example.com`, CB),
    ).toEqual({ code: 'abc.def', state: '0123', iss: 'https://auth.example.com' })
  })

  it("lit l'erreur du relais, `+` = espace", () => {
    expect(
      parseCallbackUrl(
        `${CB}?error=access_denied&error_description=Acc%C3%A8s+refus%C3%A9&state=s`,
        CB,
      ),
    ).toEqual({ error: 'access_denied', error_description: 'Accès refusé', state: 's' })
    expect(parseCallbackUrl(`${CB}?error=invalid_request`, CB)).toEqual({
      error: 'invalid_request',
    })
  })

  it('callback sans paramètre : objet vide ; autre URL : null', () => {
    expect(parseCallbackUrl(CB, CB)).toEqual({})
    expect(parseCallbackUrl(`${CB}/`, CB)).toEqual({})
    expect(parseCallbackUrl(`${CB}?`, CB)).toEqual({})
    expect(parseCallbackUrl('quizlet://sets/1?code=x', CB)).toBeNull()
    expect(parseCallbackUrl('https://quizlet.example.com/?code=x', CB)).toBeNull()
    expect(parseCallbackUrl(`${CB}evil?code=x`, CB)).toBeNull()
    expect(parseCallbackUrl(`${CB}/autre?code=x`, CB)).toBeNull()
  })

  it('ignore les champs inconnus, le fragment, garde la première occurrence', () => {
    expect(
      parseCallbackUrl(`${CB}?code=1&code=2&foo=bar&__proto__=x&state=s#fragment=1&code=3`, CB),
    ).toEqual({ code: '1', state: 's' })
  })

  it('valeur vide, sans « = », encodage invalide : jamais de rejet', () => {
    expect(parseCallbackUrl(`${CB}?code=&state`, CB)).toEqual({ code: '', state: '' })
    expect(parseCallbackUrl(`${CB}?code=%E0%A4%A`, CB)).toEqual({ code: '%E0%A4%A' })
  })
})
