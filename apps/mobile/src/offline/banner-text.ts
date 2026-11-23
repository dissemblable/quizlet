import { pluralize } from '@quizlet/shared'

/** En ligne, une note qui part en moins de ce délai ne mérite pas de bandeau (il clignoterait à chaque note). */
export const SYNC_BANNER_DELAY_MS = 2000

/**
 * Texte du bandeau, ou `null` s'il n'y a rien à dire :
 * - hors ligne : « Hors ligne », avec « · N notes en attente » s'il y en a ;
 * - en ligne : seulement si des notes attendent depuis un moment (`slow`).
 */
export function bannerText({
  online,
  pending,
  slow,
}: {
  online: boolean
  pending: number
  slow: boolean
}): string | null {
  const waiting = `${pluralize(pending, 'note')} en attente`
  if (!online) return pending > 0 ? `Hors ligne · ${waiting}` : 'Hors ligne'
  return pending > 0 && slow ? `Synchronisation · ${waiting}` : null
}
