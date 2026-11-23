import { useMemo } from 'react'
import { useReviewSummary } from '@/lib/queries'
import { effectiveQueue, effectiveSummary } from './queue-cache'
import { usePendingGrades } from './use-pending-grades'

/**
 * CONTRAT : `cards` privées des cartes dont la note est en attente d'envoi (elles ne sont plus à
 * réviser). `undefined` en entrée → `undefined`.
 */
export function useEffectiveCards<T extends { id: string }>(
  cards: T[] | undefined,
): T[] | undefined {
  const pending = usePendingGrades()
  return useMemo(
    () =>
      cards &&
      effectiveQueue(
        cards,
        pending.map((grade) => grade.cardId),
      ),
    [cards, pending],
  )
}

/**
 * CONTRAT : comme `useReviewSummary()` (même résultat de requête) mais avec `data` ajusté des notes
 * en attente (`due` / `new` en moins). Sert au badge de l'onglet, au bandeau de la bibliothèque et
 * au rappel.
 */
export function useEffectiveSummary(): ReturnType<typeof useReviewSummary> {
  const query = useReviewSummary()
  const pending = usePendingGrades()
  const raw = query.data
  const adjusted = useMemo(() => raw && effectiveSummary(raw, pending), [raw, pending])
  if (adjusted === raw) return query
  // `data` ajusté dans un résultat qui garde le statut de la requête (succès : `data` défini).
  return { ...query, data: adjusted } as typeof query
}
