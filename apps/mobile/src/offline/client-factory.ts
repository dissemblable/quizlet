import { ApiError } from '@quizlet/shared'
import { QueryClient } from '@tanstack/react-query'
import { type GradeMutationDeps, installGradeMutation } from './grade-mutation'

/**
 * Réessaie les pannes transitoires (réseau, 5xx), jamais les erreurs métier (4xx) ni une session
 * expirée (le rafraîchissement du jeton a déjà été tenté par `authFetch`).
 */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError) {
    if (error.needsLogin) return false
    if (error.status >= 400 && error.status < 500) return false
  }
  return failureCount < 2
}

/**
 * `gcTime: Infinity` : une requête persistée ne doit pas disparaître de la mémoire (et donc du
 * disque) pendant l'usage ; `maxAge: Infinity` côté persister, sinon `removeClient()` effacerait
 * aussi la file de notes après 24 h.
 */
export function createAppQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: shouldRetry,
        staleTime: 30_000,
        gcTime: Number.POSITIVE_INFINITY,
        refetchOnWindowFocus: false,
      },
      mutations: { retry: false },
    },
  })
}

/** Client complet : les valeurs par défaut de la mutation de note existent AVANT toute restauration. */
export function createOfflineClient(deps: GradeMutationDeps): QueryClient {
  const client = createAppQueryClient()
  installGradeMutation(client, deps)
  return client
}
