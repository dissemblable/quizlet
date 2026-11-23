import { describe, expect, it } from 'vitest'
import { AA_TEXT, AA_UI, composite, contrastRatio } from './contrast'
import { badgeColors, buttonColors, cardColors, statusColors, textColor } from './palette'
import { type Colors, darkColors, lightColors } from './tokens'

const schemes: ReadonlyArray<[string, Colors]> = [
  ['clair', lightColors],
  ['sombre', darkColors],
]

/** Fond réellement vu : `transparent` laisse voir le parent, une teinte translucide s'y mélange. */
function seen(background: string, parent: string): string {
  return background === 'transparent' ? parent : composite(background, parent)
}

describe.each(schemes)('couleurs des composants, thème %s', (_name, c) => {
  const parents = [
    ['background', c.background],
    ['card', c.card],
  ] as const

  describe.each(parents)('posés sur %s', (_parentName, parent) => {
    it.each(['primary', 'secondary', 'outline', 'ghost', 'destructive'] as const)(
      'bouton %s : texte lisible',
      (variant) => {
        const { background, foreground } = buttonColors(c, variant)
        expect(contrastRatio(foreground, seen(background, parent))).toBeGreaterThanOrEqual(AA_TEXT)
      },
    )

    it.each([
      'primary',
      'secondary',
      'outline',
      'success',
      'warning',
      'info',
      'destructive',
    ] as const)('badge %s : texte lisible', (tone) => {
      const { background, foreground } = badgeColors(c, tone)
      expect(contrastRatio(foreground, seen(background, parent))).toBeGreaterThanOrEqual(AA_TEXT)
    })

    it.each(['info', 'warning', 'success', 'destructive'] as const)('bandeau %s', (tone) => {
      const { background, foreground } = statusColors(c, tone)
      expect(contrastRatio(foreground, seen(background, parent))).toBeGreaterThanOrEqual(AA_TEXT)
    })

    it.each(['default', 'muted', 'primary', 'destructive', 'success', 'warning', 'info'] as const)(
      'texte « %s »',
      (tone) => {
        expect(contrastRatio(textColor(c, tone), parent)).toBeGreaterThanOrEqual(AA_TEXT)
      },
    )
  })

  it('texte inverse sur le fond du bouton principal', () => {
    expect(contrastRatio(textColor(c, 'inverse'), c.primary)).toBeGreaterThanOrEqual(AA_TEXT)
  })

  it('le contour du bouton outline est visible (3:1)', () => {
    const { border } = buttonColors(c, 'outline')
    expect(contrastRatio(border, c.background)).toBeGreaterThanOrEqual(AA_UI)
  })

  it.each(['default', 'primary', 'success', 'destructive'] as const)(
    'carte « %s » (sélectionnée ou non) : texte lisible',
    (tone) => {
      for (const selected of [false, true]) {
        const { background } = cardColors(c, tone, selected)
        expect(contrastRatio(c.cardForeground, background)).toBeGreaterThanOrEqual(AA_TEXT)
        expect(contrastRatio(c.mutedForeground, background)).toBeGreaterThanOrEqual(AA_TEXT)
      }
    },
  )

  it('une carte sélectionnée prend le ton principal, sauf ton explicite', () => {
    expect(cardColors(c, 'default', true)).toEqual(cardColors(c, 'primary', false))
    expect(cardColors(c, 'success', true)).toEqual(cardColors(c, 'success', false))
    expect(cardColors(c, 'default', false).borderWidth).toBe(1)
  })
})
