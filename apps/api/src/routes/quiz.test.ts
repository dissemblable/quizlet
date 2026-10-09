import { beforeEach, describe, expect, it } from 'vitest'
import { createTestClient, readJson } from '../test/app'
import { useTestDb } from '../test/test-db'

const db = useTestDb()

interface QuizJson {
  questions: Array<{ cardId: string; term: string; choices: string[]; answerIndex: number }>
}

const capitals = [
  { term: 'France', definition: 'Paris' },
  { term: 'Italie', definition: 'Rome' },
  { term: 'Espagne', definition: 'Madrid' },
  { term: 'Portugal', definition: 'Lisbonne' },
  { term: 'Grèce', definition: 'Athènes' },
]

let request: ReturnType<typeof createTestClient>['request']

beforeEach(() => {
  ;({ request } = createTestClient(db))
})

async function createSetAs(username: string, visibility: string, cards = capitals) {
  const res = await request('/api/sets', {
    method: 'POST',
    as: username,
    body: { title: 'Capitales', description: null, visibility, cards },
  })
  return (await readJson<{ set: { id: string } }>(res)).set.id
}

describe('GET /api/sets/:id/quiz', () => {
  it("génère un QCM par carte pour l'auteur", async () => {
    const id = await createSetAs('alice', 'private')
    const res = await request(`/api/sets/${id}/quiz`, { as: 'alice' })
    expect(res.status).toBe(200)

    const { questions } = await readJson<QuizJson>(res)
    expect(questions).toHaveLength(capitals.length)
    for (const question of questions) {
      const card = capitals.find((c) => c.term === question.term)
      expect(question.choices).toHaveLength(4)
      expect(question.choices[question.answerIndex]).toBe(card?.definition)
    }
  })

  it('génère un nouveau tirage à chaque appel', async () => {
    const id = await createSetAs('alice', 'private')
    const draws = new Set<string>()
    for (let i = 0; i < 5; i++) {
      draws.add(
        JSON.stringify(
          await readJson<QuizJson>(await request(`/api/sets/${id}/quiz`, { as: 'alice' })),
        ),
      )
    }
    expect(draws.size).toBeGreaterThan(1)
  })

  it("est accessible à tout utilisateur sur un set public, mais pas sur un set privé d'un autre", async () => {
    const publicId = await createSetAs('alice', 'public')
    const privateId = await createSetAs('alice', 'private')
    expect((await request(`/api/sets/${publicId}/quiz`, { as: 'bob' })).status).toBe(200)
    expect((await request(`/api/sets/${privateId}/quiz`, { as: 'bob' })).status).toBe(404)
  })

  it('répond 422 avec un message clair quand le set a moins de 4 cartes', async () => {
    const id = await createSetAs('alice', 'private', capitals.slice(0, 3))
    const res = await request(`/api/sets/${id}/quiz`, { as: 'alice' })
    expect(res.status).toBe(422)
    expect(await readJson(res)).toMatchObject({
      error: { code: 'QUIZ_NOT_ENOUGH_CARDS', message: expect.stringContaining('au moins 4') },
    })
  })
})
