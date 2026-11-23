import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import { handleError } from '../errors'
import { csrfGuard } from './csrf'

const app = new Hono()
  .onError(handleError)
  .use(csrfGuard(['https://quizlet.test']))
  .get('/data', (c) => c.text('ok'))
  .post('/action', (c) => c.text('ok'))

const post = (headers: Record<string, string>) =>
  app.request('/action', { method: 'POST', headers })

describe('csrfGuard', () => {
  it('laisse passer les méthodes sûres, même inter-sites', async () => {
    const res = await app.request('/data', { headers: { 'sec-fetch-site': 'cross-site' } })
    expect(res.status).toBe(200)
  })

  it('accepte une requête de même origine', async () => {
    expect((await post({ 'sec-fetch-site': 'same-origin' })).status).toBe(200)
  })

  it("refuse une requête venant d'un autre sous-domaine (same-site)", async () => {
    const res = await post({ 'sec-fetch-site': 'same-site', origin: 'https://autre.quizlet.test' })
    expect(res.status).toBe(403)
    expect(await res.json()).toMatchObject({ error: { code: 'CSRF_REJECTED' } })
  })

  it('refuse une requête inter-sites', async () => {
    expect(
      (await post({ 'sec-fetch-site': 'cross-site', origin: 'https://evil.test' })).status,
    ).toBe(403)
  })

  it('se rabat sur Origin quand Sec-Fetch-Site est absent', async () => {
    expect((await post({ origin: 'https://quizlet.test' })).status).toBe(200)
    expect((await post({ origin: 'https://evil.test' })).status).toBe(403)
  })

  it('laisse passer un client non navigateur (ni Sec-Fetch-Site ni Origin)', async () => {
    expect((await post({})).status).toBe(200)
  })
})

describe('csrfGuard : exceptions par chemin', () => {
  const portal = 'https://auth.quizlet.test'
  const guarded = (exceptions: Record<string, string[]> | undefined) =>
    new Hono()
      .onError(handleError)
      .use(csrfGuard(['https://quizlet.test'], exceptions))
      .get('/api/callback', (c) => c.text('ok'))
      .post('/api/callback', (c) => c.text('ok'))
      .post('/api/callback/extra', (c) => c.text('ok'))
      .post('/api/other', (c) => c.text('ok'))
      .post('/api/opaque', (c) => c.text('ok'))

  const exceptionApp = guarded({ '/api/callback': [portal], '/api/opaque': ['null'] })
  const postTo = (path: string, origin: string, site = 'same-site') =>
    exceptionApp.request(path, { method: 'POST', headers: { 'sec-fetch-site': site, origin } })

  it('accepte l’origine supplémentaire sur le chemin exact', async () => {
    expect((await postTo('/api/callback', portal)).status).toBe(200)
    expect((await postTo('/api/callback', portal, 'cross-site')).status).toBe(200)
  })

  it('refuse cette origine ailleurs, sous-chemins et chemins voisins compris', async () => {
    for (const path of ['/api/other', '/api/callback/extra', '/api/opaque']) {
      const res = await postTo(path, portal)
      expect(res.status, path).toBe(403)
      expect(await res.json()).toMatchObject({ error: { code: 'CSRF_REJECTED' } })
    }
  })

  it('refuse toute autre origine sur le chemin de l’exception', async () => {
    expect((await postTo('/api/callback', 'https://evil.test')).status).toBe(403)
    expect((await postTo('/api/callback', 'https://autre.quizlet.test')).status).toBe(403)
  })

  it('garde l’origine de l’app et la même origine acceptées sur ce chemin', async () => {
    expect((await postTo('/api/callback', 'https://quizlet.test')).status).toBe(200)
    expect((await postTo('/api/callback', 'https://evil.test', 'same-origin')).status).toBe(200)
  })

  it('accepte Origin: null seulement sur un chemin qui le liste', async () => {
    expect((await postTo('/api/opaque', 'null')).status).toBe(200)
    expect((await postTo('/api/callback', 'null')).status).toBe(403)
    expect((await postTo('/api/other', 'null')).status).toBe(403)
  })

  it('sans exception, le comportement est celui d’avant', async () => {
    for (const none of [undefined, {}]) {
      const res = await guarded(none).request('/api/callback', {
        method: 'POST',
        headers: { 'sec-fetch-site': 'same-site', origin: portal },
      })
      expect(res.status).toBe(403)
    }
  })

  it('ne change rien pour les méthodes sûres', async () => {
    const res = await exceptionApp.request('/api/callback', {
      headers: { 'sec-fetch-site': 'cross-site' },
    })
    expect(res.status).toBe(200)
  })
})
