import { ApiError, CARD_STATES, type CardState, RATINGS, type Rating } from '@quizlet/shared'
import type { QueueCard } from '@/lib/queries'

/** Au-delà, `useGrade` rend la main (`queued`) : la note continue de partir en arrière-plan. */
export const GRADE_WAIT_MS = 3000

/** Variables persistées de la mutation de note. */
export interface GradeVariables {
  cardId: string
  rating: Rating
  /** ISO 8601 UTC avec le `Z` (exigé par l'API). */
  reviewedAt: string
  /** État de la carte avant la note : sert à ajuster les compteurs tant qu'elle est en attente. */
  cardState: CardState
}

/** Réponse de `POST /api/review/cards/:cardId` (champs utilisés ici). */
export interface GradeResponse {
  card: QueueCard | null
  ignored: boolean
}

/**
 * Envoi abandonné sans appel serveur (propriétaire du cache différent de l'utilisateur connecté) :
 * jamais rejoué, et absent du compte rendu de synchronisation.
 */
export class GradeAbortedError extends Error {
  constructor() {
    super('Envoi de la note abandonné : le cache appartient à un autre compte.')
    this.name = 'GradeAbortedError'
  }
}

/**
 * Faut-il réessayer l'envoi d'une note ? Oui pour le réseau, les 5xx, la session expirée (la porte
 * d'envoi attend la reconnexion) et les 4xx transitoires (408, 429) ; non pour les refus
 * définitifs (carte supprimée, accès refusé, requête invalide), qui abandonnent la note.
 */
export function isRetryable(error: unknown): boolean {
  if (error instanceof GradeAbortedError) return false
  if (error instanceof ApiError) {
    if (error.needsLogin || error.code === 'NETWORK_ERROR') return true
    if (error.status === 408 || error.status === 429) return true
    return !(error.status >= 400 && error.status < 500)
  }
  // Panne inconnue (TypeError, abandon…) : une note ne se perd jamais sur une hypothèse.
  return true
}

/** Délai avant la tentative suivante : 1 s, 2 s, 4 s… plafonné à 30 s. */
export function retryDelay(failureCount: number): number {
  return Math.min(1000 * 2 ** failureCount, 30_000)
}

export function buildGradeVariables(
  card: { id: string; state: CardState },
  rating: Rating,
  now: Date = new Date(),
): GradeVariables {
  return { cardId: card.id, rating, reviewedAt: now.toISOString(), cardState: card.state }
}

/** Variables relues du stockage : une forme inattendue est ignorée plutôt que supposée. */
export function isGradeVariables(value: unknown): value is GradeVariables {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.cardId === 'string' &&
    typeof v.reviewedAt === 'string' &&
    RATINGS.some((rating) => rating === v.rating) &&
    CARD_STATES.some((state) => state === v.cardState)
  )
}

/** La note a attendu plus que la fenêtre de `useGrade` (hors ligne, lenteur, redémarrage). */
export function isDeferred(reviewedAt: string, nowMs: number): boolean {
  return nowMs - Date.parse(reviewedAt) > GRADE_WAIT_MS
}
