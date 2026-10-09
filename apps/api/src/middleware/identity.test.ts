import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { users } from '../db/schema'
import { createTestClient, type MeBody, PROXY_IP, readJson, ssoHeaders } from '../test/app'
import { useTestDb } from '../test/test-db'
import { decodeHeaderValue, parseIdentityHeaders } from './identity'

const db = useTestDb()

/** Ce que Node fournit quand nginx transmet de l'UTF-8 : les octets lus comme du latin1. */
const asNodeReadsIt = (value: string) => Buffer.from(value, 'utf8').toString('latin1')

describe('identité transmise par le reverse proxy', () => {
  it("accepte les en-têtes venant du proxy de confiance et crée l'utilisateur", async () => {
    const { request } = createTestClient(db)
    const res = await request('/api/me', { as: 'alice' })

    expect(res.status).toBe(200)
    const body = await readJson<MeBody>(res)
    expect(body).toMatchObject({
      user: { username: 'alice', displayName: 'Alice', email: 'alice@example.test' },
      logoutUrl: 'https://auth.example.test/logout',
    })
    const [stored] = await db.select().from(users).where(eq(users.username, 'alice'))
    expect(stored?.id).toBe(body.user.id)
  })

  it("refuse des en-têtes forgés par un client qui n'est pas le proxy", async () => {
    const { request } = createTestClient(db)
    const res = await request('/api/me', { as: 'admin', from: '172.18.0.99' })

    expect(res.status).toBe(403)
    expect(await res.json()).toMatchObject({ error: { code: 'UNTRUSTED_PROXY' } })
    expect(await db.select().from(users)).toHaveLength(0)
  })

  it("refuse une adresse IPv6 inconnue mais reconnaît l'IPv4 encapsulée du proxy", async () => {
    const { request } = createTestClient(db)
    expect((await request('/api/me', { as: 'alice', from: '2001:db8::1' })).status).toBe(403)
    expect((await request('/api/me', { as: 'alice', from: `::ffff:${PROXY_IP}` })).status).toBe(200)
  })

  it('renvoie 401 si le proxy ne transmet pas Remote-User', async () => {
    const { request } = createTestClient(db)
    const res = await request('/api/me')
    expect(res.status).toBe(401)
    expect(await res.json()).toMatchObject({ error: { code: 'UNAUTHENTICATED' } })
  })

  it.each([
    ['avec espace', 'alice bob'],
    ['fusionné par des en-têtes dupliqués', 'alice, bob'],
    ['trop long', 'a'.repeat(129)],
  ])('refuse un Remote-User invalide (%s)', async (_, username) => {
    const { request } = createTestClient(db)
    const res = await request('/api/me', { headers: ssoHeaders(username) })
    expect(res.status).toBe(401)
  })

  it('décode le nom affiché envoyé en UTF-8', async () => {
    const { request } = createTestClient(db)
    const res = await request('/api/me', {
      headers: ssoHeaders('jerome', { 'remote-name': asNodeReadsIt('Jérôme Müller') }),
    })
    expect((await readJson<MeBody>(res)).user.displayName).toBe('Jérôme Müller')
  })

  it("ignore un email invalide et retombe sur l'identifiant comme nom", async () => {
    const { request } = createTestClient(db)
    const res = await request('/api/me', {
      headers: { 'remote-user': 'bob', 'remote-email': 'pas-un-email' },
    })
    expect((await readJson<MeBody>(res)).user).toMatchObject({ displayName: 'bob', email: null })
  })

  it('n’applique jamais X-Forwarded-For pour décider de la confiance', async () => {
    const { request } = createTestClient(db)
    const res = await request('/api/me', {
      as: 'alice',
      from: '172.18.0.99',
      headers: { 'x-forwarded-for': PROXY_IP, 'x-real-ip': PROXY_IP },
    })
    expect(res.status).toBe(403)
  })
})

describe("mode d'authentification de développement", () => {
  const devIdentity = {
    username: 'demo',
    email: 'demo@example.com',
    displayName: 'Utilisateur Démo',
    groups: [],
  }

  it("injecte l'identité de test et ignore les en-têtes reçus", async () => {
    const { request } = createTestClient(db, { devIdentity })
    const res = await request('/api/me', { as: 'admin', from: '203.0.113.9' })
    expect(res.status).toBe(200)
    expect((await readJson<MeBody>(res)).user).toMatchObject({
      username: 'demo',
      displayName: 'Utilisateur Démo',
    })
    expect(await db.select().from(users)).toHaveLength(1)
  })
})

describe('parseIdentityHeaders', () => {
  const read = (headers: Record<string, string>) => (name: string) => headers[name]

  it('découpe et dédoublonne les groupes', () => {
    const identity = parseIdentityHeaders(
      read({ 'remote-user': 'alice', 'remote-groups': 'admins, users,,admins' }),
    )
    expect(identity?.groups).toEqual(['admins', 'users'])
  })

  it('supprime les caractères de contrôle du nom', () => {
    const identity = parseIdentityHeaders(
      read({ 'remote-user': 'alice', 'remote-name': 'Ali\u0007ce' }),
    )
    expect(identity?.displayName).toBe('Alice')
  })
})

describe('decodeHeaderValue', () => {
  it('laisse intactes les valeurs ASCII', () => {
    expect(decodeHeaderValue('Alice')).toBe('Alice')
  })

  it('réinterprète les octets UTF-8 lus en latin1', () => {
    expect(decodeHeaderValue(asNodeReadsIt('Éloïse'))).toBe('Éloïse')
  })

  it('garde une vraie valeur latin1 qui ne forme pas de l’UTF-8 valide', () => {
    expect(decodeHeaderValue('café')).toBe('café')
  })
})
