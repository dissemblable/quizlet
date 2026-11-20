import {
  formatInterval,
  isIntervalStale,
  pluralize,
  RATING_LABELS,
  RATINGS,
  type Rating,
  type ReviewAction,
} from '@quizlet/shared'
import type { QueueCard } from '@/lib/queries'
import { type QueryView, queryView } from '@/lib/query-state'
import { routes } from '@/lib/routes'
import type { GradeOutcome } from '@/offline/types'

/**
 * Issue d'une note (`useGrade().grade`) → action du reducer partagé. Un seul chemin pour les deux
 * cas : `graded` (le serveur a répondu) ou `gradedLocal` (note mise en attente).
 */
export function applyGradeOutcome(rating: Rating, outcome: GradeOutcome): ReviewAction<QueueCard> {
  if (outcome.kind === 'queued') return { type: 'gradedLocal', rating }
  // Note ignorée par le serveur (déjà reçue, périmée) : rien n'est replanifié, la carte est terminée.
  return { type: 'graded', rating, requeue: outcome.ignored ? null : outcome.requeue }
}

export function reviewedCount(ratings: Record<Rating, number>): number {
  return RATINGS.reduce((sum, rating) => sum + ratings[rating], 0)
}

/** Part des cartes de la séance déjà notées (une carte qui revient compte à chaque passage). */
export function progressPercent(reviewed: number, remaining: number): number {
  const total = reviewed + remaining
  return total === 0 ? 0 : Math.round((reviewed / total) * 100)
}

export function sessionStatus(remaining: number): string {
  return remaining > 0 ? `Encore ${pluralize(remaining, 'carte')}` : 'Séance terminée'
}

export function reviewedLabel(reviewed: number): string {
  return pluralize(reviewed, 'note donnée', 'notes données')
}

export function recapCounters(
  ratings: Record<Rating, number>,
): { rating: Rating; label: string; count: number }[] {
  return RATINGS.map((rating) => ({ rating, label: RATING_LABELS[rating], count: ratings[rating] }))
}

export function pendingNotice(count: number): string {
  return `${pluralize(count, 'note')} en attente de synchronisation`
}

/**
 * Intervalle prévu pour une note, ou `null` s'il est périmé (carte notée « À revoir » sans réponse
 * du serveur : ses prévisions datent d'avant cette note).
 */
export function intervalLabel(
  state: { staleIds: readonly string[] },
  card: Pick<QueueCard, 'id' | 'intervals'>,
  rating: Rating,
  now: Date,
): string | null {
  if (isIntervalStale(state, card.id)) return null
  return formatInterval(new Date(card.intervals[rating - 1] ?? now), now)
}

export function ratingAccessibilityLabel(rating: Rating, interval: string | null): string {
  return interval === null
    ? RATING_LABELS[rating]
    : `${RATING_LABELS[rating]}, revue dans ${interval}`
}

export function cardAnnouncement(
  card: Pick<QueueCard, 'term' | 'definition'>,
  flipped: boolean,
): string {
  return flipped ? `Définition : ${card.definition}` : `Terme : ${card.term}`
}

export function gradeAnnouncement(rating: Rating): string {
  return `Note donnée : ${RATING_LABELS[rating]}`
}

export function recapAnnouncement(reviewed: number): string {
  return `Séance terminée. ${reviewedLabel(reviewed)}.`
}

/**
 * Ce que l'écran affiche tant que la séance n'a pas démarré. En ligne, on attend la file fraîche
 * (`fetching`) plutôt que l'instantané persisté ; en pause (hors ligne), ou si le rafraîchissement
 * échoue, l'instantané sert. Sans instantané : hors ligne ou erreur. Les données priment sur
 * `isError` (voir `queryView`).
 */
export function reviewQueueView(query: {
  hasData: boolean
  isPending: boolean
  isError: boolean
  fetchStatus: 'fetching' | 'paused' | 'idle'
}): QueryView {
  if (query.hasData) return query.fetchStatus === 'fetching' ? 'loading' : 'ready'
  return queryView(query)
}

export interface ReviewTarget {
  title: string
  /** Route du bouton retour. */
  route: string
  backLabel: string
  recapBackLabel: string
}

/** Révision d'un set (`set`) ou du jour (tous les sets). */
export function reviewTarget(set?: { id: string; title: string }): ReviewTarget {
  return set
    ? {
        title: `Réviser « ${set.title} »`,
        route: routes.set(set.id),
        backLabel: set.title,
        recapBackLabel: 'Retour au set',
      }
    : {
        title: 'Révision du jour',
        route: routes.home,
        backLabel: 'Bibliothèque',
        recapBackLabel: 'Retour à la bibliothèque',
      }
}
