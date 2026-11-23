import { describe, expect, it } from 'vitest'
import {
  EXPIRY_MARGIN_MS,
  isAccessExpired,
  parseTokens,
  serializeTokens,
  type Tokens,
  tokensFromResponse,
} from './tokens'

const tokens: Tokens = { accessToken: 'at', refreshToken: 'rt', expiresAt: 10_000_000 }

describe('tokens', () => {
  it('aller-retour de sérialisation', () => {
    expect(parseTokens(serializeTokens(tokens))).toEqual(tokens)
  })

  it('stockage absent ou corrompu : null', () => {
    expect(parseTokens(null)).toBeNull()
    expect(parseTokens('')).toBeNull()
    expect(parseTokens('{pas du json')).toBeNull()
    expect(parseTokens('[]')).toBeNull()
    expect(parseTokens('null')).toBeNull()
    expect(parseTokens(JSON.stringify({ accessToken: 'at', refreshToken: 'rt' }))).toBeNull()
    expect(parseTokens(JSON.stringify({ ...tokens, accessToken: '' }))).toBeNull()
    expect(parseTokens(JSON.stringify({ ...tokens, refreshToken: 3 }))).toBeNull()
    expect(parseTokens(JSON.stringify({ ...tokens, expiresAt: 'demain' }))).toBeNull()
  })

  it('expiration avec une marge de 60 s', () => {
    expect(EXPIRY_MARGIN_MS).toBe(60_000)
    const now = tokens.expiresAt - 61_000
    expect(isAccessExpired(tokens, now)).toBe(false)
    expect(isAccessExpired(tokens, now + 1000)).toBe(true)
    expect(isAccessExpired(tokens, tokens.expiresAt + 1)).toBe(true)
  })

  it('réponse du endpoint token : expiresAt = now + expires_in × 1000', () => {
    expect(
      tokensFromResponse({ access_token: 'a', refresh_token: 'r', expires_in: 3600 }, 1000),
    ).toEqual({ accessToken: 'a', refreshToken: 'r', expiresAt: 3_601_000 })
  })

  it('refresh : un refresh token absent garde le précédent ; à la connexion il est obligatoire', () => {
    expect(tokensFromResponse({ access_token: 'a', expires_in: 60 }, 0, 'ancien')).toEqual({
      accessToken: 'a',
      refreshToken: 'ancien',
      expiresAt: 60_000,
    })
    expect(tokensFromResponse({ access_token: 'a', expires_in: 60 }, 0)).toBeNull()
  })

  it('réponse inutilisable : null (expires_in absent = 1 h)', () => {
    expect(tokensFromResponse(null, 0)).toBeNull()
    expect(tokensFromResponse('x', 0)).toBeNull()
    expect(tokensFromResponse({ refresh_token: 'r', expires_in: 60 }, 0)).toBeNull()
    expect(
      tokensFromResponse({ access_token: 'a', refresh_token: 'r', expires_in: 0 }, 0),
    ).toBeNull()
    expect(
      tokensFromResponse({ access_token: 'a', refresh_token: 'r', expires_in: '60' }, 0),
    ).toBeNull()
    expect(tokensFromResponse({ access_token: 'a', refresh_token: 'r' }, 0)?.expiresAt).toBe(
      3_600_000,
    )
  })
})
