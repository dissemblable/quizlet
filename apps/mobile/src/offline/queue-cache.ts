import type { CardState } from '@quizlet/shared'

/** File privée des cartes dont la note est en attente (même tableau si rien à retirer). */
export function effectiveQueue<T extends { id: string }>(
  cards: T[],
  pendingIds: readonly string[],
): T[] {
  if (pendingIds.length === 0) return cards
  const pending = new Set(pendingIds)
  const kept = cards.filter((card) => !pending.has(card.id))
  return kept.length === cards.length ? cards : kept
}

/**
 * Compteurs du jour moins les notes en attente : une carte nouvelle retire une « nouvelle »,
 * les autres une « due » (jamais sous 0).
 */
export function effectiveSummary<S extends { due: number; new: number }>(
  summary: S,
  pendingCards: readonly { cardState: CardState }[],
): S {
  if (pendingCards.length === 0) return summary
  const fresh = pendingCards.filter((card) => card.cardState === 'new').length
  return {
    ...summary,
    due: Math.max(0, summary.due - (pendingCards.length - fresh)),
    new: Math.max(0, summary.new - fresh),
  }
}
