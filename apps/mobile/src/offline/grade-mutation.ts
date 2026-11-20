import type { QueryClient } from '@tanstack/react-query'
import {
  GradeAbortedError,
  type GradeResponse,
  type GradeVariables,
  isDeferred,
  isRetryable,
  retryDelay,
} from './grade-policy'
import { GRADE_MUTATION_KEY, GRADE_SCOPE_ID, REVIEW_QUEUE_KEY, REVIEW_SUMMARY_KEY } from './keys'
import { emptyTally, type SyncReport, syncReport } from './sync-report'

export interface GradeMutationDeps {
  /** `POST /api/review/cards/:cardId` avec `{ rating, reviewedAt }`. */
  postGrade(variables: GradeVariables): Promise<GradeResponse>
  /** Porte d'envoi (session, propriétaire) : voir `createSendGate`. */
  whenReadyToSend(): Promise<void>
  /** Toast de fin de synchronisation. */
  report(report: SyncReport): void
  now?(): number
}

/** La carte notée ne doit plus être proposée par les files en cache (persistées comprises). */
function removeCardFromQueues(client: QueryClient, cardId: string): void {
  client.setQueriesData<{ cards: { id: string }[] }>(
    { queryKey: REVIEW_QUEUE_KEY },
    (queue) => queue && { ...queue, cards: queue.cards.filter((card) => card.id !== cardId) },
  )
}

/**
 * Déclare la mutation `['review','grade']` : à appeler à la CRÉATION du client, avant toute
 * restauration (une mutation restaurée n'a que ses clés : `mutationFn`, `scope`, `retry`… viennent
 * de ces valeurs par défaut, comme les callbacks de `.mutate()` qui meurent au redémarrage).
 */
export function installGradeMutation(client: QueryClient, deps: GradeMutationDeps): void {
  const now = deps.now ?? Date.now
  let tally = emptyTally()

  // Dans `onSuccess` / `onError`, la mutation courante est encore `pending` : elle est la dernière
  // quand elle est seule.
  const isLastPending = () => client.isMutating({ mutationKey: GRADE_MUTATION_KEY }) <= 1

  function flushReport(): void {
    if (!isLastPending()) return
    const report = syncReport(tally)
    tally = emptyTally()
    if (report) deps.report(report)
  }

  client.setMutationDefaults(GRADE_MUTATION_KEY, {
    mutationFn: async (variables: GradeVariables) => {
      await deps.whenReadyToSend()
      return deps.postGrade(variables)
    },
    scope: { id: GRADE_SCOPE_ID },
    retry: (_failureCount, error) => isRetryable(error),
    retryDelay: (failureCount) => retryDelay(failureCount),
    onSuccess: (data: GradeResponse, variables: GradeVariables) => {
      removeCardFromQueues(client, variables.cardId)
      if (isDeferred(variables.reviewedAt, now())) {
        if (data.ignored) tally.ignored++
        else tally.synced++
      }
      // Pas de requête de résumé par note : seulement quand la file des notes est vide.
      if (isLastPending()) void client.invalidateQueries({ queryKey: REVIEW_SUMMARY_KEY })
      flushReport()
    },
    onError: (error: Error, variables: GradeVariables) => {
      if (error instanceof GradeAbortedError) return
      removeCardFromQueues(client, variables.cardId)
      // Une note refusée dans la fenêtre de `useGrade` fait rejeter `grade()` : l'écran affiche déjà
      // l'erreur, pas de second toast.
      if (isDeferred(variables.reviewedAt, now())) tally.dropped++
      flushReport()
    },
  })
}
