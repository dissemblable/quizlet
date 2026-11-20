import type { PersistedClient } from '@tanstack/react-query-persist-client'
import { describe, expect, it } from 'vitest'
import { trimPersistedClient } from './trim'

type Query = PersistedClient['clientState']['queries'][number]

function query(queryKey: unknown[], dataUpdatedAt: number, size = 1000): Query {
  return {
    queryKey,
    queryHash: JSON.stringify(queryKey),
    dehydratedAt: dataUpdatedAt,
    state: { data: 'x'.repeat(size), dataUpdatedAt, status: 'success' },
  } as unknown as Query
}

const detail = (id: string, at: number, size?: number) => query(['sets', 'detail', id], at, size)
const list = (page: number, at: number, size?: number) =>
  query(['sets', 'list', { q: '', tags: [], page }], at, size)

function client(queries: Query[], mutations: unknown[] = []): PersistedClient {
  return {
    timestamp: 1,
    buster: 'b',
    clientState: { queries, mutations: mutations as never },
  }
}

const keys = (c: PersistedClient) => c.clientState.queries.map((q) => q.queryHash)

describe('trimPersistedClient', () => {
  it('ne touche à rien sous la limite (même objet)', () => {
    const small = client([detail('a', 1)])
    expect(trimPersistedClient(small, 1_000_000)).toBe(small)
  })

  it('retire les détails de set les plus anciens en premier', () => {
    const c = client([detail('récent', 30), detail('vieux', 10), detail('milieu', 20)])
    const limit = JSON.stringify(c).length - 1500
    const trimmed = trimPersistedClient(c, limit)
    expect(keys(trimmed)).toEqual([JSON.stringify(['sets', 'detail', 'récent'])])
  })

  it('retire les listes seulement après tous les détails', () => {
    const c = client([list(1, 1), detail('a', 50), list(2, 2), detail('b', 60)])
    // Assez pour retirer les deux détails, pas les listes.
    const limit = JSON.stringify(c).length - 2100
    const trimmed = trimPersistedClient(c, limit)
    expect(trimmed.clientState.queries.map((q) => q.queryKey[1])).toEqual(['list', 'list'])
  })

  it('retire les listes les plus anciennes quand les détails ne suffisent pas', () => {
    const c = client([list(1, 5), detail('a', 50), list(2, 1)])
    const limit = JSON.stringify(c).length - 2100
    const trimmed = trimPersistedClient(c, limit)
    expect(keys(trimmed)).toEqual([JSON.stringify(['sets', 'list', { q: '', tags: [], page: 1 }])])
  })

  it('ne retire jamais la file, le résumé, me, dossiers, tags, paramètres ni les mutations', () => {
    const protectedQueries = [
      query(['review', 'queue', 'all'], 1, 5000),
      query(['review', 'summary'], 1, 5000),
      query(['me'], 1, 5000),
      query(['folders'], 1, 5000),
      query(['tags'], 1, 5000),
      query(['settings'], 1, 5000),
    ]
    const mutations = [{ mutationKey: ['review', 'grade'], state: { status: 'pending' } }]
    const c = client([...protectedQueries, detail('a', 1, 5000)], mutations)
    const trimmed = trimPersistedClient(c, 100)
    expect(trimmed.clientState.queries).toEqual(protectedQueries)
    expect(trimmed.clientState.mutations).toEqual(mutations)
  })

  it("renvoie le client tel quel si rien n'est retirable", () => {
    const c = client([query(['review', 'queue', 'all'], 1, 5000)])
    expect(trimPersistedClient(c, 100)).toBe(c)
  })

  it('ne modifie pas son argument', () => {
    const c = client([detail('a', 1), detail('b', 2)])
    const before = JSON.stringify(c)
    trimPersistedClient(c, 100)
    expect(JSON.stringify(c)).toBe(before)
  })
})
