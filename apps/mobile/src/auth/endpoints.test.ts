import { describe, expect, it } from 'vitest'
import {
  createDiscovery,
  DISCOVERY_INVALID_MESSAGE,
  DISCOVERY_NETWORK_MESSAGE,
  DISCOVERY_TTL_MS,
  parseDiscovery,
} from './endpoints'
import { AUTH_URL, DISCOVERY_DOCUMENT, ENDPOINTS, fakeFetch, jsonResponse } from './test-kit'

describe('parseDiscovery', () => {
  it('document valide', () => {
    expect(parseDiscovery(DISCOVERY_DOCUMENT, AUTH_URL)).toEqual(ENDPOINTS)
  })

  it('`issuer` avec « / » final accepté et normalisé ; endpoint de révocation facultatif', () => {
    const { revocation_endpoint: _omitted, ...withoutRevocation } = DISCOVERY_DOCUMENT
    expect(parseDiscovery({ ...withoutRevocation, issuer: `${AUTH_URL}/` }, AUTH_URL)).toEqual({
      ...ENDPOINTS,
      revocationEndpoint: null,
    })
  })

  it('`iss` exigé seulement si la découverte annonce le paramètre (RFC 9207), et seulement à `true`', () => {
    const parse = (value: unknown) =>
      parseDiscovery(
        { ...DISCOVERY_DOCUMENT, authorization_response_iss_parameter_supported: value },
        AUTH_URL,
      )?.requiresIssParameter
    expect(parse(true)).toBe(true)
    expect(parse(false)).toBe(false)
    expect(parse('true')).toBe(false)
    expect(parseDiscovery(DISCOVERY_DOCUMENT, AUTH_URL)?.requiresIssParameter).toBe(false)
  })

  it('refuse un issuer différent', () => {
    expect(
      parseDiscovery({ ...DISCOVERY_DOCUMENT, issuer: 'https://evil.example.com' }, AUTH_URL),
    ).toBeNull()
  })

  it('refuse un endpoint http ou sur une autre origine', () => {
    for (const key of [
      'authorization_endpoint',
      'token_endpoint',
      'pushed_authorization_request_endpoint',
    ]) {
      expect(
        parseDiscovery({ ...DISCOVERY_DOCUMENT, [key]: 'http://auth.example.com/x' }, AUTH_URL),
      ).toBeNull()
      expect(
        parseDiscovery({ ...DISCOVERY_DOCUMENT, [key]: 'https://evil.example.com/x' }, AUTH_URL),
      ).toBeNull()
      expect(
        parseDiscovery(
          { ...DISCOVERY_DOCUMENT, [key]: 'https://auth.example.com@evil.example.com/x' },
          AUTH_URL,
        ),
      ).toBeNull()
      expect(parseDiscovery({ ...DISCOVERY_DOCUMENT, [key]: undefined }, AUTH_URL)).toBeNull()
    }
  })

  it('un endpoint de révocation étranger est ignoré (pas de déconnexion distante)', () => {
    expect(
      parseDiscovery(
        { ...DISCOVERY_DOCUMENT, revocation_endpoint: 'https://evil.example.com/revoke' },
        AUTH_URL,
      )?.revocationEndpoint,
    ).toBeNull()
  })

  it('refuse un authUrl http et un corps qui n’est pas un objet', () => {
    expect(parseDiscovery(DISCOVERY_DOCUMENT, 'http://auth.example.com')).toBeNull()
    expect(parseDiscovery(null, AUTH_URL)).toBeNull()
    expect(parseDiscovery([], AUTH_URL)).toBeNull()
  })
})

describe('createDiscovery', () => {
  function setup(handler?: Parameters<typeof fakeFetch>[0]) {
    const clock = { now: 1_000 }
    const net = fakeFetch(handler ?? (() => jsonResponse(200, DISCOVERY_DOCUMENT)))
    const get = createDiscovery({ fetch: net.fetch, authUrl: AUTH_URL, now: () => clock.now })
    return { clock, net, get }
  }

  it('interroge /.well-known/openid-configuration et met en cache (TTL 1 h)', async () => {
    const { clock, net, get } = setup()
    expect(await get()).toEqual(ENDPOINTS)
    expect(net.calls[0]?.url).toBe(`${AUTH_URL}/.well-known/openid-configuration`)
    await get()
    expect(net.calls).toHaveLength(1)
    clock.now += DISCOVERY_TTL_MS - 1
    await get()
    expect(net.calls).toHaveLength(1)
    clock.now += 1
    await get()
    expect(net.calls).toHaveLength(2)
  })

  it('appels simultanés : une seule requête', async () => {
    const { net, get } = setup()
    await Promise.all([get(), get(), get()])
    expect(net.calls).toHaveLength(1)
  })

  it('échec réseau : message clair, rien en cache (le suivant réessaie)', async () => {
    let fail = true
    const { net, get } = setup(() => {
      if (fail) throw new TypeError('Network request failed')
      return jsonResponse(200, DISCOVERY_DOCUMENT)
    })
    await expect(get()).rejects.toMatchObject({ message: DISCOVERY_NETWORK_MESSAGE })
    fail = false
    await expect(get()).resolves.toEqual(ENDPOINTS)
    expect(net.calls).toHaveLength(2)
  })

  it('HTTP en erreur ou document invalide : configuration invalide', async () => {
    const down = setup(() => jsonResponse(503, {}))
    await expect(down.get()).rejects.toMatchObject({ message: DISCOVERY_INVALID_MESSAGE })
    const bad = setup(() => jsonResponse(200, { ...DISCOVERY_DOCUMENT, issuer: 'https://x.test' }))
    await expect(bad.get()).rejects.toMatchObject({ message: DISCOVERY_INVALID_MESSAGE })
  })
})
