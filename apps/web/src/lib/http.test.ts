import { ApiError } from '@quizlet/shared'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiFetch } from './http'

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
