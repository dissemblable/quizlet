import { beforeEach, describe, expect, it } from 'vitest'
import { createTestClient, readJson } from '../test/app'
import { useTestDb } from '../test/test-db'

const db = useTestDb()

interface FolderJson {
  id: string
  name: string
  setCount: number
}
interface ListJson {
  sets: Array<{ id: string; title: string; folderId: string | null }>
}

let request: ReturnType<typeof createTestClient>['request']

beforeEach(() => {
  ;({ request } = createTestClient(db))
})

async function createFolderAs(username: string, name: string): Promise<FolderJson> {
  const res = await request('/api/folders', { method: 'POST', as: username, body: { name } })
  expect(res.status).toBe(201)
  return (await readJson<{ folder: FolderJson }>(res)).folder
}

async function createSetAs(username: string, title: string, visibility = 'private') {
  const res = await request('/api/sets', {
    method: 'POST',
    as: username,
    body: { title, description: null, visibility, cards: [] },
  })
  return (await readJson<{ set: { id: string } }>(res)).set.id
}

function moveAs(username: string, setId: string, folderId: string | null) {
  return request(`/api/sets/${setId}/folder`, {
    method: 'PUT',
    as: username,
    body: { folderId },
  })
}

async function listAs(username: string, query = '') {
  const res = await request(`/api/sets${query}`, { as: username })
  return (await readJson<ListJson>(res)).sets.map((set) => set.title)
}

describe('/api/folders', () => {
  it('crée, renomme, liste (avec le nombre de sets) et supprime mes dossiers', async () => {
    const langues = await createFolderAs('alice', '  Langues ')
    expect(langues).toMatchObject({ name: 'Langues', setCount: 0 })
    await createFolderAs('alice', 'Anglais')
    await moveAs('alice', await createSetAs('alice', 'Vocabulaire'), langues.id)

    const renamed = await request(`/api/folders/${langues.id}`, {
      method: 'PATCH',
      as: 'alice',
      body: { name: 'Langues vivantes' },
    })
    expect(renamed.status).toBe(200)

    const res = await request('/api/folders', { as: 'alice' })
    const { folders } = await readJson<{ folders: FolderJson[] }>(res)
    expect(folders.map(({ name, setCount }) => ({ name, setCount }))).toEqual([
      { name: 'Anglais', setCount: 0 },
      { name: 'Langues vivantes', setCount: 1 },
    ])

    expect(
      (await request(`/api/folders/${langues.id}`, { method: 'DELETE', as: 'alice' })).status,
    ).toBe(204)
    const remaining = await readJson<{ folders: FolderJson[] }>(
      await request('/api/folders', { as: 'alice' }),
    )
    expect(remaining.folders.map((folder) => folder.name)).toEqual(['Anglais'])
  })

  it('valide le nom du dossier', async () => {
    const res = await request('/api/folders', { method: 'POST', as: 'alice', body: { name: ' ' } })
    expect(res.status).toBe(400)
  })

  it("isole les dossiers de chaque utilisateur (404 sur le dossier d'un autre)", async () => {
    const folder = await createFolderAs('alice', 'Privé')
    const bobList = await readJson<{ folders: FolderJson[] }>(
      await request('/api/folders', { as: 'bob' }),
    )
    expect(bobList.folders).toEqual([])

    const rename = await request(`/api/folders/${folder.id}`, {
      method: 'PATCH',
      as: 'bob',
      body: { name: 'Piraté' },
    })
    expect(rename.status).toBe(404)
    expect(
      (await request(`/api/folders/${folder.id}`, { method: 'DELETE', as: 'bob' })).status,
    ).toBe(404)
  })
})

describe('PUT /api/sets/:id/folder', () => {
  it('range un set dans un dossier puis l’en sort ; la bibliothèque filtre par dossier', async () => {
    const folder = await createFolderAs('alice', 'Langues')
    const anglais = await createSetAs('alice', 'Anglais')
    await createSetAs('alice', 'Chimie')

    expect((await moveAs('alice', anglais, folder.id)).status).toBe(204)
    expect(await listAs('alice', `?folder=${folder.id}`)).toEqual(['Anglais'])
    expect(await listAs('alice', '?folder=none')).toEqual(['Chimie'])
    expect(await listAs('alice')).toHaveLength(2)

    await moveAs('alice', anglais, null)
    expect(await listAs('alice', `?folder=${folder.id}`)).toEqual([])
  })

  it('remet les sets « sans dossier » quand leur dossier est supprimé', async () => {
    const folder = await createFolderAs('alice', 'Langues')
    const anglais = await createSetAs('alice', 'Anglais')
    await moveAs('alice', anglais, folder.id)

    await request(`/api/folders/${folder.id}`, { method: 'DELETE', as: 'alice' })
    expect(await listAs('alice', '?folder=none')).toEqual(['Anglais'])
  })

  it("refuse le dossier d'un autre utilisateur et protège les sets d'autrui", async () => {
    const bobFolder = await createFolderAs('bob', 'Dossier de Bob')
    const aliceSet = await createSetAs('alice', 'Anglais')
    expect((await moveAs('alice', aliceSet, bobFolder.id)).status).toBe(404)

    const alicePublic = await createSetAs('alice', 'Public', 'public')
    expect((await moveAs('bob', alicePublic, bobFolder.id)).status).toBe(403)
    expect((await moveAs('bob', aliceSet, bobFolder.id)).status).toBe(404)
  })

  it("ne révèle pas le dossier d'un set public à un autre lecteur", async () => {
    const folder = await createFolderAs('alice', 'Langues')
    const set = await createSetAs('alice', 'Public', 'public')
    await moveAs('alice', set, folder.id)

    const asBob = await readJson<{ set: { folderId: string | null } }>(
      await request(`/api/sets/${set}`, { as: 'bob' }),
    )
    expect(asBob.set.folderId).toBeNull()
    const asAlice = await readJson<{ set: { folderId: string | null } }>(
      await request(`/api/sets/${set}`, { as: 'alice' }),
    )
    expect(asAlice.set.folderId).toBe(folder.id)
  })
})
