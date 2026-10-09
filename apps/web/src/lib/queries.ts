import { useQuery } from '@tanstack/react-query'
import { api } from './api'
import { unwrap } from './http'

export const queryKeys = {
  me: ['me'] as const,
}

/** Utilisateur courant (identité SSO) et URL de déconnexion. */
export function useMe() {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: () => unwrap(api.me.$get()),
    staleTime: 5 * 60_000,
  })
}
