import { describe, expect, it, vi } from 'vitest'
import { createTrustedProxyMatcher, normalizeIp, parseTrustedProxyEntry } from './trusted-proxies'

const silent = { onResolveError: () => {} }

describe('parseTrustedProxyEntry', () => {
  it.each([
    ['127.0.0.1', 'address'],
    ['::1', 'address'],
    ['172.16.0.0/12', 'subnet'],
    ['fd00::/8', 'subnet'],
    ['nginx', 'hostname'],
    ['proxy.internal', 'hostname'],
  ])('reconnaît %s', (entry, kind) => {
    expect(parseTrustedProxyEntry(entry)?.kind).toBe(kind)
  })

  it.each(['10.0.0.0/33', '10.0.0.0/x', 'nginx_proxy', '-nginx', ''])('refuse %s', (entry) => {
    expect(parseTrustedProxyEntry(entry)).toBeNull()
  })
})

describe('normalizeIp', () => {
  it('ramène une IPv4 encapsulée en IPv6 à sa forme IPv4', () => {
    expect(normalizeIp('::ffff:172.18.0.5')).toBe('172.18.0.5')
    expect(normalizeIp('::1')).toBe('::1')
  })
})

describe('createTrustedProxyMatcher', () => {
  it('accepte les IP et les réseaux listés, et rien d’autre', async () => {
    const matcher = createTrustedProxyMatcher(['127.0.0.1', '10.0.0.0/8', '::1'])
    expect(await matcher.isTrusted('127.0.0.1')).toBe(true)
    expect(await matcher.isTrusted('10.42.0.7')).toBe(true)
    expect(await matcher.isTrusted('::ffff:10.1.2.3')).toBe(true)
    expect(await matcher.isTrusted('::1')).toBe(true)
    expect(await matcher.isTrusted('11.0.0.1')).toBe(false)
    expect(await matcher.isTrusted('172.18.0.2')).toBe(false)
    expect(await matcher.isTrusted(undefined)).toBe(false)
    expect(await matcher.isTrusted('pas-une-ip')).toBe(false)
  })

  it('refuse tout quand la liste est vide', async () => {
    expect(await createTrustedProxyMatcher([]).isTrusted('127.0.0.1')).toBe(false)
  })

  it('lève une erreur sur une entrée invalide', () => {
    expect(() => createTrustedProxyMatcher(['10.0.0.0/40'])).toThrow(/TRUSTED_PROXIES/)
  })

  it("fait confiance à l'adresse courante d'un nom d'hôte (conteneur nginx)", async () => {
    const resolve = vi.fn(async () => ['172.18.0.3'])
    const matcher = createTrustedProxyMatcher(['nginx'], { resolve, ...silent })
    expect(await matcher.isTrusted('172.18.0.3')).toBe(true)
    expect(await matcher.isTrusted('172.18.0.4')).toBe(false)
    expect(resolve).toHaveBeenCalledWith('nginx')
  })

  it('suit le changement d’IP après recréation du conteneur, sans résoudre à chaque requête', async () => {
    let clock = 0
    let current = ['172.18.0.3']
    const resolve = vi.fn(async () => current)
    const matcher = createTrustedProxyMatcher(['nginx'], {
      resolve,
      now: () => clock,
      ttlMs: 30_000,
      missRefreshMs: 5_000,
      ...silent,
    })

    expect(await matcher.isTrusted('172.18.0.3')).toBe(true)
    expect(await matcher.isTrusted('172.18.0.3')).toBe(true)
    expect(resolve).toHaveBeenCalledTimes(1)

    current = ['172.18.0.9'] // nginx recréé
    clock = 1_000
    expect(await matcher.isTrusted('172.18.0.9')).toBe(false) // trop tôt pour re-résoudre
    clock = 6_000
    expect(await matcher.isTrusted('172.18.0.9')).toBe(true)
    expect(await matcher.isTrusted('172.18.0.3')).toBe(false)
    expect(resolve).toHaveBeenCalledTimes(2)
  })

  it('ne lance qu’une résolution pour des requêtes simultanées', async () => {
    const resolve = vi.fn(async () => ['172.18.0.3'])
    const matcher = createTrustedProxyMatcher(['nginx'], { resolve, ...silent })
    await Promise.all([matcher.isTrusted('172.18.0.3'), matcher.isTrusted('172.18.0.3')])
    expect(resolve).toHaveBeenCalledTimes(1)
  })

  it('refuse tout si la résolution échoue (fail-closed)', async () => {
    const onResolveError = vi.fn()
    const matcher = createTrustedProxyMatcher(['nginx'], {
      resolve: async () => {
        throw new Error('ENOTFOUND')
      },
      onResolveError,
    })
    expect(await matcher.isTrusted('172.18.0.3')).toBe(false)
    expect(onResolveError).toHaveBeenCalledWith('nginx', expect.any(Error))
  })
})
