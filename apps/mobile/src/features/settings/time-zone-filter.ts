import { normalizeAnswer } from '@quizlet/shared'

/** « America/New_York » → « America/New York » (comme le web). */
export function zoneLabel(zone: string): string {
  return zone.replace(/_/g, ' ')
}

/**
 * Fuseaux dont le libellé contient tous les mots de `query` (casse ignorée, ordre libre :
 * « new york », « paris europe »). Requête vide : tous. L'ordre de `zones` est conservé.
 */
export function filterTimeZones(zones: readonly string[], query: string): string[] {
  const words = normalizeAnswer(zoneLabel(query)).split(' ').filter(Boolean)
  if (words.length === 0) return [...zones]
  return zones.filter((zone) => {
    const label = normalizeAnswer(zoneLabel(zone))
    return words.every((word) => label.includes(word))
  })
}
