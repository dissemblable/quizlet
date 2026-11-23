import { LIBRARY_PAGE_SIZE, type LibraryFilters } from '@quizlet/shared'

/** Filtres au premier affichage : toute la bibliothèque, première page. */
export const INITIAL_FILTERS: LibraryFilters = { q: '', tags: [], page: 1 }

/** Pourquoi la liste est vide : recherche sans résultat, filtres trop stricts, ou rien à lister. */
export type EmptyVariant = 'search' | 'filters' | 'library'

/** Changer un filtre repart de la page 1, sauf si le changement fixe lui-même la page. */
export function applyFilterPatch(
  filters: LibraryFilters,
  patch: Partial<LibraryFilters>,
): LibraryFilters {
  return { ...filters, page: 1, ...patch }
}

/** Sélection multiple en ET : ajoute le tag s'il est absent, le retire sinon. */
export function toggleTag(tags: readonly string[], id: string): string[] {
  return tags.includes(id) ? tags.filter((tag) => tag !== id) : [...tags, id]
}

/** Retire un tag supprimé des filtres (ne l'ajoute jamais, contrairement à `toggleTag`). */
export function removeTag(tags: readonly string[], id: string): string[] {
  return tags.filter((tag) => tag !== id)
}

/** Un dossier ou au moins un tag est sélectionné. */
export function isFiltered({ folder, tags }: Pick<LibraryFilters, 'folder' | 'tags'>): boolean {
  return Boolean(folder) || tags.length > 0
}

/** Nombre de pages (au moins une, même pour une liste vide). */
export function pageCount(total: number, pageSize: number = LIBRARY_PAGE_SIZE): number {
  return pageSize > 0 ? Math.max(1, Math.ceil(total / pageSize)) : 1
}

/** Une page au-delà de la première sans résultat compte comme « filtres » (retour à la page 1). */
export function emptyVariant(filters: LibraryFilters): EmptyVariant {
  if (filters.q) return 'search'
  if (isFiltered(filters) || filters.page > 1) return 'filters'
  return 'library'
}
