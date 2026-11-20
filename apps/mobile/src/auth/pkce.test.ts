import { describe, expect, it } from 'vitest'
import { base64url, challengeFor, createPkce, createState, safeEqual, toHex } from './pkce'
import { nodeRandom, nodeSha256 } from './test-kit'

describe('PKCE', () => {
  it('vecteur de la RFC 7636 (annexe B)', async () => {
    expect(await challengeFor('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk', nodeSha256)).toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    )
  })

  it('base64url : sans remplissage, alphabet URL-safe, identique à Buffer', () => {
    for (const length of [0, 1, 2, 3, 4, 5, 31, 32, 48]) {
      const bytes = new Uint8Array(length).map((_, i) => (i * 37 + 250) % 256)
      expect(base64url(bytes)).toBe(Buffer.from(bytes).toString('base64url'))
    }
    expect(base64url(new Uint8Array([0xfb, 0xff, 0xfe]))).toBe('-__-')
  })

  it('verifier : 48 octets en base64url (64 caractères), challenge cohérent', async () => {
    const requested: number[] = []
    const { verifier, challenge } = await createPkce(async (count) => {
      requested.push(count)
      return nodeRandom(count)
    }, nodeSha256)
    expect(requested).toEqual([48])
    expect(verifier).toMatch(/^[A-Za-z0-9_-]{64}$/)
    expect(challenge).toBe(await challengeFor(verifier, nodeSha256))
    expect(challenge).toMatch(/^[A-Za-z0-9_-]{43}$/)
  })

  it('state : 16 octets en hexadécimal (32 caractères), différent à chaque appel', async () => {
    const a = await createState(nodeRandom)
    const b = await createState(nodeRandom)
    expect(a).toMatch(/^[0-9a-f]{32}$/)
    expect(a).not.toBe(b)
    expect(toHex(new Uint8Array([0, 1, 15, 16, 255]))).toBe('00010f10ff')
  })

  it("refuse une source d'aléa qui renvoie trop peu d'octets", async () => {
    await expect(createState(async () => new Uint8Array(4))).rejects.toThrow()
  })

  it('safeEqual : égalité exacte, longueurs différentes, préfixe', () => {
    expect(safeEqual('abc', 'abc')).toBe(true)
    expect(safeEqual('abc', 'abd')).toBe(false)
    expect(safeEqual('abc', 'abcd')).toBe(false)
    expect(safeEqual('', 'a')).toBe(false)
    expect(safeEqual('', '')).toBe(true)
  })
})
