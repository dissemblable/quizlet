import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiFetch, errorMessage, toApiError, unwrap } from './http'

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('apiFetch', () => {
  it('ne suit jamais les redirections et envoie les cookies de même origine', async () => {
    const fetchMock = vi.fn(async () => json(200, {}))
    vi.stubGlobal('fetch', fetchMock)
    await apiFetch('/api/me')
    expect(fetchMock).toHaveBeenCalledWith('/api/me', {
      credentials: 'same-origin',
      redirect: 'manual',
    })
  })

  it('signale une session expirée quand Authelia redirige vers son portail', async () => {
    const opaque = { type: 'opaqueredirect', status: 0 } as Response
    vi.stubGlobal('fetch', async () => opaque)
    const error = await apiFetch('/api/me').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).code).toBe('SESSION_EXPIRED')
    expect((error as ApiError).needsLogin).toBe(true)
  })

  it('transforme une panne réseau en erreur lisible', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new TypeError('Failed to fetch')
    })
    await expect(apiFetch('/api/me')).rejects.toMatchObject({ code: 'NETWORK_ERROR', status: 0 })
  })
})

describe('unwrap', () => {
  it('renvoie le JSON des réponses réussies', async () => {
    expect(await unwrap(Promise.resolve(json(200, { ok: 1 })))).toEqual({ ok: 1 })
  })

  it('renvoie undefined pour une réponse 204', async () => {
    expect(await unwrap(Promise.resolve(new Response(null, { status: 204 })))).toBeUndefined()
  })

  it("lève l'erreur métier décrite par l'API", async () => {
    const response = json(404, { error: { code: 'NOT_FOUND', message: 'Set introuvable.' } })
    await expect(unwrap(Promise.resolve(response))).rejects.toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
      message: 'Set introuvable.',
    })
  })
})

describe('toApiError', () => {
  it('fournit un message par défaut si le corps est illisible', async () => {
    const error = await toApiError(new Response('<html>Bad Gateway</html>', { status: 502 }))
    expect(error).toMatchObject({ code: 'UNKNOWN', status: 502 })
    expect(error.message).toMatch(/serveur/)
  })

  it('considère UNAUTHENTICATED comme une session à renouveler', async () => {
    const error = await toApiError(
      json(401, { error: { code: 'UNAUTHENTICATED', message: 'Reconnectez-vous.' } }),
    )
    expect(error.needsLogin).toBe(true)
  })
})

describe('errorMessage', () => {
  it('masque le détail des erreurs inattendues', () => {
    expect(errorMessage(new Error('stack interne'))).toBe('Une erreur inattendue est survenue.')
    expect(errorMessage(new ApiError(400, 'VALIDATION_ERROR', 'Titre requis.'))).toBe(
      'Titre requis.',
    )
  })
})
