import { errorMessage, pluralize } from '@quizlet/shared'

export const SEARCH_LABEL = "Titre, description, tag ou contenu d'une carte"
export const SEARCH_PLACEHOLDER = `${SEARCH_LABEL}…`
export const SEARCH_HINT =
  'Entrée ouvre le premier résultat. Accents pris en compte, casse ignorée. Un lien ou un identifiant de set est aussi accepté.'
export const SEARCH_OFFLINE = 'Recherche indisponible hors ligne.'
export const SEARCH_PENDING = 'Recherche…'

export function noResultMessage(search: string): string {
  return `Aucun set ne correspond à « ${search} ».`
}

/** « 3 cartes · #europe · #capitales » : sous-titre d'un résultat. */
export function resultSubtitle(cardCount: number, tags: ReadonlyArray<{ name: string }>): string {
  return `${pluralize(cardCount, 'carte')}${tags.map((tag) => ` · #${tag.name}`).join('')}`
}

export function referenceLabel(id: string): string {
  return `Ouvrir le set ${id}`
}

export type SearchOutcome =
  | { kind: 'pending' }
  | { kind: 'error'; error: unknown }
  | { kind: 'done'; total: number }

/** Texte annoncé aux lecteurs d'écran : rien tant que la recherche est vide ou en cours. */
export function searchAnnouncement(search: string, outcome: SearchOutcome): string {
  if (search === '' || outcome.kind === 'pending') return ''
  return outcome.kind === 'error'
    ? errorMessage(outcome.error)
    : pluralize(outcome.total, 'résultat')
}
