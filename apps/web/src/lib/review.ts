import type { Rating } from '@quizlet/shared'
import type { QueueCard } from './queries'

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

export interface ReviewSessionState {
  queue: QueueCard[]
  flipped: boolean
  /** Notes données pendant la séance (une carte revue deux fois compte deux fois). */
  ratings: Record<Rating, number>
}

export type ReviewAction =
  | { type: 'flip' }
  /** Note enregistrée par l'API ; `requeue` : la carte revient en fin de séance. */
  | { type: 'graded'; rating: Rating; requeue: QueueCard | null }

export function initReviewSession(queue: QueueCard[]): ReviewSessionState {
  return { queue, flipped: false, ratings: { 1: 0, 2: 0, 3: 0, 4: 0 } }
}

export function reviewReducer(state: ReviewSessionState, action: ReviewAction): ReviewSessionState {
  switch (action.type) {
    case 'flip':
      return state.queue.length === 0 ? state : { ...state, flipped: !state.flipped }
    case 'graded': {
      const [, ...rest] = state.queue
      return {
        queue: action.requeue ? [...rest, action.requeue] : rest,
        flipped: false,
        ratings: { ...state.ratings, [action.rating]: state.ratings[action.rating] + 1 },
      }
    }
  }
}
