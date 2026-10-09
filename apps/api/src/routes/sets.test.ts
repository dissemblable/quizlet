import { LIMITS } from '@quizlet/shared'
import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { cards, sets } from '../db/schema'
import { copyTitle } from '../services/sets'
import { createTestClient, readJson } from '../test/app'
import { useTestDb } from '../test/test-db'

const db = useTestDb()

interface SetJson {
  id: string
  title: string
  description: string | null
  visibility: 'private' | 'public'
  owner: { displayName: string }
  isOwner: boolean
  cards: Array<{ id: string; term: string; definition: string }>
}
interface ErrorJson {
  error: { code: string; message: string; details?: { issues: Array<{ path: string }> } }
}

const capitals = {
  title: 'Capitales',
  description: 'Europe',
  visibility: 'private' as const,
  cards: [
    { term: 'France', definition: 'Paris' },
    { term: 'Italie', definition: 'Rome' },
    { term: 'Espagne', definition: 'Madrid' },
  ],
}

let request: ReturnType<typeof createTestClient>['request']

beforeEach(() => {
  ;({ request } = createTestClient(db))
})

async function createSetAs(username: string, body: object = capitals): Promise<SetJson> {
  const res = await request('/api/sets', { method: 'POST', as: username, body })
  expect(res.status).toBe(201)
  return (await readJson<{ set: SetJson }>(res)).set
}

describe('POST /api/sets', () => {
  it('crée un set avec ses cartes dans l’ordre', async () => {
    const set = await createSetAs('alice')
    expect(set).toMatchObject({ title: 'Capitales', visibility: 'private', isOwner: true })
    expect(set.owner.displayName).toBe('Alice')
    expect(set.cards.map((card) => card.term)).toEqual(['France', 'Italie', 'Espagne'])
  })

  it('valide le contenu et renvoie le détail par champ', async () => {
    const res = await request('/api/sets', {
      method: 'POST',
      as: 'alice',
      body: { ...capitals, title: ' ', cards: [{ term: 'France', definition: '' }] },
    })
    expect(res.status).toBe(400)
    const body = await readJson<ErrorJson>(res)
    expect(body.error.code).toBe('VALIDATION_ERROR')
    expect(body.error.details?.issues.map((issue) => issue.path)).toEqual([
      'title',
      'cards.0.definition',
    ])
  })

  it('refuse une requête venant d’un autre site', async () => {
    const res = await request('/api/sets', {
      method: 'POST',
      as: 'alice',
      body: capitals,
      headers: { 'sec-fetch-site': 'same-site', origin: 'https://autre.quizlet.test' },
    })
    expect(res.status).toBe(403)
    expect(await db.select().from(sets)).toHaveLength(0)
  })
})

describe('GET /api/sets/:id', () => {
  it("permet à l'auteur de lire son set privé", async () => {
    const set = await createSetAs('alice')
    const res = await request(`/api/sets/${set.id}`, { as: 'alice' })
    expect(res.status).toBe(200)
    expect((await readJson<{ set: SetJson }>(res)).set.cards).toHaveLength(3)
  })

  it('répond 404 (et non 403) à un autre utilisateur sur un set privé', async () => {
    const set = await createSetAs('alice')
    const res = await request(`/api/sets/${set.id}`, { as: 'bob' })
    expect(res.status).toBe(404)
    expect((await readJson<ErrorJson>(res)).error.code).toBe('NOT_FOUND')
  })

  it('rend un set public lisible par tout utilisateur authentifié, en lecture seule', async () => {
    const set = await createSetAs('alice', { ...capitals, visibility: 'public' })
    const res = await request(`/api/sets/${set.id}`, { as: 'bob' })
    expect(res.status).toBe(200)
    expect((await readJson<{ set: SetJson }>(res)).set).toMatchObject({
      isOwner: false,
      owner: { displayName: 'Alice' },
    })
  })

  it('répond 404 pour un identifiant mal formé ou inconnu', async () => {
    expect((await request('/api/sets/42', { as: 'alice' })).status).toBe(404)
    const unknown = '9b2f8f4e-3c1a-4d7e-9a5b-1c2d3e4f5a6b'
    expect((await request(`/api/sets/${unknown}`, { as: 'alice' })).status).toBe(404)
  })

  it('exige une identité', async () => {
    const set = await createSetAs('alice', { ...capitals, visibility: 'public' })
    expect((await request(`/api/sets/${set.id}`)).status).toBe(401)
  })
})

