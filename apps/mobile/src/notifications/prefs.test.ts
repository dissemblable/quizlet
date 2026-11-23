import { describe, expect, it } from 'vitest'
import {
  DEFAULT_REMINDER_PREFS,
  formatReminderTime,
  parseReminderPrefs,
  serializeReminderPrefs,
} from './prefs'

describe('DEFAULT_REMINDER_PREFS', () => {
  it('désactivé par défaut, 18:00', () => {
    expect(DEFAULT_REMINDER_PREFS).toEqual({ enabled: false, hour: 18, minute: 0 })
  })
})

describe('parseReminderPrefs', () => {
  it('renvoie les défauts sans valeur stockée', () => {
    expect(parseReminderPrefs(null)).toEqual(DEFAULT_REMINDER_PREFS)
  })

  it('relit ce que serializeReminderPrefs a écrit', () => {
    const prefs = { enabled: true, hour: 7, minute: 45 }
    expect(parseReminderPrefs(serializeReminderPrefs(prefs))).toEqual(prefs)
  })

  it.each(['', '{', 'not json', 'null', '42', '"texte"', '[]'])(
    'tolère un JSON corrompu ou inattendu (%j)',
    (raw) => {
      expect(parseReminderPrefs(raw)).toEqual(DEFAULT_REMINDER_PREFS)
    },
  )

  it('corrige champ par champ', () => {
    expect(parseReminderPrefs('{"enabled":"oui","hour":"8","minute":30}')).toEqual({
      enabled: false,
      hour: 18,
      minute: 30,
    })
  })

  it('borne les heures et minutes hors plage, tronque les décimales', () => {
    expect(parseReminderPrefs('{"enabled":true,"hour":99,"minute":-5}')).toEqual({
      enabled: true,
      hour: 23,
      minute: 0,
    })
    expect(parseReminderPrefs('{"enabled":true,"hour":7.9,"minute":59.9}')).toMatchObject({
      hour: 7,
      minute: 59,
    })
  })

  it("ne partage pas l'objet des défauts", () => {
    expect(parseReminderPrefs(null)).not.toBe(DEFAULT_REMINDER_PREFS)
  })
})

describe('serializeReminderPrefs', () => {
  it('écrit un JSON valide et borné', () => {
    expect(JSON.parse(serializeReminderPrefs({ enabled: true, hour: 30, minute: 0 }))).toEqual({
      enabled: true,
      hour: 23,
      minute: 0,
    })
  })
})

describe('formatReminderTime', () => {
  it.each([
    [18, 0, '18:00'],
    [8, 5, '08:05'],
    [0, 0, '00:00'],
    [23, 59, '23:59'],
  ])('%i h %i → %s', (hour, minute, expected) => {
    expect(formatReminderTime(hour, minute)).toBe(expected)
  })

  it('borne les valeurs hors plage', () => {
    expect(formatReminderTime(25, 70)).toBe('23:59')
  })
})
