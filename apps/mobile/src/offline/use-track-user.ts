import { onlineManager, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { onAppStateChange } from './network-adapter'
import { createReviewPrefetcher } from './prefetch-plan'
import { trackOwner } from './purge-data'
import { getQueryClient } from './query-client'
import { fetchReviewQueue, fetchReviewSummary, fetchSetDetail } from './runtime-deps'
import { ownerStore, purgeStoredData } from './storage-adapter'
import { useIsOnline } from './use-online'

/**
 * CONTRAT : mémorise le propriétaire du cache hors ligne (`quizlet.offline.owner.v1`). Si
 * `userId` diffère du propriétaire stocké, purge d'abord le cache et la file de notes. Appelé par
 * `AppGate` avec `useMe().data?.user.id` (`undefined` tant que /api/me n'a pas répondu).
 */
export function useTrackUser(userId: string | undefined): void {
  const client = useQueryClient()
  useEffect(() => {
    if (!userId) return
    trackOwner(userId, {
      owner: ownerStore,
      // Écrans encore montés : les requêtes sont remises à zéro et se rechargent pour le nouveau compte.
      purge: () => purgeStoredData(client, { refetch: true }),
    }).catch((error: unknown) => console.warn('[offline] propriétaire du cache inconnu', error))
  }, [userId, client])
}

// Une seule instance : la cadence (10 min) survit aux remontages de `AppGate`.
let prefetcher: ReturnType<typeof createReviewPrefetcher> | undefined

function getPrefetcher() {
  prefetcher ??= createReviewPrefetcher({
    client: getQueryClient(),
    isOnline: () => onlineManager.isOnline(),
    fetchSummary: fetchReviewSummary,
    fetchQueue: fetchReviewQueue,
    fetchSet: fetchSetDetail,
  })
  return prefetcher
}

/**
 * CONTRAT : préchauffe les données de révision en ligne (file « all », résumé, détails des sets
 * dus) pour qu'une séance hors ligne soit possible. Ne fait rien hors ligne, ni si la file de
 * notes en attente n'est pas vide, ni plus d'une fois toutes les 10 minutes. Au premier plan et au
 * retour du réseau. Appelé par `AppGate`.
 */
export function usePrefetchReviewData(): void {
  const online = useIsOnline()
  useEffect(() => {
    const prefetch = () => void getPrefetcher()()
    if (online) prefetch()
    return onAppStateChange((state) => {
      if (state === 'active') prefetch()
    })
  }, [online])
}
