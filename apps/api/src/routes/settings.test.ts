import { DEFAULT_SETTINGS } from '@quizlet/shared'
import { beforeEach, describe, expect, it } from 'vitest'
import { createTestClient, readJson } from '../test/app'
import { useTestDb } from '../test/test-db'

const db = useTestDb()

let request: ReturnType<typeof createTestClient>['request']

beforeEach(() => {
  ;({ request } = createTestClient(db))
})

async function settingsOf(username: string) {
  const res = await request('/api/settings', { as: username })
  return (await readJson<{ settings: Record<string, unknown> }>(res)).settings
}

function save(username: string, settings: object) {
  return request('/api/settings', {
    method: 'PUT',
    as: username,
    body: { ...DEFAULT_SETTINGS, ...settings },
  })
}

describe('/api/settings', () => {
  it('renvoie les valeurs par défaut, sans fuseau choisi', async () => {
    expect(await settingsOf('alice')).toEqual({ ...DEFAULT_SETTINGS, timezone: null })
  })

  it('enregistre les paramètres de chaque utilisateur séparément', async () => {
    const res = await save('alice', {
      timezone: 'America/Montreal',
      newCardsPerDay: 5,
      reviewsPerDay: 50,
      desiredRetention: 0.85,
    })
    expect(res.status).toBe(200)
    expect(await settingsOf('alice')).toEqual({
      timezone: 'America/Montreal',
      newCardsPerDay: 5,
      reviewsPerDay: 50,
      desiredRetention: 0.85,
    })
    expect(await settingsOf('bob')).toEqual({ ...DEFAULT_SETTINGS, timezone: null })
  })

  it('refuse un fuseau inconnu et des valeurs hors bornes', async () => {
    expect((await save('alice', { timezone: 'Mars/Olympus' })).status).toBe(400)
    expect((await save('alice', { newCardsPerDay: -1 })).status).toBe(400)
    expect((await save('alice', { reviewsPerDay: 10_000 })).status).toBe(400)
    expect((await save('alice', { desiredRetention: 0.5 })).status).toBe(400)
    expect(await settingsOf('alice')).toEqual({ ...DEFAULT_SETTINGS, timezone: null })
  })

  it('exige une identité et la même origine pour modifier', async () => {
    expect((await request('/api/settings')).status).toBe(401)
    const crossSite = await request('/api/settings', {
      method: 'PUT',
      as: 'alice',
      body: DEFAULT_SETTINGS,
      headers: { 'sec-fetch-site': 'cross-site' },
    })
    expect(crossSite.status).toBe(403)
  })
})
