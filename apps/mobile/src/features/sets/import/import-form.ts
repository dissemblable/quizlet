// Logique pure de l'écran d'import (parité avec `apps/web/src/pages/ImportPage.tsx`) : aucun import
// de React, de React Native ni de `@/ui`, pour rester testable sous Node.
import type { ImportedCard, ImportSeparators, InvalidLine } from '@quizlet/shared'
import { IMPORT_MAX_BYTES, LIMITS, MESSAGES, parseCards, pluralize } from '@quizlet/shared'

/** Lignes affichées dans l'aperçu (le reste est seulement compté). */
export const PREVIEW_ROWS = 100
/**
 * Un texte ignoré peut peser tout le fichier (aucun séparateur trouvé) : sur mobile on n'en montre
 * que le début, le web laissant le navigateur le replier.
 */
export const INVALID_TEXT_MAX = 200

export type TermChoice = 'auto' | 'tab' | 'comma' | 'semicolon' | 'custom'
export type CardChoice = 'newline' | 'custom'

/** Choix de l'interface pour les deux séparateurs. */
export interface SeparatorChoices {
  term: TermChoice
  customTerm: string
  card: CardChoice
  customCard: string
}

export const INITIAL_CHOICES: SeparatorChoices = {
  term: 'auto',
  customTerm: '',
  card: 'newline',
  customCard: '',
}

const TERM_SEPARATORS = { tab: '\t', comma: ',', semicolon: ';' } as const
const SEPARATOR_NAMES: Record<string, string> = {
  '\t': 'tabulation',
  ',': 'virgule',
  ';': 'point-virgule',
}

interface Option<T extends string> {
  value: T
  label: string
}

/** Options « Entre le terme et la définition » ; `detectedTerm` nomme la détection automatique. */
export function termOptions(detectedTerm: string): ReadonlyArray<Option<TermChoice>> {
  return [
    {
      value: 'auto',
      label: `Détection automatique (${SEPARATOR_NAMES[detectedTerm] ?? detectedTerm})`,
    },
    { value: 'tab', label: 'Tabulation' },
    { value: 'comma', label: 'Virgule' },
    { value: 'semicolon', label: 'Point-virgule' },
    { value: 'custom', label: 'Autre' },
  ]
}

export const CARD_OPTIONS: ReadonlyArray<Option<CardChoice>> = [
  { value: 'newline', label: 'Nouvelle ligne' },
  { value: 'custom', label: 'Autre' },
]

/** « \n » et « \t » tapés dans un séparateur personnalisé : retour à la ligne et tabulation. */
export function unescapeSeparator(value: string): string {
  return value.replace(/\\n/g, '\n').replace(/\\t/g, '\t')
}

/** Choix de l'interface → séparateurs envoyés à l'API (`detectedTerm` : détection automatique). */
export function resolveSeparators(
  choices: SeparatorChoices,
  detectedTerm: string,
): ImportSeparators {
  const term =
    choices.term === 'auto'
      ? detectedTerm
      : choices.term === 'custom'
        ? unescapeSeparator(choices.customTerm)
        : TERM_SEPARATORS[choices.term]
  const card = choices.card === 'custom' ? unescapeSeparator(choices.customCard) : '\n'
  return { term, card }
}

/** Séparateur vide, ou identique pour le terme et la carte. */
export function separatorError({ term, card }: ImportSeparators): string | null {
  if (term === '' || card === '') return MESSAGES.separatorRequired
  return term === card ? MESSAGES.separatorsMustDiffer : null
}

export interface PreviewModel {
  /** Toutes les cartes détectées (l'aperçu n'en montre que `PREVIEW_ROWS`). */
  count: number
  /** « N cartes détectées · M lignes ignorées » (phrase annoncée à TalkBack). */
  summary: string
  cards: ImportedCard[]
  /** « … et N autres cartes. » quand l'aperçu est tronqué. */
  more: string | null
  invalid: InvalidLine[]
}

function clip(text: string): string {
  return text.length > INVALID_TEXT_MAX ? `${text.slice(0, INVALID_TEXT_MAX)}…` : text
}

/** Aperçu des cartes ; `null` si les séparateurs sont inutilisables (voir `separatorError`). */
export function buildPreview(source: string, separators: ImportSeparators): PreviewModel | null {
  if (separatorError(separators)) return null
  const { cards, invalid } = parseCards(source, separators)
  const count = cards.length
  return {
    count,
    summary: `${pluralize(count, 'carte détectée', 'cartes détectées')} · ${pluralize(invalid.length, 'ligne ignorée', 'lignes ignorées')}`,
    cards: cards.slice(0, PREVIEW_ROWS),
    more:
      count > PREVIEW_ROWS
        ? `… et ${pluralize(count - PREVIEW_ROWS, 'autre carte', 'autres cartes')}.`
        : null,
    invalid: invalid.slice(0, PREVIEW_ROWS).map((line) => ({ ...line, text: clip(line.text) })),
  }
}

/**
 * Problème qui bloque l'import, par priorité : texte trop gros, séparateurs, trop de cartes.
 * `size` : octets UTF-8 du texte ; `count` : cartes détectées ; `existing` : cartes déjà dans le set.
 */
export function importProblem({
  size,
  separators,
  count,
  existing,
}: {
  size: number
  separators: ImportSeparators
  count: number
  existing: number
}): string | null {
  if (size > IMPORT_MAX_BYTES) return MESSAGES.importTooLarge
  const separator = separatorError(separators)
  if (separator) return separator
  return existing + count > LIMITS.cards
    ? `Le set dépasserait ${LIMITS.cards} cartes (${existing} déjà présentes).`
    : null
}

/** Le bouton d'import est actif : rien en cours, au moins une carte, aucun problème, un titre si nouveau set. */
export function canImport({
  pending,
  count,
  problem,
  isNewSet,
  title,
}: {
  pending: boolean
  count: number
  problem: string | null
  isNewSet: boolean
  title: string
}): boolean {
  return !pending && count > 0 && problem === null && !(isNewSet && !title.trim())
}

export function importButtonLabel(count: number): string {
  return count > 0 ? `Importer ${pluralize(count, 'carte')}` : 'Importer'
}

/** « 12 cartes importées (2 lignes ignorées). » */
export function importSuccessMessage(imported: number, skipped: number): string {
  const ignored = skipped ? ` (${pluralize(skipped, 'ligne ignorée', 'lignes ignorées')})` : ''
  return `${pluralize(imported, 'carte importée', 'cartes importées')}${ignored}.`
}

/** Titre de l'en-tête : « Importer des cartes » ou « Importer des cartes dans « {titre} » ». */
export function importHeading(setTitle?: string): string {
  return setTitle === undefined ? 'Importer des cartes' : `Importer des cartes dans « ${setTitle} »`
}

/** Ajoute le texte collé à la fin, sur de nouvelles lignes (une carte par ligne). */
export function appendPasted(text: string, pasted: string): string {
  return text === '' || text.endsWith('\n') ? text + pasted : `${text}\n${pasted}`
}
