import { onlineManager, type QueryClient } from '@tanstack/react-query'
import type { PersistedClient } from '@tanstack/react-query-persist-client'
import { afterEach, describe, expect, it } from 'vitest'
import { createOfflineClient } from './client-factory'
import type { KeyValueStorage } from './file-storage'
import { submitGrade } from './grade-flow'
import {
  createDirectPersister,
  createThrottledPersister,
  flushCache,
  PERSIST_BUSTER,
  PERSIST_KEY,
  serializeClient,
} from './persist'
import { MAX_CACHE_CHARS } from './trim'

function memoryStorage(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return {
    data,
    getItem: async (key) => data.get(key) ?? null,
    setItem: async (key, value) => void data.set(key, value),
    removeItem: async (key) => void data.delete(key),
  }
}

function bigDetail(id: string, at: number, size: number) {
  return {
    queryKey: ['sets', 'detail', id],
    queryHash: id,
    dehydratedAt: at,
    state: { data: 'x'.repeat(size), dataUpdatedAt: at, status: 'success' },
  }
}

function persisted(queries: unknown[]): PersistedClient {
  return {
    timestamp: 1,
    buster: PERSIST_BUSTER,
    clientState: { queries: queries as never, mutations: [] },
  }
}

describe('serializeClient', () => {
  it('sous la limite : JSON tel quel', () => {
    const client = persisted([bigDetail('a', 1, 10)])
    expect(serializeClient(client)).toBe(JSON.stringify(client))
  })

  it("au-dessus de la limite : le cache est élagué (détails les plus anciens d'abord)", () => {
    const part = Math.floor(MAX_CACHE_CHARS * 0.4)
    const client = persisted([
      bigDetail('vieux', 1, part),
      bigDetail('milieu', 2, part),
      bigDetail('récent', 3, part),
    ])
    const written = JSON.parse(serializeClient(client)) as PersistedClient
    expect(written.clientState.queries.map((q) => q.queryHash)).toEqual(['milieu', 'récent'])
    expect(serializeClient(client).length).toBeLessThanOrEqual(MAX_CACHE_CHARS)
  })
})

describe('persisters', () => {
  afterEach(() => onlineManager.setOnline(true))

  it('le persister temporisé écrit sous la même clé, avec la même sérialisation', async () => {
    const storage = memoryStorage()
    const client = persisted([bigDetail('a', 1, 10)])
    await createThrottledPersister(storage).persistClient(client)
    expect(storage.data.get(PERSIST_KEY)).toBe(serializeClient(client))
  })

  it('flushCache écrit tout de suite : buster, note en attente, liste blanche', async () => {
    onlineManager.setOnline(false)
    const storage = memoryStorage()
    const queryClient: QueryClient = createOfflineClient({
      postGrade: async () => ({ card: null, ignored: false }),
      whenReadyToSend: async () => {},
      report: () => {},
    })
    queryClient.setQueryData(['me'], { user: { id: 'alice' } })
    queryClient.setQueryData(['quiz', 'a', 0], ['question'])
    queryClient.setQueryData(['sets', 'list', { q: 'chat', tags: [], page: 1 }], { sets: [] })
    await submitGrade(
      { client: queryClient, isOnline: () => onlineManager.isOnline(), flush: () => {} },
      { id: 'c1', state: 'new' },
      3,
      new Date('2026-11-20T10:00:00.000Z'),
    )

    await flushCache(queryClient, storage)

    const written = JSON.parse(storage.data.get(PERSIST_KEY) ?? 'null') as PersistedClient
    expect(written.buster).toBe(PERSIST_BUSTER)
    expect(written.clientState.queries.map((q) => q.queryKey)).toEqual([['me']])
    expect(written.clientState.mutations).toHaveLength(1)
    expect(written.clientState.mutations[0]?.scope).toEqual({ id: 'review-grade' })
    expect(written.clientState.mutations[0]?.state.variables).toMatchObject({
      cardId: 'c1',
      rating: 3,
      reviewedAt: '2026-11-20T10:00:00.000Z',
      cardState: 'new',
    })
  })

  it('le persister direct relit et efface', async () => {
    const storage = memoryStorage()
    const persister = createDirectPersister(storage)
    expect(await persister.restoreClient()).toBeUndefined()
    const client = persisted([])
    await persister.persistClient(client)
    expect(await persister.restoreClient()).toEqual(client)
    await persister.removeClient()
    expect(storage.data.size).toBe(0)
  })
})
