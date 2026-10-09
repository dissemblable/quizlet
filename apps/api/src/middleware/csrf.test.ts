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
