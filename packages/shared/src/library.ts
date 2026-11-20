/** Filtres de la bibliothèque (reflétés dans l'URL). `folder` : identifiant, ou « none ». */
export interface LibraryFilters {
  q: string
  folder?: string
  tags: string[]
  page: number
}

/** Ce que `readLibraryFilters` lit d'un `URLSearchParams` (le package n'a pas les types DOM). */
interface SearchParamsLike {
  get(name: string): string | null
}

/** Filtres de la bibliothèque lus dans l'URL. L'API valide les valeurs (dossier, tags). */
export function readLibraryFilters(params: SearchParamsLike): LibraryFilters {
  const page = Number(params.get('page'))
  return {
    q: params.get('q') ?? '',
    folder: params.get('folder') || undefined,
    tags: (params.get('tags') ?? '').split(',').filter(Boolean),
    page: Number.isInteger(page) && page > 1 ? page : 1,
  }
}

/** Paramètres d'URL (et de requête à l'API) des filtres, sans les valeurs par défaut. */
export function libraryParams({ q, folder, tags, page }: LibraryFilters): Record<string, string> {
  return {
    ...(q ? { q } : {}),
    ...(folder ? { folder } : {}),
    ...(tags.length > 0 ? { tags: tags.join(',') } : {}),
    ...(page > 1 ? { page: String(page) } : {}),
  }
}
