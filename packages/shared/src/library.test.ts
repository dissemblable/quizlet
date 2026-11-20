import { describe, expect, it } from 'vitest'
import { libraryParams, readLibraryFilters } from './library'

// Le package n'a pas les types DOM : un `get` minimal tient lieu de `URLSearchParams`.
const params = (values: Record<string, string> = {}) => ({
  get: (name: string) => values[name] ?? null,
})

describe('filtres de la bibliothèque', () => {
  it("lit les filtres de l'URL avec des valeurs par défaut", () => {
    expect(readLibraryFilters(params())).toEqual({
      q: '',
      folder: undefined,
      tags: [],
      page: 1,
    })
    expect(
      readLibraryFilters(params({ q: 'chim', folder: 'none', tags: 'a,b', page: '3' })),
    ).toEqual({
      q: 'chim',
      folder: 'none',
      tags: ['a', 'b'],
      page: 3,
    })
  })

  it('ignore une page invalide', () => {
    for (const page of ['0', '-2', '1.5', 'abc']) {
      expect(readLibraryFilters(params({ page })).page).toBe(1)
    }
  })

  it('ne garde que les filtres actifs', () => {
    expect(libraryParams({ q: '', tags: [], page: 1 })).toEqual({})
    expect(libraryParams({ q: 'x', folder: 'f', tags: ['a', 'b'], page: 2 })).toEqual({
      q: 'x',
      folder: 'f',
      tags: 'a,b',
      page: '2',
    })
  })
})
