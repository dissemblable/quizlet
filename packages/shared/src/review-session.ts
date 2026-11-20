import type { Rating } from './constants'

export const RATING_LABELS: Record<Rating, string> = {
  1: 'À revoir',
  2: 'Difficile',
  3: 'Bien',
  4: 'Facile',
}

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** Délai avant une échéance, arrondi : « 1 min », « 10 min », « 3 h », « 4 j », « 2 mois », « 1 an ». */
export function formatInterval(due: Date, now: Date): string {
  const delay = Math.max(0, due.getTime() - now.getTime())
  if (delay < HOUR) return `${Math.max(1, Math.round(delay / MINUTE))} min`
  if (delay < DAY) return `${Math.round(delay / HOUR)} h`
  const days = Math.round(delay / DAY)
  if (days < 31) return `${days} j`
  if (days < 365) return `${Math.round(days / 30.4)} mois`
  const years = Math.round(days / 365)
  return years > 1 ? `${years} ans` : '1 an'
}

/** Carte d'une file de révision : seul l'identifiant compte pour le reducer. */
interface QueueItem {
  id: string
}

export interface ReviewSessionState<T extends QueueItem> {
  queue: T[]
  flipped: boolean
  /** Notes données pendant la séance (une carte revue deux fois compte deux fois). */
  ratings: Record<Rating, number>
  /**
   * Cartes de la file dont les intervalles prévus sont périmés : notées « À revoir » sans réponse
   * du serveur (`gradedLocal`), elles reviennent avec les intervalles d'avant cette note.
   * Voir `isIntervalStale`.
   */
  staleIds: string[]
}

export type ReviewAction<T extends QueueItem> =
  | { type: 'flip' }
  /** Note enregistrée par l'API ; `requeue` : la carte revient en fin de séance. */
  | { type: 'graded'; rating: Rating; requeue: T | null }
  /**
   * Note donnée sans réponse du serveur (hors ligne, ou note mise en file d'attente). La carte est
   * terminée, sauf « À revoir » (1) : elle repart en fin de file, ses intervalles périmés.
   */
  | { type: 'gradedLocal'; rating: Rating }

export function initReviewSession<T extends QueueItem>(queue: T[]): ReviewSessionState<T> {
  return { queue, flipped: false, ratings: { 1: 0, 2: 0, 3: 0, 4: 0 }, staleIds: [] }
}

export function reviewReducer<T extends QueueItem>(
  state: ReviewSessionState<T>,
  action: ReviewAction<T>,
): ReviewSessionState<T> {
  switch (action.type) {
    case 'flip':
      return state.queue.length === 0 ? state : { ...state, flipped: !state.flipped }
    case 'graded': {
      const [head, ...rest] = state.queue
      return {
        queue: action.requeue ? [...rest, action.requeue] : rest,
        flipped: false,
        ratings: { ...state.ratings, [action.rating]: state.ratings[action.rating] + 1 },
        // Réponse du serveur : la carte notée, qu'elle revienne ou non, n'est plus périmée.
        staleIds: state.staleIds.filter((id) => id !== head?.id && id !== action.requeue?.id),
      }
    }
    case 'gradedLocal': {
      const [head, ...rest] = state.queue
      if (!head) return state
      const again = action.rating === 1
      return {
        queue: again ? [...rest, head] : rest,
        flipped: false,
        ratings: { ...state.ratings, [action.rating]: state.ratings[action.rating] + 1 },
        staleIds: again
          ? state.staleIds.includes(head.id)
            ? state.staleIds
            : [...state.staleIds, head.id]
          : state.staleIds.filter((id) => id !== head.id),
      }
    }
  }
}

/** Les intervalles prévus de cette carte sont-ils périmés (note locale, pas encore confirmée) ? */
export function isIntervalStale(state: { staleIds: readonly string[] }, cardId: string): boolean {
  return state.staleIds.includes(cardId)
}
