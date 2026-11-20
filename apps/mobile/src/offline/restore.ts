import type { QueryClient } from '@tanstack/react-query'
import { GRADE_MUTATION_KEY } from './keys'

const noop = () => {}

/**
 * Relance les notes restaurées (`pending`) dans l'ordre : sans retryer (cache fraîchement
 * hydraté), `continue()` rappelle `execute` avec les dernières variables ; une mutation déjà
 * lancée n'est pas touchée. Hors ligne ou derrière une autre note du même `scope`, elle se met en
 * pause d'elle-même. Ne renvoie RIEN : le fournisseur de persistance attend la promesse que
 * renverrait `onSuccess`, et la restauration resterait « en cours » tant que les notes n'ont pas
 * toutes été envoyées.
 */
export function resumePendingGrades(client: QueryClient): void {
  for (const mutation of client
    .getMutationCache()
    .findAll({ mutationKey: GRADE_MUTATION_KEY, status: 'pending' })) {
    mutation.continue().catch(noop)
  }
}

export interface RestoreHandlers {
  onSuccess(): void
  onError(): void
  /** Faux tant que le cache n'est pas restauré : écrire avant l'écraserait. */
  isRestored(): boolean
}

/** `onSuccess` / `onError` de `PersistQueryClientProvider`, qui marquent la fin de la restauration. */
export function createRestoreHandlers(client: QueryClient): RestoreHandlers {
  let restored = false
  return {
    onSuccess() {
      restored = true
      resumePendingGrades(client)
    },
    onError() {
      restored = true
    },
    isRestored: () => restored,
  }
}
