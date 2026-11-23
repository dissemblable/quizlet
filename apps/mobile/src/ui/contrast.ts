// Couleurs et contraste WCAG 2.x : logique PURE (testée sous Node, sans react-native).

/** Seuil AA du texte normal. */
export const AA_TEXT = 4.5
/** Seuil AA des composants d'interface et des bordures qui les identifient (WCAG 1.4.11). */
export const AA_UI = 3

interface Rgba {
  r: number
  g: number
  b: number
  /** 0 à 1. */
  a: number
}

/** Lit `#rrggbb` ou `#rrggbbaa` ; lève une erreur sinon (un jeton mal écrit doit se voir). */
export function parseHex(hex: string): Rgba {
  const match = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(hex)
  const rgb = match?.[1]
  if (rgb === undefined) throw new Error(`Couleur invalide : ${hex}`)
  const alpha = match?.[2]
  return {
    r: Number.parseInt(rgb.slice(0, 2), 16),
    g: Number.parseInt(rgb.slice(2, 4), 16),
    b: Number.parseInt(rgb.slice(4, 6), 16),
    a: alpha === undefined ? 1 : Number.parseInt(alpha, 16) / 255,
  }
}

function byteHex(value: number): string {
  return Math.round(Math.min(255, Math.max(0, value)))
    .toString(16)
    .padStart(2, '0')
}

/** `#rrggbb` + opacité (0 à 1) donnent `#rrggbbaa`. */
export function withAlpha(hex: string, alpha: number): string {
  const { r, g, b } = parseHex(hex)
  return `#${byteHex(r)}${byteHex(g)}${byteHex(b)}${byteHex(alpha * 255)}`
}

/** Pose `foreground` (éventuellement translucide) sur `background` (opaque) : `#rrggbb`. */
export function composite(foreground: string, background: string): string {
  const front = parseHex(foreground)
  const back = parseHex(background)
  if (back.a !== 1) throw new Error(`Le fond doit être opaque : ${background}`)
  const mix = (f: number, b: number) => f * front.a + b * (1 - front.a)
  return `#${byteHex(mix(front.r, back.r))}${byteHex(mix(front.g, back.g))}${byteHex(mix(front.b, back.b))}`
}

function channel(value: number): number {
  const c = value / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

/** Luminance relative WCAG (0 noir, 1 blanc) d'une couleur opaque. */
export function relativeLuminance(hex: string): number {
  const { r, g, b } = parseHex(hex)
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/**
 * Rapport de contraste (1 à 21) de `foreground` sur `background`. Un premier plan translucide est
 * d'abord posé sur le fond ; le fond, lui, doit être opaque (composer les surfaces avant).
 */
export function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(composite(foreground, background))
  const b = relativeLuminance(background)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}
