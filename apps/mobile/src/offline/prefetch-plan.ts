import type { QueryClient } from '@tanstack/react-query'
import { GRADE_MUTATION_KEY, REVIEW_SUMMARY_KEY, reviewQueueKey, setDetailKey } from './keys'

export const PREFETCH_MIN_INTERVAL_MS = 10 * 60_000
/** Détails de set préchargés au plus : borne le trafic et la taille du cache. */
export const PREFETCH_MAX_SETS = 25

export interface PrefetchDeps {
  client: QueryClient
  isOnline(): boolean
  now?(): number
  fetchSummary(): Promise<unknown>
  fetchQueue(): Promise<{ cards: { setId: string }[] }>
  fetchSet(id: string): Promise<unknown>
}

/**
 * Préchauffe de quoi réviser hors ligne : résumé, file « tous mes sets » et détail des sets qui
 * ont des cartes à réviser. Ne fait rien hors ligne, tant qu'une note est en attente (la file
 * serveur n'en tient pas encore compte), ni plus d'une fois toutes les 10 minutes (compteur en
 * mémoire : un démarrage à froid préchauffe toujours).
 */
export function createReviewPrefetcher(deps: PrefetchDeps): () => Promise<void> {
  const now = deps.now ?? Date.now
  let lastRun = Number.NEGATIVE_INFINITY

  return async function prefetchReviewData() {
    const { client } = deps
    if (!deps.isOnline()) return
    if (client.isMutating({ mutationKey: GRADE_MUTATION_KEY }) > 0) return
    if (now() - lastRun < PREFETCH_MIN_INTERVAL_MS) return
    lastRun = now()

    await Promise.allSettled([
      client.prefetchQuery({
        queryKey: REVIEW_SUMMARY_KEY,
        queryFn: deps.fetchSummary,
        staleTime: 0,
      }),
      client.prefetchQuery({
        queryKey: reviewQueueKey(),
        queryFn: deps.fetchQueue,
        staleTime: 0,
      }),
    ])

    const queue = client.getQueryData<{ cards: { setId: string }[] }>(reviewQueueKey())
    const setIds = [...new Set((queue?.cards ?? []).map((card) => card.setId))].slice(
      0,
      PREFETCH_MAX_SETS,
    )
    await Promise.allSettled(
      setIds.map((id) =>
        client.prefetchQuery({ queryKey: setDetailKey(id), queryFn: () => deps.fetchSet(id) }),
      ),
    )
  }
}
