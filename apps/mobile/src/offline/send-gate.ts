import { ApiError } from '@quizlet/shared'
import type { AuthStatus } from '@/auth/types'
import { GradeAbortedError, isRetryable, OwnerCheckError } from './grade-policy'
import type { OwnerStore } from './owner-store'

export interface SendGateDeps {
  /** Résout quand la session est `signedIn` (reste en attente sinon). */
  whenAuthenticated(): Promise<void>
  subscribeStatus(listener: (status: AuthStatus) => void): () => void
  /** Identifiant de l'utilisateur d'après un `/api/me` FRAIS (jamais le cache restauré). */
  fetchUserId(): Promise<string>
  owner: Pick<OwnerStore, 'get' | 'set'>
  /** Efface cache, file de notes et propriétaire. */
  purge(): Promise<void>
}

export interface SendGate {
  /**
   * Porte d'envoi d'une note : résout quand la session est ouverte ET que `/api/me` (frais, une fois
   * par session) donne le propriétaire du cache. Autre utilisateur : purge puis `GradeAbortedError`
   * (non rejouée). Sans propriétaire mémorisé, l'utilisateur courant est adopté.
   *
   * `noteOwnerId` (compte qui a donné la note) est comparé à l'utilisateur de la session : écart →
   * `GradeAbortedError` sans purge (le cache peut être celui de la personne connectée). Il couvre le
   * cas où le propriétaire mémorisé manque ou a été adopté après coup. Absent (ancienne note) : pas
   * de contrôle.
   *
   * Une erreur de `/api/me` est propagée : la note la réessaie. Un 4xx de `/api/me` (hors session,
   * 408, 429) ne dit rien de la note : il devient une `OwnerCheckError`, réessayable.
   *
   * Le cache restauré contient déjà un `/api/me` : s'y fier enverrait les notes d'un compte avec
   * le jeton d'un autre (connexion d'un second utilisateur depuis la bannière « Se reconnecter »).
   */
  whenReadyToSend(noteOwnerId?: string): Promise<void>
  dispose(): void
}

export function createSendGate(deps: SendGateDeps): SendGate {
  // Chaque changement d'état d'auth ouvre une nouvelle « session » à revérifier.
  let epoch = 0
  let verifiedEpoch = -1
  let verifiedUserId: string | null = null
  const unsubscribe = deps.subscribeStatus(() => {
    epoch++
  })

  async function fetchUserId(): Promise<string> {
    try {
      return await deps.fetchUserId()
    } catch (error) {
      // Un 4xx de `/api/me` n'est pas un refus de la note (sinon `retry` l'abandonnerait).
      if (error instanceof ApiError && !isRetryable(error)) throw new OwnerCheckError(error)
      throw error
    }
  }

  return {
    async whenReadyToSend(noteOwnerId) {
      for (;;) {
        await deps.whenAuthenticated()
        const current = epoch
        if (verifiedEpoch !== current) {
          const userId = await fetchUserId()
          // L'état a changé pendant la requête : ce `/api/me` n'est peut-être plus celui de la session.
          if (epoch !== current) continue
          const owner = await deps.owner.get()
          if (owner === null) await deps.owner.set(userId)
          else if (owner !== userId) {
            await deps.purge()
            throw new GradeAbortedError()
          }
          verifiedEpoch = current
          verifiedUserId = userId
        }
        if (noteOwnerId !== undefined && noteOwnerId !== verifiedUserId) {
          throw new GradeAbortedError()
        }
        return
      }
    },
    dispose: unsubscribe,
  }
}
