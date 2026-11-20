import type { LibraryFilters } from '@quizlet/shared'
import { describe, expect, it } from 'vitest'
import {
  applyFilterPatch,
  emptyVariant,
  INITIAL_FILTERS,
  isFiltered,
  pageCount,
  removeTag,
  toggleTag,
} from './filters'

const filters = (overrides: Partial<LibraryFilters> = {}): LibraryFilters => ({
  ...INITIAL_FILTERS,
  ...overrides,
})

describe('applyFilterPatch', () => {
  it('remet la page à 1 quand un filtre change', () => {
    const current = filters({ q: 'chim', page: 3 })
    expect(applyFilterPatch(current, { folder: 'f1' })).toEqual({
      q: 'chim',
      folder: 'f1',
      tags: [],
      page: 1,
    })
    expect(applyFilterPatch(current, { q: 'eau' }).page).toBe(1)
    expect(applyFilterPatch(current, { tags: ['t1'] }).page).toBe(1)
  })

  it('garde la page demandée par le patch', () => {
    expect(applyFilterPatch(filters({ page: 1 }), { page: 2 }).page).toBe(2)
    expect(applyFilterPatch(filters({ page: 3 }), { page: 2 }).page).toBe(2)
  })

  it('retire le dossier avec `folder: undefined` sans toucher au reste', () => {
    const current = filters({ folder: 'f1', tags: ['t1'], q: 'a' })
    const next = applyFilterPatch(current, { folder: undefined, tags: [] })
    expect(next.folder).toBeUndefined()
    expect(next).toMatchObject({ q: 'a', tags: [], page: 1 })
  })

  it('ne modifie pas les filtres d’origine', () => {
    const current = filters({ page: 4 })
    applyFilterPatch(current, { folder: 'f1' })
    expect(current).toEqual(filters({ page: 4 }))
  })
})

describe('toggleTag / removeTag', () => {
  it('ajoute puis retire un tag (sélection multiple, ordre conservé)', () => {
    const one = toggleTag([], 'a')
    const two = toggleTag(one, 'b')
    expect(two).toEqual(['a', 'b'])
    expect(toggleTag(two, 'a')).toEqual(['b'])
  })

  it('ne modifie pas le tableau d’origine', () => {
    const tags = ['a']
    toggleTag(tags, 'b')
    toggleTag(tags, 'a')
    expect(tags).toEqual(['a'])
  })

  it('removeTag retire sans jamais ajouter', () => {
    expect(removeTag(['a', 'b'], 'a')).toEqual(['b'])
    expect(removeTag(['a'], 'inconnu')).toEqual(['a'])
    expect(removeTag([], 'a')).toEqual([])
  })
})

describe('pageCount', () => {
  it('vaut au moins 1, même sans résultat', () => {
    expect(pageCount(0)).toBe(1)
  })

  it('arrondit à la page supérieure (24 par page par défaut)', () => {
    expect(pageCount(1)).toBe(1)
    expect(pageCount(24)).toBe(1)
    expect(pageCount(25)).toBe(2)
    expect(pageCount(48)).toBe(2)
    expect(pageCount(49)).toBe(3)
  })

  it('suit la taille de page fournie par l’API', () => {
    expect(pageCount(30, 10)).toBe(3)
    expect(pageCount(30, 0)).toBe(1)
  })
})

describe('isFiltered', () => {
  it('vrai pour un dossier (y compris « none ») ou un tag', () => {
    expect(isFiltered(filters())).toBe(false)
    expect(isFiltered(filters({ folder: 'none' }))).toBe(true)
    expect(isFiltered(filters({ tags: ['t1'] }))).toBe(true)
  })
})

describe('emptyVariant', () => {
  it('« search » dès qu’il y a une recherche, même avec des filtres', () => {
    expect(emptyVariant(filters({ q: 'zzz' }))).toBe('search')
    expect(emptyVariant(filters({ q: 'zzz', folder: 'f1', page: 2 }))).toBe('search')
  })

  it('« filters » avec un dossier, un tag ou une page au-delà de la première', () => {
    expect(emptyVariant(filters({ folder: 'f1' }))).toBe('filters')
    expect(emptyVariant(filters({ folder: 'none' }))).toBe('filters')
    expect(emptyVariant(filters({ tags: ['t1'] }))).toBe('filters')
    expect(emptyVariant(filters({ page: 2 }))).toBe('filters')
  })

  it('« library » sans recherche ni filtre', () => {
    expect(emptyVariant(filters())).toBe('library')
  })
})
