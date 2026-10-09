import type { SetInput } from '@quizlet/shared'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { InferResponseType } from 'hono/client'
import { api } from './api'
import { unwrap } from './http'

export type SetDetail = InferResponseType<(typeof api.sets)[':id']['$get'], 200>['set']
export type SetSummary = InferResponseType<typeof api.sets.$get, 200>['sets'][number]

export const queryKeys = {
  me: ['me'] as const,
  sets: ['sets'] as const,
  setLists: ['sets', 'list'] as const,
  setList: (search: string) => ['sets', 'list', search] as const,
  set: (id: string) => ['sets', 'detail', id] as const,
}

/** Utilisateur courant (identité SSO) et URL de déconnexion. */
export function useMe() {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: () => unwrap(api.me.$get()),
    staleTime: 5 * 60_000,
  })
}

/** Ma bibliothèque, filtrée par titre. Garde la liste précédente affichée pendant une recherche. */
export function useSets(search: string) {
  return useQuery({
    queryKey: queryKeys.setList(search),
    queryFn: async () => (await unwrap(api.sets.$get({ query: search ? { q: search } : {} }))).sets,
    placeholderData: keepPreviousData,
  })
}

export function useSet(id: string) {
  return useQuery({
    queryKey: queryKeys.set(id),
    queryFn: async () => (await unwrap(api.sets[':id'].$get({ param: { id } }))).set,
  })
}

function useSetCache() {
  const queryClient = useQueryClient()
  return {
    store(set: SetDetail) {
      queryClient.setQueryData(queryKeys.set(set.id), set)
      void queryClient.invalidateQueries({ queryKey: queryKeys.setLists })
    },
    drop(id: string) {
      queryClient.removeQueries({ queryKey: queryKeys.set(id) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.setLists })
    },
  }
}

export function useCreateSet() {
  const cache = useSetCache()
  return useMutation({
    mutationFn: async (input: SetInput) => (await unwrap(api.sets.$post({ json: input }))).set,
    onSuccess: cache.store,
  })
}

export function useUpdateSet(id: string) {
  const cache = useSetCache()
  return useMutation({
    mutationFn: async (input: SetInput) =>
      (await unwrap(api.sets[':id'].$put({ param: { id }, json: input }))).set,
    onSuccess: cache.store,
  })
}

export function useDeleteSet() {
  const cache = useSetCache()
  return useMutation({
    mutationFn: (id: string) => unwrap(api.sets[':id'].$delete({ param: { id } })),
    onSuccess: (_, id) => cache.drop(id),
  })
}

export function useDuplicateSet() {
  const cache = useSetCache()
  return useMutation({
    mutationFn: async (id: string) =>
      (await unwrap(api.sets[':id'].duplicate.$post({ param: { id } }))).set,
    onSuccess: cache.store,
  })
}
