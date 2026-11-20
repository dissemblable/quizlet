import type { AuthStatus } from '@/auth/types'
import { GradeAbortedError } from './grade-policy'
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
   * (non rejouée). Sans propriétaire mémorisé, l'utilisateur courant est adopté. Une erreur de
   * `/api/me` est propagée : la note la réessaie.
   *
   * Le cache restauré contient déjà un `/api/me` : s'y fier enverrait les notes d'un compte avec
   * le jeton d'un autre (connexion d'un second utilisateur depuis la bannière « Se reconnecter »).
   */
  whenReadyToSend(): Promise<void>
  dispose(): void
}

export function createSendGate(deps: SendGateDeps): SendGate {
  // Chaque changement d'état d'auth ouvre une nouvelle « session » à revérifier.
  let epoch = 0
  let verifiedEpoch = -1
  const unsubscribe = deps.subscribeStatus(() => {
    epoch++
  })

  return {
    async whenReadyToSend() {
      for (;;) {
        await deps.whenAuthenticated()
        const current = epoch
        if (verifiedEpoch === current) return
        const userId = await deps.fetchUserId()
        // L'état a changé pendant la requête : ce `/api/me` n'est peut-être plus celui de la session.
        if (epoch !== current) continue
        const owner = await deps.owner.get()
        if (owner === null) await deps.owner.set(userId)
        else if (owner !== userId) {
          await deps.purge()
          throw new GradeAbortedError()
        }
        verifiedEpoch = current
        return
      }
    },
    dispose: unsubscribe,
  }
}
