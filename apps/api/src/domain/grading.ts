/** Une note datée de plus de 5 minutes dans le futur est ramenée à l'heure du serveur. */
export const FUTURE_TOLERANCE_MS = 5 * 60_000
/** Une note datée de plus de 30 jours est jugée périmée : elle est ignorée. */
export const MAX_AGE_MS = 30 * 24 * 3600_000

export interface ResolvedReviewTime {
  /** Heure à laquelle la note est appliquée. */
  at: Date
  /** `reviewedAt` était fourni : les gardes de rejeu et de désordre s'appliquent. */
  provided: boolean
  /** Plus de 30 jours avant `now` : la note n'est pas appliquée. */
  stale: boolean
}

/**
 * Heure effective d'une note. `reviewedAt` (déjà validé par `gradeSchema`) vient de l'app mobile,
 * qui note hors ligne puis envoie plus tard.
 * - Absent (web) : `now`, aucune garde : le comportement reste celui d'avant `reviewedAt`.
 * - Fourni : repris tel quel, y compris dans le futur jusqu'à `now + 5 min` : un rejeu doit
 *   recevoir la même heure pour être reconnu comme tel. Plus loin dans le futur (téléphone très en
 *   avance), `now` : mieux vaut appliquer la note que la perdre, au prix d'un rejeu possible après
 *   une réponse perdue (cas rare, documenté dans le README).
 */
export function resolveReviewedAt(reviewedAt: string | undefined, now: Date): ResolvedReviewTime {
  if (reviewedAt === undefined) return { at: now, provided: false, stale: false }
  const asked = new Date(reviewedAt)
  const tooFarAhead = asked.getTime() > now.getTime() + FUTURE_TOLERANCE_MS
  return {
    at: tooFarAhead ? now : asked,
    provided: true,
    stale: asked.getTime() < now.getTime() - MAX_AGE_MS,
  }
}

/**
 * Jamais avant la dernière révision : ts-fsrs lève une erreur (`delta_t` négatif) quand l'heure de
 * la note tombe sur un jour UTC antérieur à `last_review`. Cela arrive après une note mobile datée
 * dans le futur (tolérance de 5 min) quand l'horloge du serveur n'a pas encore rejoint cette heure.
 */
export function notBefore(at: Date, lastReview: Date | null | undefined): Date {
  return lastReview && lastReview > at ? lastReview : at
}
