import type { SetFormValues } from '@quizlet/shared'
import type { FieldErrors } from 'react-hook-form'

/** Annonce TalkBack après avoir déplacé une carte (positions affichées à partir de 1). */
export function moveAnnouncement(from: number, to: number): string {
  return `Carte ${from + 1} déplacée en position ${to + 1}.`
}

/** Annonce TalkBack après avoir supprimé une carte. */
export function removeAnnouncement(index: number): string {
  return `Carte ${index + 1} supprimée.`
}

export type ErrorTarget = { kind: 'header' } | { kind: 'card'; index: number }

/**
 * Où ramener l'écran quand l'enregistrement échoue à la validation : la liste est virtualisée, une
 * carte en erreur peut être hors écran (le focus automatique de RHF n'atteint que les champs
 * montés). Les champs et l'erreur globale des cartes sont dans l'en-tête de la liste.
 */
export function firstErrorTarget(errors: FieldErrors<SetFormValues>): ErrorTarget | null {
  if (errors.title || errors.description || errors.visibility || errors.tags) {
    return { kind: 'header' }
  }
  const cards = errors.cards
  if (!cards) return null
  if (cards.root || cards.message) return { kind: 'header' }
  const length = cards.length ?? 0
  for (let index = 0; index < length; index++) {
    if (cards[index]) return { kind: 'card', index }
  }
  return null
}
