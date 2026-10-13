import { LIMITS } from '@quizlet/shared'
import { beforeEach, describe, expect, it } from 'vitest'
import { createTestClient, readJson } from '../test/app'
import { useTestDb } from '../test/test-db'

const db = useTestDb()

interface TagJson {
  id: string
  name: string
}
interface SetJson {
  id: string
  title: string
  tags: TagJson[]
  cards: Array<{ id: string; term: string; definition: string }>
}

let request: ReturnType<typeof createTestClient>['request']

beforeEach(() => {
  ;({ request } = createTestClient(db))
})

function setBody(title: string, tags?: string[], visibility = 'private') {
  return { title, description: null, visibility, cards: [], ...(tags ? { tags } : {}) }
}

async function createSetAs(username: string, body: object): Promise<SetJson> {
  const res = await request('/api/sets', { method: 'POST', as: username, body })
  expect(res.status).toBe(201)
  return (await readJson<{ set: SetJson }>(res)).set
}

async function tagsOf(username: string) {
  const res = await request('/api/tags', { as: username })
  return (await readJson<{ tags: Array<TagJson & { setCount: number }> }>(res)).tags
}

async function titlesWithTags(username: string, tagIds: string[]) {
  const res = await request(`/api/sets?tags=${tagIds.join(',')}`, { as: username })
  return (await readJson<{ sets: SetJson[] }>(res)).sets.map((set) => set.title).sort()
}

describe('tags des sets', () => {
  it('crée les tags à la volée, sans doublon de casse, et les renvoie triés', async () => {
    const set = await createSetAs(
      'alice',
      setBody('Anglais', ['vocabulaire', 'Anglais', 'anglais']),
    )
    expect(set.tags.map((tag) => tag.name)).toEqual(['Anglais', 'vocabulaire'])

    // Un tag existant est réutilisé, avec son orthographe d'origine.
    const other = await createSetAs('alice', setBody('Phrasal verbs', ['ANGLAIS']))
    expect(other.tags).toEqual([set.tags[0]])
    expect((await tagsOf('alice')).map(({ name, setCount }) => ({ name, setCount }))).toEqual([
      { name: 'Anglais', setCount: 2 },
      { name: 'vocabulaire', setCount: 1 },
    ])
  })

  it('remplace les tags au PUT, et les conserve si le champ est absent', async () => {
    const set = await createSetAs('alice', setBody('Anglais', ['langues']))
    const keep = await request(`/api/sets/${set.id}`, {
      method: 'PUT',
      as: 'alice',
      body: setBody('Anglais (bis)'),
    })
    expect((await readJson<{ set: SetJson }>(keep)).set.tags.map((tag) => tag.name)).toEqual([
      'langues',
    ])

    const replace = await request(`/api/sets/${set.id}`, {
      method: 'PUT',
      as: 'alice',
      body: setBody('Anglais', ['oral']),
    })
    expect((await readJson<{ set: SetJson }>(replace)).set.tags.map((tag) => tag.name)).toEqual([
      'oral',
    ])
  })

  it('limite le nombre et la longueur des tags', async () => {
    const tooMany = Array.from({ length: LIMITS.tagsPerSet + 1 }, (_, i) => `tag${i}`)
    const res = await request('/api/sets', {
      method: 'POST',
      as: 'alice',
      body: setBody('Trop de tags', tooMany),
    })
    expect(res.status).toBe(400)
    const tooLong = await request('/api/sets', {
      method: 'POST',
      as: 'alice',
      body: setBody('Tag trop long', ['x'.repeat(LIMITS.tagName + 1)]),
    })
    expect(tooLong.status).toBe(400)
  })

  it('filtre la bibliothèque par un ou plusieurs tags (le set doit tous les porter)', async () => {
    const both = await createSetAs('alice', setBody('Anglais oral', ['anglais', 'oral']))
    await createSetAs('alice', setBody('Anglais écrit', ['anglais']))
    await createSetAs('alice', setBody('Chimie'))
    const [anglais, oral] = both.tags

    expect(await titlesWithTags('alice', [anglais?.id ?? ''])).toEqual([
      'Anglais oral',
      'Anglais écrit',
    ])
    expect(await titlesWithTags('alice', [anglais?.id ?? '', oral?.id ?? ''])).toEqual([
      'Anglais oral',
    ])
  })

  it('supprimer un tag le retire des sets, sans supprimer les sets', async () => {
    const set = await createSetAs('alice', setBody('Anglais', ['anglais', 'oral']))
    const [anglais] = set.tags
    const res = await request(`/api/tags/${anglais?.id}`, { method: 'DELETE', as: 'alice' })
    expect(res.status).toBe(204)

    const reloaded = await readJson<{ set: SetJson }>(
      await request(`/api/sets/${set.id}`, { as: 'alice' }),
    )
    expect(reloaded.set.tags.map((tag) => tag.name)).toEqual(['oral'])
  })

  it("isole les tags de chaque utilisateur, y compris sur un set public d'autrui", async () => {
    const set = await createSetAs('alice', setBody('Public', ['secret'], 'public'))
    const [secret] = set.tags

    expect(await tagsOf('bob')).toEqual([])
    expect((await request(`/api/tags/${secret?.id}`, { method: 'DELETE', as: 'bob' })).status).toBe(
      404,
    )
    const asBob = await readJson<{ set: SetJson }>(
      await request(`/api/sets/${set.id}`, { as: 'bob' }),
    )
    expect(asBob.set.tags).toEqual([])
    // Le même nom chez Bob est un autre tag.
    const bobSet = await createSetAs('bob', setBody('Set de Bob', ['secret']))
    expect(bobSet.tags[0]?.id).not.toBe(secret?.id)
  })
})
