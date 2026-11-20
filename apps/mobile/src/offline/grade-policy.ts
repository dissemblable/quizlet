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
  /**
   * Utilisateur connecté au moment du tap (`me.user.id` du cache). La porte d'envoi abandonne la
   * note si le compte de la session a changé entre-temps. Absent : inconnu (ancienne mutation
   * restaurée, `/api/me` pas encore chargé) : la note n'est pas contrôlée.
   */
  ownerId?: string
}

/** Réponse de `POST /api/review/cards/:cardId` (champs utilisés ici). */
export interface GradeResponse {
  card: QueueCard | null
  ignored: boolean
}

/**
 * Envoi abandonné sans appel serveur (propriétaire du cache ou de la note différent de
 * l'utilisateur connecté) : jamais rejoué, et absent du compte rendu de synchronisation (la note
 * n'est pas celle de la personne connectée : lui en parler serait faux et déplacé).
 */
export class GradeAbortedError extends Error {
  constructor() {
    super("Envoi de la note abandonné : elle n'appartient pas au compte connecté.")
    this.name = 'GradeAbortedError'
  }
}

/**
 * `/api/me` a refusé la vérification du compte (4xx hors session) : ce n'est pas un refus de la
 * note. Réessayable (dans la limite des pannes serveur), jamais un abandon immédiat.
 */
export class OwnerCheckError extends Error {
  constructor(cause: unknown) {
    super('Vérification du compte impossible pour le moment.', { cause })
    this.name = 'OwnerCheckError'
  }
}

/** Réessais d'une note derrière une panne serveur (5xx, erreur inconnue) avant de l'abandonner. */
export const MAX_SERVER_RETRIES = 10

/**
 * Faut-il réessayer l'envoi d'une note ? Oui pour le réseau, les 5xx, la session expirée (la porte
 * d'envoi attend la reconnexion) et les 4xx transitoires (408, 429) ; non pour les refus
 * définitifs (carte supprimée, accès refusé, requête invalide), qui abandonnent la note.
 * Voir `shouldRetryGrade` pour la limite du nombre d'essais.
 */
export function isRetryable(error: unknown): boolean {
  if (error instanceof GradeAbortedError) return false
  if (error instanceof ApiError) {
    if (isWaitingError(error)) return true
    return !(error.status >= 400 && error.status < 500)
  }
  // Panne inconnue (TypeError, abandon…) : une note ne se perd jamais sur une hypothèse.
  return true
}

/** Attente sans faute de la note : réseau, session à rouvrir, 408, 429. Réessayée sans limite. */
function isWaitingError(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false
  return (
    error.needsLogin ||
    error.code === 'NETWORK_ERROR' ||
    error.status === 408 ||
    error.status === 429
  )
}

/**
 * `retry` de la mutation de note. Les attentes (réseau, session, 408, 429) sont illimitées ; les 5xx
 * et les erreurs inconnues le sont jusqu'à `MAX_SERVER_RETRIES` : une note qui fait planter le
 * serveur bloquerait sinon toute la file (un seul `scope`), pour toujours. `failureCount` repart de
 * zéro à chaque redémarrage de l'app (compteur en mémoire).
 */
export function shouldRetryGrade(failureCount: number, error: unknown): boolean {
  if (!isRetryable(error)) return false
  return isWaitingError(error) || failureCount < MAX_SERVER_RETRIES
}

/** Délai avant la tentative suivante : 1 s, 2 s, 4 s… plafonné à 30 s. */
export function retryDelay(failureCount: number): number {
  return Math.min(1000 * 2 ** failureCount, 30_000)
}

/** `me.user.id` d'une réponse `/api/me` (cache `['me']`), ou `undefined` si absent ou de forme inattendue. */
export function ownerIdFromMe(me: unknown): string | undefined {
  if (typeof me !== 'object' || me === null || !('user' in me)) return undefined
  const user = me.user
  if (typeof user !== 'object' || user === null || !('id' in user)) return undefined
  return typeof user.id === 'string' && user.id !== '' ? user.id : undefined
}

export function buildGradeVariables(
  card: { id: string; state: CardState },
  rating: Rating,
  now: Date = new Date(),
  ownerId?: string,
): GradeVariables {
  return {
    cardId: card.id,
    rating,
    reviewedAt: now.toISOString(),
    cardState: card.state,
    ...(ownerId === undefined ? {} : { ownerId }),
  }
}

/** Variables relues du stockage : une forme inattendue est ignorée plutôt que supposée. */
export function isGradeVariables(value: unknown): value is GradeVariables {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.cardId === 'string' &&
    typeof v.reviewedAt === 'string' &&
    (v.ownerId === undefined || typeof v.ownerId === 'string') &&
    RATINGS.some((rating) => rating === v.rating) &&
    CARD_STATES.some((state) => state === v.cardState)
  )
}

/** La note a attendu plus que la fenêtre de `useGrade` (hors ligne, lenteur, redémarrage). */
export function isDeferred(reviewedAt: string, nowMs: number): boolean {
  return nowMs - Date.parse(reviewedAt) > GRADE_WAIT_MS
}
