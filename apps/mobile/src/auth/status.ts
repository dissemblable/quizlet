import { createObservable } from './observable'
import type { AuthStatus } from './types'

/**
 * État d'authentification, avec les seules transitions autorisées :
 * - `settle` : fin du chargement (lecture du stockage), sans effet si l'état a déjà quitté `loading`
 *   (une connexion par `/callback` peut finir avant la lecture au démarrage) ;
 * - `markSignedIn` / `markSignedOut` : connexion réussie / déconnexion explicite ;
 * - `markExpired` : `signedIn` → `expired` UNIQUEMENT (la garde de navigation monte `(app)` pour
 *   `signedIn` et `expired` : une session « expirée » sans jamais avoir été ouverte afficherait l'app).
 */
export interface StatusStore {
  get(): AuthStatus
  subscribe(listener: (status: AuthStatus) => void): () => void
  settle(next: 'signedIn' | 'signedOut'): void
  markSignedIn(): void
  markSignedOut(): void
  markExpired(): void
  /** Résout dès que l'état vaut `signedIn` (tout de suite s'il l'est déjà). */
  whenSignedIn(): Promise<void>
}

export function createStatusStore(initial: AuthStatus = 'loading'): StatusStore {
  const state = createObservable<AuthStatus>(initial)
  const subscribe = state.subscribe
  return {
    get: state.get,
    subscribe,
    settle(next) {
      if (state.get() === 'loading') state.set(next)
    },
    markSignedIn: () => state.set('signedIn'),
    markSignedOut: () => state.set('signedOut'),
    markExpired() {
      if (state.get() === 'signedIn') state.set('expired')
    },
    whenSignedIn() {
      if (state.get() === 'signedIn') return Promise.resolve()
      return new Promise<void>((resolve) => {
        const unsubscribe = subscribe((status) => {
          if (status !== 'signedIn') return
          unsubscribe()
          resolve()
        })
      })
    },
  }
}

/** Instance de l'application (câblée par `runtime.ts`). Les tests créent la leur avec la fabrique. */
export const authStatusStore: StatusStore = createStatusStore()

/** CONTRAT : état d'authentification courant, lisible hors React (file d'envoi hors ligne…). */
export function getAuthStatus(): AuthStatus {
  return authStatusStore.get()
}

/**
 * CONTRAT : appelle `listener` à chaque changement d'état (pas à l'abonnement). Renvoie la fonction
 * de désabonnement.
 */
export function subscribeAuthStatus(listener: (status: AuthStatus) => void): () => void {
  return authStatusStore.subscribe(listener)
}

/**
 * CONTRAT : résout dès que l'état est `signedIn` (immédiatement s'il l'est déjà) ; reste en attente
 * pendant `loading`, `signedOut` et `expired`. Sert de porte à l'envoi des notes en attente.
 */
export function whenAuthenticated(): Promise<void> {
  return authStatusStore.whenSignedIn()
}
