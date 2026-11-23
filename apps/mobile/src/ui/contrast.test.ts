import { describe, expect, it } from 'vitest'
import {
  AA_TEXT,
  AA_UI,
  composite,
  contrastRatio,
  parseHex,
  relativeLuminance,
  withAlpha,
} from './contrast'
import { type Colors, darkColors, lightColors } from './tokens'

describe('contrast', () => {
  it('lit #rrggbb et #rrggbbaa, refuse le reste', () => {
    expect(parseHex('#10b981')).toEqual({ r: 16, g: 185, b: 129, a: 1 })
    expect(parseHex('#00000066').a).toBeCloseTo(0.4, 2)
    expect(() => parseHex('#fff')).toThrow()
    expect(() => parseHex('rouge')).toThrow()
  })

  it('calcule les valeurs de référence WCAG', () => {
    expect(relativeLuminance('#000000')).toBe(0)
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 10)
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5)
    expect(contrastRatio('#ffffff', '#ffffff')).toBe(1)
    // #767676 sur blanc : le gris le plus clair qui passe AA (4,54:1).
    expect(contrastRatio('#767676', '#ffffff')).toBeCloseTo(4.54, 2)
    expect(contrastRatio('#777777', '#ffffff')).toBeLessThan(AA_TEXT)
  })

  it('pose une couleur translucide sur un fond opaque', () => {
    expect(composite('#ff000080', '#000000')).toBe('#800000')
    expect(composite('#112233', '#ffffff')).toBe('#112233')
    expect(withAlpha('#ff0000', 0.5)).toBe('#ff000080')
    expect(() => composite('#ffffff', '#ffffff80')).toThrow()
    expect(() => contrastRatio('#ffffff', '#00000080')).toThrow()
  })
})

const schemes: ReadonlyArray<[string, Colors]> = [
  ['clair', lightColors],
  ['sombre', darkColors],
]

describe.each(schemes)('contraste du thème %s', (_name, c) => {
  const textPairs: ReadonlyArray<[keyof Colors, keyof Colors]> = [
    ['foreground', 'background'],
    ['foreground', 'card'],
    ['cardForeground', 'card'],
    ['primaryForeground', 'primary'],
    ['secondaryForeground', 'secondary'],
    ['foreground', 'muted'],
    ['mutedForeground', 'background'],
    ['mutedForeground', 'card'],
    ['mutedForeground', 'secondary'],
    ['accentForeground', 'accent'],
    ['destructiveForeground', 'destructive'],
    ['destructive', 'background'],
    ['destructive', 'card'],
    ['primary', 'background'],
    ['primary', 'card'],
    ['success', 'background'],
    ['success', 'card'],
    ['warning', 'background'],
    ['warning', 'card'],
    ['info', 'background'],
    ['info', 'card'],
  ]

  it.each(textPairs)('%s sur %s : au moins 4,5:1', (foreground, background) => {
    expect(contrastRatio(c[foreground], c[background])).toBeGreaterThanOrEqual(AA_TEXT)
  })

  const statuses = ['success', 'warning', 'info', 'destructive'] as const
  const bases = ['background', 'card'] as const
  for (const status of statuses) {
    for (const base of bases) {
      it(`${status} sur sa surface à 10 % posée sur ${base} : au moins 4,5:1`, () => {
        const surface = composite(c[`${status}Surface`], c[base])
        expect(contrastRatio(c[status], surface)).toBeGreaterThanOrEqual(AA_TEXT)
      })
    }
  }

  it.each([
    ['outline', 'background'],
    ['outline', 'card'],
    ['ring', 'background'],
    ['ring', 'card'],
  ] as const)('%s sur %s (contour de contrôle, focus) : au moins 3:1', (border, surface) => {
    expect(contrastRatio(c[border], c[surface])).toBeGreaterThanOrEqual(AA_UI)
  })
})
