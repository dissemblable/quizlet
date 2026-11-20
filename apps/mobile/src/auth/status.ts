import type { AuthStatus } from './types'

/** CONTRAT : état d'authentification courant, lisible hors React (file d'envoi hors ligne…). */
export function getAuthStatus(): AuthStatus {
  return 'loading'
}

/**
 * CONTRAT : appelle `listener` à chaque changement d'état (pas à l'abonnement). Renvoie la fonction
 * de désabonnement.
 */
export function subscribeAuthStatus(_listener: (status: AuthStatus) => void): () => void {
  return () => {}
}

/**
 * CONTRAT : résout dès que l'état est `signedIn` (immédiatement s'il l'est déjà) ; reste en attente
 * pendant `loading`, `signedOut` et `expired`. Sert de porte à l'envoi des notes en attente.
 */
export function whenAuthenticated(): Promise<void> {
  return Promise.resolve()
}
