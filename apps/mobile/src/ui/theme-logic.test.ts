import { describe, expect, it } from 'vitest'
import {
  appearanceOverride,
  colorsFor,
  DEFAULT_PREFERENCE,
  isThemePreference,
  parseStoredPreference,
  resolveScheme,
  THEME_STORAGE_KEY,
} from './theme-logic'
import { darkColors, lightColors } from './tokens'

describe('résolution de la préférence', () => {
  it('« système » suit Android, clair par défaut', () => {
    expect(resolveScheme('system', 'dark')).toBe('dark')
    expect(resolveScheme('system', 'light')).toBe('light')
    expect(resolveScheme('system', null)).toBe('light')
    expect(resolveScheme('system', undefined)).toBe('light')
  })

  it("un choix explicite ignore le thème d'Android", () => {
    expect(resolveScheme('light', 'dark')).toBe('light')
    expect(resolveScheme('dark', 'light')).toBe('dark')
    expect(resolveScheme('dark', null)).toBe('dark')
  })

  it('« système » devient auto pour Appearance (RN 0.88 refuse null)', () => {
    expect(appearanceOverride('system')).toBe('auto')
    expect(appearanceOverride('light')).toBe('light')
    expect(appearanceOverride('dark')).toBe('dark')
  })

  it('choisit la palette du thème', () => {
    expect(colorsFor('light')).toBe(lightColors)
    expect(colorsFor('dark')).toBe(darkColors)
  })
})

describe('lecture de la préférence stockée', () => {
  it.each(['light', 'dark', 'system'] as const)('accepte « %s »', (value) => {
    expect(isThemePreference(value)).toBe(true)
    expect(parseStoredPreference(value)).toBe(value)
  })

  it.each([
    null,
    undefined,
    '',
    ' dark',
    'DARK',
    'auto',
    '"dark"',
    '{"preference":"dark"}',
    '[',
    '\u0000',
    'null',
    '1',
  ])('un stockage absent ou corrompu (%j) donne « système »', (raw) => {
    expect(parseStoredPreference(raw)).toBe(DEFAULT_PREFERENCE)
    expect(DEFAULT_PREFERENCE).toBe('system')
  })

  it('refuse les valeurs qui ne sont pas des chaînes', () => {
    for (const value of [1, true, {}, [], null, undefined]) {
      expect(isThemePreference(value)).toBe(false)
    }
  })

  it('range la préférence sous la clé du plan', () => {
    expect(THEME_STORAGE_KEY).toBe('quizlet.theme.v1')
  })
})
