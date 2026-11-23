import type { PersistedClient } from '@tanstack/react-query-persist-client'

type PersistedQuery = PersistedClient['clientState']['queries'][number]

/** Taille mesurée en caractères UTF-16 (les accents pèsent un peu plus sur disque : marge prise). */
export const MAX_CACHE_CHARS = 1_500_000

/** 0 : détail de set (retiré en premier) ; 1 : liste de sets ; `null` : jamais retiré. */
function dropRank(query: PersistedQuery): 0 | 1 | null {
  const [root, kind] = query.queryKey
  if (root !== 'sets') return null
  if (kind === 'detail') return 0
  return kind === 'list' ? 1 : null
}

/**
 * Ramène le cache sous `maxChars` : retire d'abord les détails de set les plus anciens, puis les
 * listes. Ne touche jamais la file de révision, le résumé, `me`, dossiers, tags, paramètres ni les
 * mutations (notes en attente). Meilleur effort : si cela ne suffit pas, le reste est renvoyé tel quel.
 */
export function trimPersistedClient(client: PersistedClient, maxChars: number): PersistedClient {
  let size = JSON.stringify(client).length
  if (size <= maxChars) return client

  const { queries } = client.clientState
  const candidates = queries
    .map((query, index) => ({ index, rank: dropRank(query), updatedAt: query.state.dataUpdatedAt }))
    .filter((candidate) => candidate.rank !== null)
    .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0) || a.updatedAt - b.updatedAt || a.index - b.index)

  const dropped = new Set<number>()
  for (const { index } of candidates) {
    if (size <= maxChars) break
    const query = queries[index]
    if (!query) continue
    size -= JSON.stringify(query).length + 1
    dropped.add(index)
  }
  if (dropped.size === 0) return client
  return {
    ...client,
    clientState: {
      ...client.clientState,
      queries: queries.filter((_query, index) => !dropped.has(index)),
    },
  }
}
