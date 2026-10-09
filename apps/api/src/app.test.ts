import { describe, expect, it } from 'vitest'
import { createTestClient } from './test/app'
import { useTestDb } from './test/test-db'

const db = useTestDb()

describe('app', () => {
  it('répond au healthcheck sans identité, depuis n’importe quelle adresse', async () => {
    const { request } = createTestClient(db)
    const res = await request('/api/health', { from: '203.0.113.9' })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'ok' })
  })

  it('pose des en-têtes de sécurité et interdit la mise en cache', async () => {
    const { request } = createTestClient(db)
    const res = await request('/api/me', { as: 'alice' })
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
    expect(res.headers.get('content-security-policy')).toContain("default-src 'none'")
    expect(res.headers.get('x-frame-options')).toBe('DENY')
  })

  it("n'envoie aucun en-tête CORS par défaut", async () => {
    const { request } = createTestClient(db)
    const res = await request('/api/me', { as: 'alice', headers: { origin: 'https://evil.test' } })
    expect(res.headers.get('access-control-allow-origin')).toBeNull()
  })

  it('autorise seulement les origines CORS configurées', async () => {
    const { request } = createTestClient(db, { corsOrigins: ['https://ok.test'] })
    const ok = await request('/api/me', { as: 'alice', headers: { origin: 'https://ok.test' } })
    expect(ok.headers.get('access-control-allow-origin')).toBe('https://ok.test')
    const ko = await request('/api/me', { as: 'alice', headers: { origin: 'https://evil.test' } })
    expect(ko.headers.get('access-control-allow-origin')).toBeNull()
  })

  it('renvoie une erreur JSON 404 pour une route inconnue', async () => {
    const { request } = createTestClient(db)
    const res = await request('/api/inexistant', { as: 'alice' })
    expect(res.status).toBe(404)
    expect(await res.json()).toMatchObject({ error: { code: 'NOT_FOUND' } })
  })
})
