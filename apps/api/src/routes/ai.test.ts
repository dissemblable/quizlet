import { AI_LIMITS, type AiEvent } from '@quizlet/shared'
import { describe, expect, it, vi } from 'vitest'
import { type CardGenerator, GenerationError } from '../services/ai'
import { createTestClient, type MeBody, readJson } from '../test/app'
import { useTestDb } from '../test/test-db'

const db = useTestDb()

const result = {
  draft: { title: 'Anglais', description: null, cards: [{ term: 'cat', definition: 'chat' }] },
  skipped: 1,
}

function clientWith(generator?: CardGenerator | null) {
  return createTestClient(db, {}, { generator }).request
}

function generate(
  request: ReturnType<typeof clientWith>,
  fields: Record<string, string | File | File[]>,
  as: string | null = 'alice',
) {
  const form = new FormData()
  for (const [key, value] of Object.entries(fields)) {
    for (const item of Array.isArray(value) ? value : [value]) form.append(key, item)
  }
  return request('/api/ai/generate', { method: 'POST', as: as ?? undefined, form })
}

async function events(res: Response): Promise<AiEvent[]> {
  const text = await res.text()
  return text
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line) as AiEvent)
}

const pdf = (name: string, bytes = 10) =>
  new File([new Uint8Array(bytes)], name, { type: 'application/pdf' })

describe('POST /api/ai/generate', () => {
  it('est désactivée sans clé API, et /me le signale', async () => {
    const request = clientWith()
    const res = await generate(request, { prompt: '10 mots' })
    expect(res.status).toBe(503)
    expect(await res.json()).toMatchObject({ error: { code: 'AI_UNAVAILABLE' } })

    const me = await readJson<MeBody>(await request('/api/me', { as: 'alice' }))
    expect(me.aiEnabled).toBe(false)
  })

  it('exige une identité', async () => {
    const res = await generate(
      clientWith(async () => result),
      { prompt: '10 mots' },
      null,
    )
    expect(res.status).toBe(401)
  })

  it('diffuse la progression puis le brouillon, en NDJSON', async () => {
    const generator = vi.fn<CardGenerator>(async (_input, { onProgress }) => {
      onProgress(1)
      return result
    })
    const request = clientWith(generator)
    const res = await generate(request, {
      prompt: '  100 mots de vocabulaire  ',
      text: 'Chapitre 1',
      files: pdf('cours.pdf'),
    })

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('application/x-ndjson')
    expect(await events(res)).toEqual([
      { type: 'progress', cards: 1 },
      { type: 'done', ...result },
    ])
    const [input] = generator.mock.calls[0] ?? []
    expect(input?.prompt).toBe('100 mots de vocabulaire')
    expect(input?.text).toBe('Chapitre 1')
    expect(input?.files.map((file) => file.name)).toEqual(['cours.pdf'])

    const me = await readJson<MeBody>(await request('/api/me', { as: 'alice' }))
    expect(me.aiEnabled).toBe(true)
  })

  it('accepte plusieurs fichiers, au-delà de la limite de 1 Mo des autres routes', async () => {
    const generator = vi.fn<CardGenerator>(async () => result)
    const res = await generate(clientWith(generator), {
      prompt: 'Fiche du chapitre 1',
      files: [pdf('a.pdf', 2 * 1024 * 1024), new File(['notes'], 'b.txt', { type: 'text/plain' })],
    })
    expect(res.status).toBe(200)
    expect(generator.mock.calls[0]?.[0].files.map((file) => file.name)).toEqual(['a.pdf', 'b.txt'])
  })

  it('valide la consigne et les fichiers', async () => {
    const request = clientWith(async () => result)
    const cases: Array<Record<string, string | File | File[]>> = [
      { prompt: '   ' },
      { prompt: 'x'.repeat(AI_LIMITS.prompt + 1) },
      { prompt: 'ok', files: new File(['x'], 'cours.docx', { type: 'application/msword' }) },
      {
        prompt: 'ok',
        files: new File([new Uint8Array(AI_LIMITS.imageBytes + 1)], 'photo.png', {
          type: 'image/png',
        }),
      },
      {
        prompt: 'ok',
        files: Array.from({ length: AI_LIMITS.files + 1 }, (_, i) => pdf(`${i}.pdf`)),
      },
    ]
    for (const fields of cases) {
      const res = await generate(request, fields)
      expect(res.status).toBe(400)
      expect(await res.json()).toMatchObject({ error: { code: 'VALIDATION_ERROR' } })
    }
  })

  it('refuse une requête de plus de 20 Mo', async () => {
    const res = await generate(
      clientWith(async () => result),
      {
        prompt: 'ok',
        files: pdf('gros.pdf', AI_LIMITS.requestBytes + 1),
      },
    )
    expect(res.status).toBe(413)
    expect(await res.json()).toMatchObject({ error: { code: 'PAYLOAD_TOO_LARGE' } })
  })

  it("transmet le message d'une erreur de génération, et masque les autres", async () => {
    const failing = clientWith(async () => {
      throw new GenerationError('Réponse trop longue : demandez moins de cartes.')
    })
    expect(await events(await generate(failing, { prompt: 'ok' }))).toEqual([
      { type: 'error', message: 'Réponse trop longue : demandez moins de cartes.' },
    ])

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const crashing = clientWith(async () => {
      throw new Error('clé API invalide')
    })
    const [event] = await events(await generate(crashing, { prompt: 'ok' }))
    expect(event).toEqual({ type: 'error', message: expect.not.stringContaining('clé') })
    expect(consoleError).toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it('refuse une seconde génération simultanée du même utilisateur', async () => {
    const pending: Array<() => void> = []
    const request = clientWith(() => new Promise((resolve) => pending.push(() => resolve(result))))
    const first = await generate(request, { prompt: 'ok' })
    expect(first.status).toBe(200)

    const second = await generate(request, { prompt: 'ok' })
    expect(second.status).toBe(429)
    expect(await second.json()).toMatchObject({ error: { code: 'TOO_MANY_REQUESTS' } })
    expect((await generate(request, { prompt: 'ok' }, 'bob')).status).toBe(200)

    for (const finish of pending) finish()
    expect(await events(first)).toEqual([{ type: 'done', ...result }])
    expect((await generate(request, { prompt: 'ok' })).status).toBe(200)
  })
})
