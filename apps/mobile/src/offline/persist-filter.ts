import { ME_KEY } from './keys'

interface QueryLike {
  queryKey: readonly unknown[]
  state: { status: string }
}

interface MutationLike {
  options: { mutationKey?: readonly unknown[] }
  state: { status: string }
}

// Clés à un seul élément : la liste blanche ne porte que sur ce premier élément.
const SINGLE_KEYS = new Set<unknown>([ME_KEY[0], 'folders', 'tags', 'settings'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/**
 * Liste blanche des requêtes persistées : `me`, `folders`, `tags`, `settings`, les listes de sets
 * sans recherche, les détails de set, le résumé et les files de révision. Exclues : quiz, cartes dues
 * (`['review','due',*]`) et recherches.
 */
export function isPersistedQueryKey(key: readonly unknown[]): boolean {
  const [root, kind, third] = key
  if (key.length === 1) return SINGLE_KEYS.has(root)
  if (root === 'sets' && kind === 'detail') return key.length === 3 && typeof third === 'string'
  if (root === 'sets' && kind === 'list') return key.length === 3 && isRecord(third) && !third.q
  if (root === 'review' && kind === 'summary') return key.length === 2
  if (root === 'review' && kind === 'queue') return key.length === 3
  return false
}

/** Remplace le défaut de TanStack, qui exigeait déjà `success` : on le garde. */
export function shouldDehydrateQuery(query: QueryLike): boolean {
  return query.state.status === 'success' && isPersistedQueryKey(query.queryKey)
}

/**
 * Le défaut (`isPaused`) perdrait une note en vol au moment de la mort de l'app : on garde toute
 * mutation `['review', …]` encore `pending`.
 */
export function shouldDehydrateMutation(mutation: MutationLike): boolean {
  return mutation.options.mutationKey?.[0] === 'review' && mutation.state.status === 'pending'
}
