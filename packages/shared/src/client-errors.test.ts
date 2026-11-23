import { describe, expect, it } from 'vitest'
import { ApiError, errorMessage, toApiError, unwrap } from './client-errors'

// Le package n'a pas les types DOM de `Response` : de simples objets tiennent lieu de réponses.
const json = (status: number, body: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async (): Promise<unknown> => body,
})

/** Réponse sans corps JSON (204, page d'erreur d'un proxy) : `json()` échoue. */
const notJson = (status: number) => ({
  ok: status >= 200 && status < 300,
  status,
  json: (): Promise<unknown> => Promise.reject(new SyntaxError('Unexpected end of JSON input')),
})

describe('unwrap', () => {
  it('renvoie le JSON des réponses réussies', async () => {
    expect(await unwrap(Promise.resolve(json(200, { ok: 1 })))).toEqual({ ok: 1 })
  })

  it('renvoie undefined pour une réponse 204', async () => {
    expect(await unwrap(Promise.resolve(notJson(204)))).toBeUndefined()
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
    const error = await toApiError(notJson(502))
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