describe('PUT /api/sets/:id', () => {
  it('modifie, ajoute, supprime et réordonne les cartes en conservant leurs identifiants', async () => {
    const set = await createSetAs('alice')
    const [france, italie] = set.cards
    const res = await request(`/api/sets/${set.id}`, {
      method: 'PUT',
      as: 'alice',
      body: {
        title: 'Capitales européennes',
        description: '',
        visibility: 'public',
        cards: [
          { id: italie?.id, term: 'Italie', definition: 'Rome' },
          { term: 'Portugal', definition: 'Lisbonne' },
          { id: france?.id, term: 'France', definition: 'Paris (Île-de-France)' },
        ],
      },
    })
    expect(res.status).toBe(200)
    const updated = (await readJson<{ set: SetJson }>(res)).set
    expect(updated).toMatchObject({
      title: 'Capitales européennes',
      description: null,
      visibility: 'public',
    })
    expect(updated.cards.map((card) => card.term)).toEqual(['Italie', 'Portugal', 'France'])
    expect(updated.cards[0]?.id).toBe(italie?.id)
    expect(updated.cards[2]).toEqual({
      id: france?.id,
      term: 'France',
      definition: 'Paris (Île-de-France)',
    })
    // « Espagne » a été supprimée.
    expect(await db.select().from(cards).where(eq(cards.setId, set.id))).toHaveLength(3)
  })

  it("interdit (403) la modification d'un set public par un autre utilisateur", async () => {
    const set = await createSetAs('alice', { ...capitals, visibility: 'public' })
    const res = await request(`/api/sets/${set.id}`, {
      method: 'PUT',
      as: 'bob',
      body: { ...capitals, title: 'Piraté' },
    })
    expect(res.status).toBe(403)
    const [stored] = await db.select().from(sets).where(eq(sets.id, set.id))
    expect(stored?.title).toBe('Capitales')
  })

  it("répond 404 à la modification d'un set privé d'un autre utilisateur", async () => {
    const set = await createSetAs('alice')
    const res = await request(`/api/sets/${set.id}`, { method: 'PUT', as: 'bob', body: capitals })
    expect(res.status).toBe(404)
  })

  it("ne permet pas de récupérer ou modifier la carte d'un autre set via son identifiant", async () => {
    const aliceSet = await createSetAs('alice')
    const bobSet = await createSetAs('bob', { ...capitals, title: 'Set de Bob', cards: [] })
    const stolenId = aliceSet.cards[0]?.id

    const res = await request(`/api/sets/${bobSet.id}`, {
      method: 'PUT',
      as: 'bob',
      body: { ...capitals, cards: [{ id: stolenId, term: 'Volé', definition: 'Volé' }] },
    })
    expect(res.status).toBe(200)
    const [bobCard] = (await readJson<{ set: SetJson }>(res)).set.cards
    expect(bobCard?.id).not.toBe(stolenId)

    const [aliceCard] = await db
      .select()
      .from(cards)
      .where(eq(cards.id, stolenId ?? ''))
    expect(aliceCard).toMatchObject({ setId: aliceSet.id, term: 'France', definition: 'Paris' })
  })
})

describe('DELETE /api/sets/:id', () => {
  it('supprime le set et ses cartes', async () => {
    const set = await createSetAs('alice')
    const res = await request(`/api/sets/${set.id}`, { method: 'DELETE', as: 'alice' })
    expect(res.status).toBe(204)
    expect(await db.select().from(sets)).toHaveLength(0)
    expect(await db.select().from(cards)).toHaveLength(0)
  })

  it("protège le set d'un autre utilisateur (403 s'il est public, 404 s'il est privé)", async () => {
    const publicSet = await createSetAs('alice', { ...capitals, visibility: 'public' })
    const privateSet = await createSetAs('alice')
    expect(
      (await request(`/api/sets/${publicSet.id}`, { method: 'DELETE', as: 'bob' })).status,
    ).toBe(403)
    expect(
      (await request(`/api/sets/${privateSet.id}`, { method: 'DELETE', as: 'bob' })).status,
    ).toBe(404)
    expect(await db.select().from(sets)).toHaveLength(2)
  })
})

describe('POST /api/sets/:id/duplicate', () => {
  it("copie un set public dans la bibliothèque d'un autre utilisateur, en privé", async () => {
    const original = await createSetAs('alice', { ...capitals, visibility: 'public' })
    const res = await request(`/api/sets/${original.id}/duplicate`, { method: 'POST', as: 'bob' })
    expect(res.status).toBe(201)
    const copy = (await readJson<{ set: SetJson }>(res)).set
    expect(copy).toMatchObject({
      title: 'Capitales (copie)',
      description: 'Europe',
      visibility: 'private',
      isOwner: true,
      owner: { displayName: 'Bob' },
    })
    expect(copy.id).not.toBe(original.id)
    expect(copy.cards.map((card) => card.term)).toEqual(['France', 'Italie', 'Espagne'])
    expect(copy.cards.map((card) => card.id)).not.toContain(original.cards[0]?.id)
  })

  it("refuse (404) de dupliquer le set privé d'un autre utilisateur", async () => {
    const set = await createSetAs('alice')
    expect(
      (await request(`/api/sets/${set.id}/duplicate`, { method: 'POST', as: 'bob' })).status,
    ).toBe(404)
  })

  it("permet à l'auteur de dupliquer son propre set privé", async () => {
    const set = await createSetAs('alice')
    expect(
      (await request(`/api/sets/${set.id}/duplicate`, { method: 'POST', as: 'alice' })).status,
    ).toBe(201)
  })
})

describe('copyTitle', () => {
  it('ajoute le suffixe sans dépasser la longueur maximale', () => {
    expect(copyTitle('Capitales')).toBe('Capitales (copie)')
    const long = copyTitle('x'.repeat(LIMITS.title))
    expect(long.length).toBe(LIMITS.title)
    expect(long.endsWith(' (copie)')).toBe(true)
  })

  it('ne coupe pas un emoji en deux', () => {
    const title = `${'x'.repeat(LIMITS.title - 9)}😀😀`
    expect(copyTitle(title)).toBe(`${'x'.repeat(LIMITS.title - 9)} (copie)`)
  })
})
