import { pluralize } from '@quizlet/shared'

/**
 * Cartes du mode écrit : tout le set, ou seulement celles dues aujourd'hui (intersection avec les
 * identifiants renvoyés par l'API ; pas encore chargés = aucune).
 */
export function selectWritePool<T extends { id: string }>(
  cards: readonly T[],
  dueIds: readonly string[] | undefined,
  onlyDue: boolean,
): T[] {
  if (!onlyDue) return [...cards]
  const due = new Set(dueIds)
  return cards.filter((card) => due.has(card.id))
}

export interface DueStatusInput {
  onlyDue: boolean
  /** Message d'erreur de la recherche des cartes dues, le cas échéant. */
  errorText: string | null
  loading: boolean
  /** Cartes retenues. */
  count: number
}

/** Ligne d'état sous l'option « à revoir » ; `null` quand l'option est décochée. */
export function dueStatus({ onlyDue, errorText, loading, count }: DueStatusInput): string | null {
  if (!onlyDue) return null
  if (errorText !== null) return errorText
  if (loading) return 'Recherche des cartes à revoir…'
  if (count === 0) return "Aucune carte de ce set n'est à revoir aujourd'hui."
  return `${pluralize(count, 'carte à revoir', 'cartes à revoir')} aujourd'hui.`
}

export function startLabel(count: number): string {
  return `Commencer (${pluralize(count, 'carte')})`
}

export const DUE_OPTION_LABEL = "Seulement les cartes à revoir aujourd'hui (répétition espacée)"
export const DUE_OFFLINE_HINT = 'Indisponible hors ligne : cette option nécessite une connexion.'
