import type { Rating } from '@quizlet/shared'
import type { QueueCard } from '@/lib/queries'

/**
 * Issue d'une note (`useGrade().grade`) :
 * - `synced` : le serveur a répondu (en ligne, < 3 s) ; `requeue` : la carte revient en fin de
 *   séance (comme le web) ; `ignored` : note non appliquée par le serveur (périmée, déjà reçue) ;
 * - `queued` : note mise en attente (hors ligne, ou réponse trop lente) : le reducer partagé reçoit
 *   alors `gradedLocal`.
 */
export type GradeOutcome =
  | { kind: 'synced'; requeue: QueueCard | null; ignored: boolean }
  | { kind: 'queued' }

export interface GradeApi {
  /**
   * Note une carte maintenant (`reviewedAt = new Date().toISOString()`, avec le `Z`). Ne rejette
   * que pour une erreur définitive (4xx) en ligne ; hors ligne elle résout `{ kind: 'queued' }`.
   */
  grade(card: QueueCard, rating: Rating): Promise<GradeOutcome>
  /** Une note est en cours d'envoi (boutons désactivés). */
  pending: boolean
}

export interface OfflineStatus {
  online: boolean
  /** Notes en attente d'envoi (persistées). */
  pendingGrades: number
  /**
   * Restauration du cache persisté en cours (afficher le chargement, pas « hors ligne ») : la
   * notation reste désactivée tant qu'elle dure (ordre des notes), voir `useOfflineStatus`.
   */
  restoring: boolean
}
