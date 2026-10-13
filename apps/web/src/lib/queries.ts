import type { ImportSeparators, SetInput } from '@quizlet/shared'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { InferResponseType } from 'hono/client'
import { api } from './api'
import { unwrap } from './http'
import { libraryParams } from './library'

export type SetDetail = InferResponseType<(typeof api.sets)[':id']['$get'], 200>['set']
export type SetSummary = InferResponseType<typeof api.sets.$get, 200>['sets'][number]
export type FolderSummary = InferResponseType<typeof api.folders.$get, 200>['folders'][number]
export type TagSummary = InferResponseType<typeof api.tags.$get, 200>['tags'][number]

/** Filtres de la bibliothèque (reflétés dans l'URL). `folder` : identifiant, ou « none ». */
export interface LibraryFilters {
  q: string
  folder?: string
  tags: string[]
  page: number
}

export const queryKeys = {
  me: ['me'] as const,
  sets: ['sets'] as const,
  setLists: ['sets', 'list'] as const,
  setList: (filters: LibraryFilters) => ['sets', 'list', filters] as const,
  set: (id: string) => ['sets', 'detail', id] as const,
  folders: ['folders'] as const,
  tags: ['tags'] as const,
  // Hors de ['sets', …] : aucune invalidation de set ne doit régénérer un quiz en cours.
  quiz: (id: string, attempt: number) => ['quiz', id, attempt] as const,
}

/** Utilisateur courant (identité SSO) et URL de déconnexion. */
export function useMe() {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: () => unwrap(api.me.$get()),
    staleTime: 5 * 60_000,
  })
}

/** Ma bibliothèque, filtrée et paginée. Garde la page précédente affichée pendant le chargement. */
export function useSets(filters: LibraryFilters) {
  return useQuery({
    queryKey: queryKeys.setList(filters),
    queryFn: () => unwrap(api.sets.$get({ query: libraryParams(filters) })),
    placeholderData: keepPreviousData,
  })
}

/** Recherche globale (palette Ctrl+K) : même requête, donc même cache, que la bibliothèque. */
export function useSearchSets(q: string) {
  const filters = { q, tags: [], page: 1 }
  return useQuery({
    queryKey: queryKeys.setList(filters),
    queryFn: () => unwrap(api.sets.$get({ query: libraryParams(filters) })),
    enabled: q !== '',
    placeholderData: keepPreviousData,
  })
}

export function useSet(id: string) {
  return useQuery({
    queryKey: queryKeys.set(id),
    queryFn: async () => (await unwrap(api.sets[':id'].$get({ param: { id } }))).set,
  })
}

/** Un nouveau tirage par tentative (`attempt`), jamais rafraîchi pendant qu'on y répond. */
export function useQuiz(id: string, attempt: number) {
  return useQuery({
    queryKey: queryKeys.quiz(id, attempt),
    queryFn: async () => (await unwrap(api.sets[':id'].quiz.$get({ param: { id } }))).questions,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 0,
  })
}

export function useFolders() {
  return useQuery({
    queryKey: queryKeys.folders,
    queryFn: async () => (await unwrap(api.folders.$get())).folders,
  })
}

export function useTags() {
  return useQuery({
    queryKey: queryKeys.tags,
    queryFn: async () => (await unwrap(api.tags.$get())).tags,
  })
}

/** Listes de la bibliothèque, dossiers et tags (avec leurs compteurs) à recharger. */
function useInvalidateLibrary() {
  const queryClient = useQueryClient()
  return ({ details = false } = {}) => {
    // `details` : le dossier ou les tags affichés dans le détail des sets ont pu changer.
    void queryClient.invalidateQueries({ queryKey: details ? queryKeys.sets : queryKeys.setLists })
    void queryClient.invalidateQueries({ queryKey: queryKeys.folders })
    void queryClient.invalidateQueries({ queryKey: queryKeys.tags })
  }
}

function useSetCache() {
  const queryClient = useQueryClient()
  const invalidateLibrary = useInvalidateLibrary()
  return {
    store(set: SetDetail) {
      queryClient.setQueryData(queryKeys.set(set.id), set)
      invalidateLibrary()
    },
    drop(id: string) {
      queryClient.removeQueries({ queryKey: queryKeys.set(id) })
      invalidateLibrary()
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

interface ImportRequest {
  /** Titre du nouveau set (ignoré pour un import dans un set existant). */
  title: string
  text: string
  separators: ImportSeparators
}

/** Import dans un set existant (`setId`) ou dans un nouveau set. L'API découpe le texte. */
export function useImportCards(setId?: string) {
  const queryClient = useQueryClient()
  const invalidateLibrary = useInvalidateLibrary()
  return useMutation({
    mutationFn: ({ title, text, separators }: ImportRequest) =>
      setId
        ? unwrap(api.sets[':id'].import.$post({ param: { id: setId }, json: { text, separators } }))
        : unwrap(api.sets.import.$post({ json: { title, text, separators } })),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.set(result.set.id) })
      invalidateLibrary()
    },
  })
}

/** Range un set dans un dossier, ou l'en sort (`folderId: null`). */
export function useMoveSet() {
  const invalidateLibrary = useInvalidateLibrary()
  return useMutation({
    mutationFn: ({ setId, folderId }: { setId: string; folderId: string | null }) =>
      unwrap(api.sets[':id'].folder.$put({ param: { id: setId }, json: { folderId } })),
    onSuccess: () => invalidateLibrary({ details: true }),
  })
}

export function useCreateFolder() {
  const invalidateLibrary = useInvalidateLibrary()
  return useMutation({
    mutationFn: async (name: string) =>
      (await unwrap(api.folders.$post({ json: { name } }))).folder,
    onSuccess: () => invalidateLibrary(),
  })
}

export function useRenameFolder() {
  const invalidateLibrary = useInvalidateLibrary()
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      unwrap(api.folders[':id'].$patch({ param: { id }, json: { name } })),
    onSuccess: () => invalidateLibrary(),
  })
}

export function useDeleteFolder() {
  const invalidateLibrary = useInvalidateLibrary()
  return useMutation({
    mutationFn: (id: string) => unwrap(api.folders[':id'].$delete({ param: { id } })),
    onSuccess: () => invalidateLibrary({ details: true }),
  })
}

export function useDeleteTag() {
  const invalidateLibrary = useInvalidateLibrary()
  return useMutation({
    mutationFn: (id: string) => unwrap(api.tags[':id'].$delete({ param: { id } })),
    onSuccess: () => invalidateLibrary({ details: true }),
  })
}
