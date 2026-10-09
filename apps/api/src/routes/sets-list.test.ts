import { LIMITS } from '@quizlet/shared'
import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { sets } from '../db/schema'
import { escapeLike } from '../services/sets'
import { createTestClient, readJson } from '../test/app'
import { useTestDb } from '../test/test-db'

const db = useTestDb()

interface ListJson {
  sets: Array<{ id: string; title: string; visibility: string; cardCount: number }>
}

let request: ReturnType<typeof createTestClient>['request']

beforeEach(() => {
  ;({ request } = createTestClient(db))
})

async function createSetAs(username: string, title: string, cardCount = 2, visibility = 'private') {
  const cards = Array.from({ length: cardCount }, (_, i) => ({
    term: `t${i}`,
    definition: `d${i}`,
  }))
  const res = await request('/api/sets', {
    method: 'POST',
    as: username,
    body: { title, description: null, visibility, cards },
  })
  return (await readJson<{ set: { id: string } }>(res)).set.id
}

async function listAs(username: string, query = '') {
  const res = await request(`/api/sets${query}`, { as: username })
  return { status: res.status, body: await readJson<ListJson>(res) }
}

describe('GET /api/sets', () => {
  it('liste uniquement mes sets, avec leur nombre de cartes', async () => {
    await createSetAs('alice', 'Vocabulaire', 3)
    await createSetAs('alice', 'Brouillon', 0)
    await createSetAs('bob', 'Set public de Bob', 5, 'public')

    const { status, body } = await listAs('alice')
    expect(status).toBe(200)
    expect(body.sets.map(({ title, cardCount }) => ({ title, cardCount }))).toEqual(
      expect.arrayContaining([
        { title: 'Vocabulaire', cardCount: 3 },
        { title: 'Brouillon', cardCount: 0 },
      ]),
    )
    expect(body.sets).toHaveLength(2)
  })

  it('trie du plus récemment modifié au plus ancien', async () => {
    const first = await createSetAs('alice', 'Premier')
    await createSetAs('alice', 'Second')
    await db.update(sets).set({ title: 'Premier (modifié)' }).where(eq(sets.id, first))

    const { body } = await listAs('alice')
    expect(body.sets.map((set) => set.title)).toEqual(['Premier (modifié)', 'Second'])
  })

  it('cherche dans les titres sans tenir compte de la casse', async () => {
    await createSetAs('alice', 'Capitales européennes')
    await createSetAs('alice', 'Chimie')
    const { body } = await listAs('alice', '?q=CAPITALES')
    expect(body.sets.map((set) => set.title)).toEqual(['Capitales européennes'])
  })

  it('traite % et _ comme des caractères ordinaires', async () => {
    await createSetAs('alice', '100% maths')
    await createSetAs('alice', 'Histoire')
    await createSetAs('alice', 'snake_case')

    expect((await listAs('alice', '?q=%25')).body.sets.map((s) => s.title)).toEqual(['100% maths'])
    expect((await listAs('alice', '?q=_')).body.sets.map((s) => s.title)).toEqual(['snake_case'])
  })

  it('ignore une recherche vide et refuse une recherche trop longue', async () => {
    await createSetAs('alice', 'Vocabulaire')
    expect((await listAs('alice', '?q=')).body.sets).toHaveLength(1)
    expect((await listAs('alice', `?q=${'x'.repeat(LIMITS.search + 1)}`)).status).toBe(400)
  })

  it('renvoie une liste vide à un nouvel utilisateur', async () => {
    expect((await listAs('carol')).body.sets).toEqual([])
  })
})

describe('escapeLike', () => {
  it('échappe les jokers et la barre oblique inverse', () => {
    expect(escapeLike('50%_off\\')).toBe('50\\%\\_off\\\\')
  })
})
