import type { CardState } from '@quizlet/shared'
import { type Card, createEmptyCard, fsrs, type ReviewLog, State } from 'ts-fsrs'
import type { CardReviewRow } from '../db/schema'

// Correspondance avec l'énumération State de ts-fsrs (0 à 3).
const STATE_NAMES: Record<State, CardState> = {
  [State.New]: 'new',
  [State.Learning]: 'learning',
  [State.Review]: 'review',
  [State.Relearning]: 'relearning',
}
const STATE_VALUES: Record<CardState, State> = {
  new: State.New,
  learning: State.Learning,
  review: State.Review,
  relearning: State.Relearning,
}

export type Scheduler = ReturnType<typeof createScheduler>

/**
 * Planificateur FSRS : paramètres par défaut de ts-fsrs (étapes d'apprentissage 1 min et 10 min,
 * réapprentissage 10 min), rétention cible de l'utilisateur, sans « fuzz » (planification
 * déterministe).
 */
export function createScheduler(desiredRetention: number) {
  return fsrs({ request_retention: desiredRetention, enable_fuzz: false })
}

/** État FSRS tel que stocké dans `card_reviews`. */
export type ReviewFields = Omit<CardReviewRow, 'userId' | 'cardId' | 'updatedAt'>

/** Carte ts-fsrs à partir de la ligne stockée ; pas de ligne : carte nouvelle. */
export function toFsrsCard(row: ReviewFields | undefined, now: Date): Card {
  if (!row) return createEmptyCard(now)
  return {
    due: row.due,
    stability: row.stability,
    difficulty: row.difficulty,
    elapsed_days: row.elapsedDays,
    scheduled_days: row.scheduledDays,
    learning_steps: row.learningSteps,
    reps: row.reps,
    lapses: row.lapses,
    state: STATE_VALUES[row.state],
    last_review: row.lastReview ?? undefined,
  }
}

export function fromFsrsCard(card: Card): ReviewFields {
  return {
    due: card.due,
    stability: card.stability,
    difficulty: card.difficulty,
    elapsedDays: card.elapsed_days,
    scheduledDays: card.scheduled_days,
    learningSteps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: STATE_NAMES[card.state],
    lastReview: card.last_review ?? null,
  }
}

/** Entrée d'historique (`review_logs`) ; `state` est l'état de la carte avant la révision. */
export function fromFsrsLog(log: ReviewLog) {
  return {
    rating: log.rating,
    state: STATE_NAMES[log.state],
    due: log.due,
    stability: log.stability,
    difficulty: log.difficulty,
    elapsedDays: log.elapsed_days,
    lastElapsedDays: log.last_elapsed_days,
    scheduledDays: log.scheduled_days,
    learningSteps: log.learning_steps,
    reviewedAt: log.review,
  }
}

/** Échéance prévue pour chaque note, dans l'ordre 1 (À revoir) à 4 (Facile). */
export function previewDue(scheduler: Scheduler, card: Card, now: Date): Date[] {
  const preview = scheduler.repeat(card, now)
  return [...preview].map((item) => item.card.due)
}
