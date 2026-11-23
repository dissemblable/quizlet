import { unwrap } from '@quizlet/shared'
import type { QueryClient } from '@tanstack/react-query'
import { subscribeAuthStatus, whenAuthenticated } from '@/auth/status'
import { api } from '@/lib/api'
import type { queryKeys } from '@/lib/queries'
import { toast } from '@/ui'
import type { GradeMutationDeps } from './grade-mutation'
import type { GradeVariables } from './grade-policy'
import { ME_KEY, REVIEW_SUMMARY_KEY, reviewQueueKey, setDetailKey } from './keys'
import { createSendGate } from './send-gate'
import { ownerStore, purgeStoredData } from './storage-adapter'

/** Vérifié à la compilation : les clés de `keys.ts` restent celles de `queryKeys`. */
export const KEYS_MATCH_QUERY_KEYS = {
  me: ME_KEY satisfies typeof queryKeys.me,
  reviewSummary: REVIEW_SUMMARY_KEY satisfies typeof queryKeys.reviewSummary,
  reviewQueue: reviewQueueKey('x') satisfies ReturnType<typeof queryKeys.reviewQueue>,
  set: setDetailKey('x') satisfies ReturnType<typeof queryKeys.set>,
}

// Mêmes requêtes que `useReviewSummary`, `useReviewQueue` et `useSet` (`@/lib/queries`) : le
// préchargement remplit les mêmes entrées de cache.
export const fetchReviewSummary = () => unwrap(api.review.summary.$get())
export const fetchReviewQueue = () => unwrap(api.review.queue.$get({ query: {} }))
export const fetchSetDetail = async (id: string) =>
  (await unwrap(api.sets[':id'].$get({ param: { id } }))).set

const postGrade = (variables: GradeVariables) =>
  unwrap(
    api.review.cards[':cardId'].$post({
      param: { cardId: variables.cardId },
      json: { rating: variables.rating, reviewedAt: variables.reviewedAt },
    }),
  )

/**
 * Dépendances réelles de la mutation de note. `getClient` est lu à l'usage (le client n'existe pas
 * encore quand on crée la porte d'envoi).
 */
export function createRuntimeDeps(getClient: () => QueryClient): GradeMutationDeps {
  const gate = createSendGate({
    whenAuthenticated,
    subscribeStatus: subscribeAuthStatus,
    // Toujours frais (jamais le `/api/me` restauré du cache) ; `fetchQuery` met aussi le cache à jour.
    fetchUserId: async () => {
      const me = await getClient().fetchQuery({
        queryKey: ME_KEY,
        queryFn: () => unwrap(api.me.$get()),
        staleTime: 0,
        retry: false,
      })
      return me.user.id
    },
    owner: ownerStore,
    purge: () => purgeStoredData(getClient(), { refetch: true }),
  })

  return {
    postGrade,
    whenReadyToSend: () => gate.whenReadyToSend(),
    report: ({ message, kind }) => (kind === 'error' ? toast.error(message) : toast.info(message)),
  }
}
