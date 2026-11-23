import { describe, expect, it } from 'vitest'
import { clampPercent, counterText, faceFontSize, flipAnnouncement, shortenToast } from './logic'

describe('clampPercent', () => {
  it("borne à 0-100 et neutralise NaN et l'infini", () => {
    expect(clampPercent(42)).toBe(42)
    expect(clampPercent(-5)).toBe(0)
    expect(clampPercent(140)).toBe(100)
    expect(clampPercent(Number.NaN)).toBe(0)
    expect(clampPercent(Number.POSITIVE_INFINITY)).toBe(0)
  })
})

describe('shortenToast', () => {
  it('garde un message court tel quel (sans espaces autour)', () => {
    expect(shortenToast('  Set supprimé.  ')).toBe('Set supprimé.')
  })

  it('tronque un message trop long avec une ellipse', () => {
    const long = 'a'.repeat(300)
    const out = shortenToast(long, 50)
    expect(out).toHaveLength(50)
    expect(out.endsWith('…')).toBe(true)
  })

  it('ne tronque pas à la limite exacte', () => {
    expect(shortenToast('x'.repeat(120))).toHaveLength(120)
  })
})

describe("textes d'accessibilité", () => {
  it('annonce la face visible de la carte', () => {
    expect(flipAnnouncement(false, 'chat', 'cat')).toBe('Terme : chat')
    expect(flipAnnouncement(true, 'chat', 'cat')).toBe('Définition : cat')
  })

  it("formate le compteur d'un champ", () => {
    expect(counterText(12, 200)).toBe('12 / 200')
    expect(counterText(0, 5)).toBe('0 / 5')
  })
})

describe('faceFontSize', () => {
  it('diminue avec la longueur du texte', () => {
    const sizes = [10, 100, 300, 1000].map((n) => faceFontSize('x'.repeat(n)))
    expect(sizes).toEqual([24, 20, 17, 15])
  })
})
