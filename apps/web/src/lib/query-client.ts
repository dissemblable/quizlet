import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { ApiError } from './http'
import { markSessionExpired } from './session'

function onError(error: unknown) {
  if (error instanceof ApiError && error.needsLogin) markSessionExpired()
}

/** Réessaie les pannes transitoires, jamais les erreurs métier (4xx) ni une session expirée. */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status > 0 && error.status < 500) return false
  return failureCount < 2
}

export function createQueryClient({ retry = true }: { retry?: boolean } = {}) {
  return new QueryClient({
    queryCache: new QueryCache({ onError }),
    mutationCache: new MutationCache({ onError }),
    defaultOptions: {
      queries: {
        retry: retry ? shouldRetry : false,
        staleTime: 30_000,
        // Un retour sur l'onglet ne doit pas régénérer un quiz en cours.
        refetchOnWindowFocus: false,
      },
      mutations: { retry: false },
    },
  })
}
