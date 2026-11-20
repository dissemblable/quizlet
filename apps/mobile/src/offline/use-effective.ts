import { useReviewSummary } from '@/lib/queries'

/**
 * CONTRAT : `cards` privées des cartes dont la note est en attente d'envoi (elles ne sont plus à
 * réviser). `undefined` en entrée → `undefined`. Provisoire : renvoie `cards` tel quel.
 */
export function useEffectiveCards<T extends { id: string }>(
  cards: T[] | undefined,
): T[] | undefined {
  return cards
}

/**
 * CONTRAT : comme `useReviewSummary()` (même résultat de requête) mais avec `data` ajusté des notes
 * en attente (`due` / `new` en moins). Sert au badge de l'onglet, au bandeau de la bibliothèque et
 * au rappel. Provisoire : `useReviewSummary()` tel quel.
 */
export function useEffectiveSummary(): ReturnType<typeof useReviewSummary> {
  return useReviewSummary()
}
