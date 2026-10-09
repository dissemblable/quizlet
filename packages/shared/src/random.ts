/** Générateur de nombres dans [0, 1), injectable pour rendre les tirages testables. */
export type RandomFn = () => number

/**
 * Mélange de Fisher-Yates. Renvoie une nouvelle liste et ne modifie pas l'originale.
 */
export function shuffle<T>(items: readonly T[], random: RandomFn = Math.random): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    // min() protège contre un générateur qui renverrait exactement 1.
    const j = Math.min(i, Math.floor(random() * (i + 1)))
    const tmp = result[i] as T
    result[i] = result[j] as T
    result[j] = tmp
  }
  return result
}

/**
 * Générateur déterministe (mulberry32) : même graine, même suite.
 * Réservé aux tests et aux démonstrations, pas à la cryptographie.
 */
export function seededRandom(seed: number): RandomFn {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
