import { IMPORT_MAX_BYTES, LIMITS } from '@quizlet/shared'
import { asc, eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { cards } from '../db/schema'
import { createTestClient, readJson } from '../test/app'
import { useTestDb } from '../test/test-db'

const db = useTestDb()

const tsv = { term: '\t', card: '\n' }
interface ImportJson {
  set: { id: string }
  imported: number
  skipped: number
}

let request: ReturnType<typeof createTestClient>['request']

beforeEach(() => {
  ;({ request } = createTestClient(db))
})

async function createSetAs(username: string, visibility = 'private', cardList: object[] = []) {
  const res = await request('/api/sets', {
    method: 'POST',
    as: username,
    body: { title: 'Vocabulaire', description: null, visibility, cards: cardList },
  })
  return (await readJson<{ set: { id: string } }>(res)).set.id
}

function storedCards(setId: string) {
  return db
    .select({ term: cards.term, definition: cards.definition, position: cards.position })
    .from(cards)
    .where(eq(cards.setId, setId))
    .orderBy(asc(cards.position))
}

describe('POST /api/sets/import', () => {
  it('crée un set privé avec les cartes valides et compte les lignes ignorées', async () => {
    const res = await request('/api/sets/import', {
      method: 'POST',
      as: 'alice',
      body: {
        title: 'Anglais',
        text: 'cat\tchat\r\n\r\ndog\tchien\nsans définition\n',
        separators: tsv,
      },
    })
    expect(res.status).toBe(201)
    const body = await readJson<ImportJson>(res)
    expect(body).toMatchObject({ imported: 2, skipped: 1 })
    expect(await storedCards(body.set.id)).toEqual([
      { term: 'cat', definition: 'chat', position: 0 },
      { term: 'dog', definition: 'chien', position: 1 },
    ])
    const set = await readJson<{ set: { visibility: string; isOwner: boolean } }>(
      await request(`/api/sets/${body.set.id}`, { as: 'alice' }),
    )
    expect(set.set).toMatchObject({ visibility: 'private', isOwner: true })
  })

  it('parse lui-même le texte avec les séparateurs reçus (CSV entre guillemets)', async () => {
    const res = await request('/api/sets/import', {
      method: 'POST',
      as: 'alice',
      body: {
        title: 'Capitales',
        text: '"France; métropole";Paris\nItalie;"Rome"',
        separators: { term: ';', card: '\n' },
      },
    })
    const body = await readJson<ImportJson>(res)
    expect(await storedCards(body.set.id)).toEqual([
      { term: 'France; métropole', definition: 'Paris', position: 0 },
      { term: 'Italie', definition: 'Rome', position: 1 },
    ])
  })

  it('refuse un import sans carte valide, des séparateurs invalides ou un titre vide', async () => {
    const post = (body: object) =>
      request('/api/sets/import', { method: 'POST', as: 'alice', body })
    expect((await post({ title: 'Vide', text: 'pas de séparateur', separators: tsv })).status).toBe(
      400,
    )
    expect(
      (await post({ title: 'Idem', text: 'a,b', separators: { term: ',', card: ',' } })).status,
    ).toBe(400)
    expect(
      (await post({ title: 'Vide', text: 'a\tb', separators: { term: '', card: '\n' } })).status,
    ).toBe(400)
    expect((await post({ title: ' ', text: 'a\tb', separators: tsv })).status).toBe(400)
  })

  it(`limite un import à ${LIMITS.cards} cartes et 1 Mo`, async () => {
    const tooMany = Array.from({ length: LIMITS.cards + 1 }, (_, i) => `t${i}\td${i}`).join('\n')
    const res = await request('/api/sets/import', {
      method: 'POST',
      as: 'alice',
      body: { title: 'Trop', text: tooMany, separators: tsv },
    })
    expect(res.status).toBe(400)

    const tooBig = await request('/api/sets/import', {
      method: 'POST',
      as: 'alice',
      body: { title: 'Lourd', text: `a\t${'é'.repeat(IMPORT_MAX_BYTES / 2)}`, separators: tsv },
    })
    expect(tooBig.status).toBe(400)
  })
})

describe('POST /api/sets/:id/import', () => {
  it('ajoute les cartes à la fin du set existant', async () => {
    const setId = await createSetAs('alice', 'private', [{ term: 'cat', definition: 'chat' }])
    const res = await request(`/api/sets/${setId}/import`, {
      method: 'POST',
      as: 'alice',
      body: { text: 'dog,chien\nbird,oiseau', separators: { term: ',', card: '\n' } },
    })
    expect(res.status).toBe(200)
    expect(await readJson<ImportJson>(res)).toEqual({ set: { id: setId }, imported: 2, skipped: 0 })
    expect((await storedCards(setId)).map((card) => [card.term, card.position])).toEqual([
      ['cat', 0],
      ['dog', 1],
      ['bird', 2],
    ])
  })

  it('refuse de dépasser la limite de cartes du set, sans rien importer', async () => {
    const setId = await createSetAs(
      'alice',
      'private',
      Array.from({ length: LIMITS.cards - 1 }, (_, i) => ({ term: `t${i}`, definition: 'd' })),
    )
    const res = await request(`/api/sets/${setId}/import`, {
      method: 'POST',
      as: 'alice',
      body: { text: 'a\tb\nc\td', separators: tsv },
    })
    expect(res.status).toBe(400)
    expect(await storedCards(setId)).toHaveLength(LIMITS.cards - 1)
  })

  it("protège les sets d'autrui : 404 si privé, 403 si public", async () => {
    const privateSet = await createSetAs('alice')
    const publicSet = await createSetAs('alice', 'public')
    const body = { text: 'a\tb', separators: tsv }

    const onPrivate = await request(`/api/sets/${privateSet}/import`, {
      method: 'POST',
      as: 'bob',
      body,
    })
    expect(onPrivate.status).toBe(404)
    const onPublic = await request(`/api/sets/${publicSet}/import`, {
      method: 'POST',
      as: 'bob',
      body,
    })
    expect(onPublic.status).toBe(403)
    expect(await storedCards(privateSet)).toEqual([])
    expect(await storedCards(publicSet)).toEqual([])
  })
})
