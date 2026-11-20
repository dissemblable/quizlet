import { describe, expect, it } from 'vitest'
import { parseHex } from './contrast'
import { darkColors, fontSize, lightColors, radius, ratingColor, spacing } from './tokens'

describe('jetons de thème', () => {
  it('les deux palettes ont exactement les mêmes clés', () => {
    expect(Object.keys(darkColors).sort()).toEqual(Object.keys(lightColors).sort())
  })

  it('chaque couleur est un hex valide', () => {
    for (const palette of [lightColors, darkColors]) {
      for (const [name, value] of Object.entries(palette)) {
        expect(() => parseHex(value), name).not.toThrow()
      }
    }
  })

  it('reprend les jetons oklch du web (valeurs de référence)', () => {
    expect(lightColors.background).toBe('#f1f5fa')
    expect(lightColors.primary).toBe('#284cc3')
    expect(darkColors.background).toBe('#24382f')
    expect(darkColors.primary).toBe('#f6da6f')
    expect(lightColors.secondary).toBe(lightColors.muted)
    expect(darkColors.secondary).toBe(darkColors.muted)
  })

  it('les surfaces de ton sont à 10 % (1a)', () => {
    for (const palette of [lightColors, darkColors]) {
      for (const key of ['successSurface', 'warningSurface', 'infoSurface', 'destructiveSurface']) {
        expect(palette[key as keyof typeof palette].endsWith('1a'), key).toBe(true)
      }
    }
  })

  it('associe une couleur à chaque note FSRS', () => {
    expect(ratingColor(lightColors, 1)).toBe(lightColors.destructive)
    expect(ratingColor(lightColors, 2)).toBe(lightColors.warning)
    expect(ratingColor(darkColors, 3)).toBe(darkColors.success)
    expect(ratingColor(darkColors, 4)).toBe(darkColors.info)
  })

  it('les échelles sont strictement croissantes', () => {
    for (const scale of [spacing, fontSize]) {
      const values = Object.values(scale)
      expect(values).toEqual([...values].sort((a, b) => a - b))
      expect(new Set(values).size).toBe(values.length)
    }
    expect(radius.full).toBeGreaterThan(radius.xl)
  })
})
