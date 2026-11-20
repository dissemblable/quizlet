import { describe, expect, it } from 'vitest'
import {
  isPersistedQueryKey,
  shouldDehydrateMutation,
  shouldDehydrateQuery,
} from './persist-filter'

const query = (queryKey: readonly unknown[], status = 'success') => ({
  queryKey,
  state: { status },
})
const mutation = (mutationKey: readonly unknown[] | undefined, status: string) => ({
  options: { mutationKey },
  state: { status },
})

describe('shouldDehydrateQuery : liste blanche', () => {
  it.each([
    [['me']],
    [['folders']],
    [['tags']],
    [['settings']],
    [['sets', 'list', { q: '', tags: [], page: 1 }]],
    [['sets', 'list', { tags: ['a'], page: 2, folderId: 'f1' }]],
    [['sets', 'detail', 'abc']],
    [['review', 'summary']],
    [['review', 'queue', 'all']],
    [['review', 'queue', 'set-1']],
  ])('persiste %j', (key) => {
    expect(shouldDehydrateQuery(query(key))).toBe(true)
  })

  it.each([
    [['sets', 'list', { q: 'verbes', tags: [], page: 1 }]],
    [['quiz', 'abc', 0]],
    [['review', 'due', 'set-1']],
    [['sets']],
    [['sets', 'list']],
    [['sets', 'detail']],
    [['review']],
    [['inconnu']],
    [[]],
  ])('ne persiste pas %j', (key) => {
    expect(shouldDehydrateQuery(query(key))).toBe(false)
  })

  it('ne garde que les requêtes réussies (le défaut de TanStack est remplacé)', () => {
    expect(shouldDehydrateQuery(query(['me'], 'pending'))).toBe(false)
    expect(shouldDehydrateQuery(query(['me'], 'error'))).toBe(false)
  })

  it('isPersistedQueryKey : une liste sans filtre objet est écartée', () => {
    expect(isPersistedQueryKey(['sets', 'list', 'x'])).toBe(false)
    expect(isPersistedQueryKey(['sets', 'list', null])).toBe(false)
  })
})

describe('shouldDehydrateMutation', () => {
  it("garde les notes en cours d'envoi, pas seulement celles en pause", () => {
    expect(shouldDehydrateMutation(mutation(['review', 'grade'], 'pending'))).toBe(true)
  })

  it('ignore les notes terminées et les autres mutations', () => {
    expect(shouldDehydrateMutation(mutation(['review', 'grade'], 'success'))).toBe(false)
    expect(shouldDehydrateMutation(mutation(['review', 'grade'], 'error'))).toBe(false)
    expect(shouldDehydrateMutation(mutation(['sets', 'create'], 'pending'))).toBe(false)
    expect(shouldDehydrateMutation(mutation(undefined, 'pending'))).toBe(false)
  })
})
