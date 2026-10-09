import { describe, expect, it } from 'vitest'
import { seededRandom, shuffle } from './random'

describe('shuffle', () => {
  it('conserve exactement les mêmes éléments', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8]
    const result = shuffle(items, seededRandom(42))
    expect(result).toHaveLength(items.length)
    expect([...result].sort((a, b) => a - b)).toEqual(items)
  })

  it("ne modifie pas la liste d'origine", () => {
    const items = ['a', 'b', 'c', 'd']
    const copy = [...items]
    shuffle(items, seededRandom(1))
    expect(items).toEqual(copy)
  })

  it('est déterministe avec une même graine', () => {
    const items = Array.from({ length: 20 }, (_, i) => i)
    expect(shuffle(items, seededRandom(7))).toEqual(shuffle(items, seededRandom(7)))
  })

  it("change l'ordre pour une graine donnée", () => {
    const items = Array.from({ length: 20 }, (_, i) => i)
    expect(shuffle(items, seededRandom(7))).not.toEqual(items)
  })

  it('gère les listes vides et à un élément', () => {
    expect(shuffle([], seededRandom(3))).toEqual([])
    expect(shuffle(['seul'], seededRandom(3))).toEqual(['seul'])
  })

  it('reste dans les bornes si le générateur renvoie 1', () => {
    const result = shuffle([1, 2, 3], () => 1)
    expect([...result].sort()).toEqual([1, 2, 3])
  })

  it('produit toutes les permutations possibles de façon équilibrée', () => {
    const counts = new Map<string, number>()
    const random = seededRandom(123)
    for (let i = 0; i < 6000; i++) {
      const key = shuffle(['a', 'b', 'c'], random).join('')
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    expect(counts.size).toBe(6)
    for (const count of counts.values()) {
      expect(count).toBeGreaterThan(800)
      expect(count).toBeLessThan(1200)
    }
  })
})

describe('seededRandom', () => {
  it('renvoie des valeurs dans [0, 1)', () => {
    const random = seededRandom(99)
    for (let i = 0; i < 1000; i++) {
      const value = random()
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })
})
