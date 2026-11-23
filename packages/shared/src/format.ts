// Pas d'`Intl` ici : ce module sert aussi au mobile, où Hermes n'a pas de données de locale
// fiables. Les équivalences avec `Intl` (fr-FR) sont vérifiées dans `format.test.ts`.

/** Initiales pour l'avatar : « Utilisateur Démo » → « UD », « alice » → « A ». */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const letters = parts.length > 1 ? [parts[0], parts[parts.length - 1]] : parts.slice(0, 1)
  return letters
    .map((part) => Array.from(part ?? '')[0] ?? '')
    .join('')
    .toUpperCase()
}

const MONTHS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
]

/** « 9 octobre 2026 » : le jour tel qu'il est dans le fuseau local de l'appareil. */
export function formatDate(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value
  // `Intl.DateTimeFormat#format` lève la même erreur sur une date invalide.
  if (Number.isNaN(date.getTime())) throw new RangeError('Invalid time value')
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`
}

/** Espace fine insécable (U+202F) : séparateur de milliers de `fr-FR`. */
const THOUSANDS_SEPARATOR = String.fromCharCode(0x202f)

/** +1 sur une suite de chiffres décimaux ; la retenue peut l'allonger (« 999 » → « 1000 »). */
function incrementDigits(digits: string): string {
  const chars = digits.split('')
  let index = chars.length - 1
  while (index >= 0 && chars[index] === '9') {
    chars[index] = '0'
    index--
  }
  if (index < 0) return `1${chars.join('')}`
  chars[index] = String(Number(chars[index]) + 1)
  return chars.join('')
}

/**
 * Équivalent de `n.toLocaleString('fr-FR')` : milliers séparés par U+202F, virgule décimale, trois
 * décimales au plus (1234.5 → « 1 234,5 »).
 */
export function formatNumber(n: number): string {
  if (Number.isNaN(n)) return 'NaN'
  if (!Number.isFinite(n)) return n < 0 ? '-∞' : '∞'
  // Comme ICU, on arrondit les chiffres décimaux *les plus courts* de `n` (1.0005 → 1,001), pas sa
  // valeur binaire (1.000499… → 1,000). On les développe d'abord hors notation exponentielle.
  const [mantissa = '', exponent = '0'] = String(Math.abs(n)).split('e')
  const [whole = '', fraction = ''] = mantissa.split('.')
  let digits = whole + fraction
  let point = whole.length + Number(exponent) // nombre de chiffres avant la virgule
  if (point < 0) {
    digits = '0'.repeat(-point) + digits
    point = 0
  } else if (point > digits.length) {
    digits = digits.padEnd(point, '0')
  }
  // Trois décimales, arrondies « demi supérieur » sur le premier chiffre écarté.
  let kept = digits.slice(0, point + 3).padEnd(point + 3, '0')
  if (digits.charAt(point + 3) >= '5') kept = incrementDigits(kept)
  const integer = (kept.slice(0, -3) || '0').replace(/\B(?=(\d{3})+(?!\d))/g, THOUSANDS_SEPARATOR)
  const decimals = kept.slice(-3).replace(/0+$/, '')
  // ICU garde le signe d'un zéro négatif et d'un négatif arrondi à zéro (« -0 »).
  const sign = n < 0 || Object.is(n, -0) ? '-' : ''
  return `${sign}${integer}${decimals ? `,${decimals}` : ''}`
}

/** « 0 carte », « 1 carte », « 12 cartes ». */
export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${formatNumber(count)} ${Math.abs(count) >= 2 ? plural : singular}`
}
