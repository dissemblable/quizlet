import { ApiError } from '@quizlet/shared'
import { QueryClient } from '@tanstack/react-query'

/** Réessaie les pannes transitoires, jamais les erreurs métier (4xx). */
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status > 0 && error.status < 500) return false
  return failureCount < 2
}

let client: QueryClient | undefined

/**
 * CONTRAT : le `QueryClient` unique de l'app (singleton de module), utilisable hors React
 * (`purgeUserData`, file de notes). Version provisoire : un client simple, sans persistance.
 */
export function getQueryClient(): QueryClient {
  client ??= new QueryClient({
    defaultOptions: {
      queries: { retry: shouldRetry, staleTime: 30_000, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  })
  return client
}
