import { describe, expect, it } from 'vitest'
import { filterTimeZones, zoneLabel } from './time-zone-filter'

const zones = [
  'America/Los_Angeles',
  'America/New_York',
  'Asia/Tokyo',
  'Europe/Paris',
  'Europe/Zurich',
  'UTC',
]

describe('zoneLabel', () => {
  it('remplace les tirets bas par des espaces', () => {
    expect(zoneLabel('America/New_York')).toBe('America/New York')
    expect(zoneLabel('Europe/Paris')).toBe('Europe/Paris')
  })
})

describe('filterTimeZones', () => {
  it('garde tout sans requête, dans l’ordre', () => {
    expect(filterTimeZones(zones, '')).toEqual(zones)
    expect(filterTimeZones(zones, '   ')).toEqual(zones)
  })

  it('ignore la casse et trouve en milieu de mot', () => {
    expect(filterTimeZones(zones, 'PARIS')).toEqual(['Europe/Paris'])
    expect(filterTimeZones(zones, 'york')).toEqual(['America/New_York'])
  })

  it('accepte « new york » comme « new_york » et un ordre libre des mots', () => {
    expect(filterTimeZones(zones, 'new york')).toEqual(['America/New_York'])
    expect(filterTimeZones(zones, 'new_york')).toEqual(['America/New_York'])
    expect(filterTimeZones(zones, 'paris europe')).toEqual(['Europe/Paris'])
  })

  it('combine la région et la ville', () => {
    expect(filterTimeZones(zones, 'europe')).toEqual(['Europe/Paris', 'Europe/Zurich'])
    expect(filterTimeZones(zones, 'europe/z')).toEqual(['Europe/Zurich'])
  })

  it('renvoie une liste vide si rien ne correspond', () => {
    expect(filterTimeZones(zones, 'zzz')).toEqual([])
  })
})
