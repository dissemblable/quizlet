import { isValidTimeZone } from '@quizlet/shared'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FALLBACK_TIME_ZONES, listTimeZones } from './timezones'

afterEach(() => {
  vi.restoreAllMocks()
})

function expectSortedUnique(zones: string[]) {
  expect(new Set(zones).size).toBe(zones.length)
  expect(zones).toEqual([...zones].sort())
}

describe('listTimeZones avec Intl', () => {
  it('liste triée, sans doublon, avec Europe/Paris', () => {
    const zones = listTimeZones()
    expect(zones.length).toBeGreaterThan(100)
    expect(zones).toContain('Europe/Paris')
    expectSortedUnique(zones)
  })

  it('ajoute le fuseau courant absent (alias), sans doublon s’il est déjà là', () => {
    const withAlias = listTimeZones('Europe/Kiev')
    expect(withAlias).toContain('Europe/Kiev')
    expectSortedUnique(withAlias)
    expect(listTimeZones('Europe/Paris')).toEqual(listTimeZones())
    expect(listTimeZones(null)).toEqual(listTimeZones())
    expect(listTimeZones('')).toEqual(listTimeZones())
  })
})

describe('listTimeZones sans Intl.supportedValuesOf (Hermes)', () => {
  const broken = () =>
    vi.spyOn(Intl, 'supportedValuesOf').mockImplementation(() => {
      throw new TypeError('Intl.supportedValuesOf is not a function')
    })

  it('replie sur la liste statique', () => {
    broken()
    const zones = listTimeZones()
    expect(zones).toEqual([...FALLBACK_TIME_ZONES].sort())
    expect(zones).toContain('Europe/Paris')
    expect(zones).toContain('UTC')
  })

  it('replie aussi sur une liste vide', () => {
    vi.spyOn(Intl, 'supportedValuesOf').mockReturnValue([])
    expect(listTimeZones()).toContain('Europe/Paris')
  })

  it('inclut le fuseau courant', () => {
    broken()
    const zones = listTimeZones('Europe/Kiev')
    expect(zones).toContain('Europe/Kiev')
    expectSortedUnique(zones)
  })
})

describe('FALLBACK_TIME_ZONES', () => {
  it('une centaine de fuseaux, triés, sans doublon, tous valides, toutes régions couvertes', () => {
    expect(FALLBACK_TIME_ZONES.length).toBeGreaterThanOrEqual(100)
    expectSortedUnique([...FALLBACK_TIME_ZONES])
    for (const zone of FALLBACK_TIME_ZONES) expect(isValidTimeZone(zone), zone).toBe(true)
    for (const prefix of ['Africa/', 'America/', 'Asia/', 'Australia/', 'Europe/', 'Pacific/']) {
      expect(
        FALLBACK_TIME_ZONES.some((zone) => zone.startsWith(prefix)),
        prefix,
      ).toBe(true)
    }
  })
})
