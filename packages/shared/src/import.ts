// Import de cartes depuis un texte (copier-coller ou fichier CSV/TXT). Sans Zod : le front s'en
// sert pour l'aperçu, l'API pour l'import lui-même (elle ne fait jamais confiance au client).
import { LIMITS } from './constants'

export interface ImportSeparators {
  /** Entre le terme et la définition. */
  term: string
  /** Entre deux cartes. */
  card: string
}

export interface ImportedCard {
  /** Ligne du texte où commence la carte (à partir de 1). */
  line: number
  term: string
  definition: string
}

export interface InvalidLine {
  line: number
  text: string
  reason: string
}

export interface ImportPreview {
  cards: ImportedCard[]
  invalid: InvalidLine[]
}

/** Taille en octets une fois encodé en UTF-8 (la limite d'import est exprimée en octets). */
export function utf8Size(text: string): number {
  let size = 0
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0
    size += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4
  }
  return size
}

function normalizeNewlines(text: string): string {
  return text.replace(/\r\n?/g, '\n')
}

/**
 * Devine les séparateurs : tabulation (copier-coller d'un tableur ou export Quizlet), sinon
 * point-virgule ou virgule (CSV), selon celui que contiennent le plus de lignes. Une carte par
 * ligne.
 */
export function detectSeparators(text: string): ImportSeparators {
  const lines = normalizeNewlines(text)
    .split('\n')
    .filter((line) => line.trim() !== '')
  const linesWith = (separator: string) => lines.filter((line) => line.includes(separator)).length
  const semicolons = linesWith(';')
  const commas = linesWith(',')
  let term = '\t'
  if (linesWith('\t') === 0 && semicolons + commas > 0) term = semicolons >= commas ? ';' : ','
  return { term, card: '\n' }
}

/**
 * Découpe le texte en enregistrements (listes de champs). Un champ qui commence par un guillemet
 * peut contenir les séparateurs et des retours à la ligne ; `""` y représente un guillemet, comme
 * dans un CSV d'Excel ou un copier-coller de Google Sheets.
 */
function splitRecords(text: string, { term, card }: ImportSeparators) {
  // Le séparateur le plus long d'abord : « \n\n » entre les cartes ne doit pas être vu comme « \n ».
  const separators = [
    { value: card, endsRecord: true },
    { value: term, endsRecord: false },
  ].sort((a, b) => b.value.length - a.value.length)
  const records: Array<{ line: number; fields: string[] }> = []
  let fields: string[] = []
  let field = ''
  let quoted = false
  let quotedField = false
  let line = 1
  let recordLine = 1

  for (let i = 0; i < text.length; ) {
    const char = text.charAt(i)
    if (quoted) {
      if (char === '"' && text.charAt(i + 1) === '"') {
        field += '"'
        i += 2
      } else {
        if (char === '"') quoted = false
        else field += char
        if (char === '\n') line++
        i++
      }
      continue
    }
    if (char === '"' && !quotedField && field.trim() === '') {
      field = ''
      quoted = true
      quotedField = true
      i++
      continue
    }
    const separator = separators.find(({ value }) => text.startsWith(value, i))
    if (separator) {
      fields.push(field)
      field = ''
      quotedField = false
      for (const consumed of separator.value) if (consumed === '\n') line++
      i += separator.value.length
      if (separator.endsRecord) {
        records.push({ line: recordLine, fields })
        fields = []
        recordLine = line
      }
      continue
    }
    if (char === '\n') line++
    field += char
    i++
  }
  fields.push(field)
  records.push({ line: recordLine, fields })
  return records
}

function invalidReason(term: string, definition: string): string | null {
  if (!term) return 'Terme vide'
  if (!definition) return 'Définition vide'
  if (term.length > LIMITS.term) return `Terme trop long (${LIMITS.term} caractères au plus)`
  if (definition.length > LIMITS.definition) {
    return `Définition trop longue (${LIMITS.definition} caractères au plus)`
  }
  return null
}

/**
 * Cartes contenues dans le texte. Chaque carte est coupée au premier séparateur de terme : la
 * suite forme la définition. Les lignes vides sont ignorées ; une ligne sans terme ou sans
 * définition, ou trop longue, est signalée comme invalide.
 */
export function parseCards(text: string, separators: ImportSeparators): ImportPreview {
  const cards: ImportedCard[] = []
  const invalid: InvalidLine[] = []
  for (const { line, fields } of splitRecords(normalizeNewlines(text), separators)) {
    if (fields.every((value) => value.trim() === '')) continue
    const [rawTerm = '', ...rest] = fields
    const term = rawTerm.trim()
    const definition = rest.join(separators.term).trim()
    const reason = invalidReason(term, definition)
    if (reason) invalid.push({ line, text: fields.join(separators.term).trim(), reason })
    else cards.push({ line, term, definition })
  }
  return { cards, invalid }
}
