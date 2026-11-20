import { describe, expect, it } from 'vitest'
import { formatDate, formatNumber, initials, pluralize } from './format'
import { type RandomFn, seededRandom } from './random'

/** Espace fine insécable (U+202F) : séparateur de milliers de fr-FR (CLDR récent). */
const NNBSP = String.fromCharCode(0x202f)

/**
 * Oracle : `toLocaleString('fr-FR')` de Node. Les ICU antérieurs à CLDR 34 séparaient les milliers
 * par U+00A0 ; on le ramène à U+202F pour comparer les chiffres, pas le choix de l'espace.
 */
const intlNumber = (n: number) =>
  n.toLocaleString('fr-FR').replaceAll(String.fromCharCode(0xa0), NNBSP)

const intlDate = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

describe('formatDate', () => {
  it('formate une date ISO en français', () => {
    expect(formatDate('2026-10-09T12:00:00.000Z')).toBe('9 octobre 2026')
  })

  it('écrit le jour, le mois en toutes lettres et l’année (« 1 janvier », jamais « 1er »)', () => {
    expect(formatDate(new Date(2026, 0, 1, 12))).toBe('1 janvier 2026')
    expect(formatDate(new Date(2024, 1, 29, 12))).toBe('29 février 2024')
    expect(formatDate(new Date(2026, 11, 31, 12))).toBe('31 décembre 2026')
  })

  it('est identique à Intl.DateTimeFormat fr-FR (mois, jours-clés, années bissextiles)', () => {
    const dates: Date[] = []
    for (const year of [1999, 2000, 2024, 2026, 2100]) {
      for (let month = 0; month < 12; month++) {
        const last = new Date(year, month + 1, 0).getDate()
        // Le 1er, le 2, un jour à un chiffre, le 15, l'avant-dernier et le dernier jour du mois.
        for (const day of [1, 2, 9, 15, last - 1, last]) dates.push(new Date(year, month, day, 12))
      }
    }
    for (const date of dates) {
      expect(formatDate(date)).toBe(intlDate.format(date))
      expect(formatDate(date.toISOString())).toBe(intlDate.format(date))
    }
  })

  it('lève une RangeError sur une date invalide, comme Intl', () => {
    expect(() => intlDate.format(new Date('pas une date'))).toThrow(RangeError)
    expect(() => formatDate('pas une date')).toThrow(RangeError)
    expect(() => formatDate(new Date(Number.NaN))).toThrow(RangeError)
  })
})

describe('initials', () => {
  it('prend la première lettre du prénom et du nom', () => {
    expect(initials('Utilisateur Démo')).toBe('UD')
    expect(initials('  Jean  Pierre   Martin ')).toBe('JM')
  })

  it('gère un nom simple et les lettres accentuées', () => {
    expect(initials('alice')).toBe('A')
    expect(initials('éloïse')).toBe('É')
  })

  it('renvoie une chaîne vide pour un nom vide', () => {
    expect(initials('   ')).toBe('')
  })

  it('met en majuscule comme toLocaleUpperCase fr-FR (aucune règle propre au français)', () => {
    for (const letter of ['é', 'ï', 'ç', 'œ', 'ß', 'ǆ', 'ŉ', 'ﬁ', 'i', 'ı']) {
      expect(initials(letter)).toBe(letter.toLocaleUpperCase('fr-FR'))
    }
  })
})

describe('formatNumber', () => {
  it('regroupe les milliers avec une espace fine insécable et met la virgule décimale', () => {
    expect(formatNumber(0)).toBe('0')
    expect(formatNumber(1)).toBe('1')
    expect(formatNumber(999)).toBe('999')
    expect(formatNumber(1000)).toBe(`1${NNBSP}000`)
    expect(formatNumber(1200)).toBe(`1${NNBSP}200`)
    expect(formatNumber(1234567)).toBe(`1${NNBSP}234${NNBSP}567`)
    expect(formatNumber(-1)).toBe('-1')
    expect(formatNumber(-1234.5)).toBe(`-1${NNBSP}234,5`)
    expect(formatNumber(0.5)).toBe('0,5')
  })

  it('garde trois décimales au plus, arrondies sur l’écriture décimale la plus courte', () => {
    expect(formatNumber(1234.5678)).toBe(`1${NNBSP}234,568`)
    expect(formatNumber(1.0005)).toBe('1,001') // `toFixed(3)` lirait la valeur binaire : 1,000
    expect(formatNumber(3.4154999999999998)).toBe('3,415')
    expect(formatNumber(0.9995)).toBe('1')
    expect(formatNumber(99999.9995)).toBe(`100${NNBSP}000`)
    expect(formatNumber(0.0004)).toBe('0')
    expect(formatNumber(0.1 + 0.2)).toBe('0,3')
  })

  it('traite les valeurs spéciales et les grands nombres comme Intl', () => {
    expect(formatNumber(Number.NaN)).toBe('NaN')
    expect(formatNumber(Number.POSITIVE_INFINITY)).toBe('∞')
    expect(formatNumber(Number.NEGATIVE_INFINITY)).toBe('-∞')
    expect(formatNumber(-0)).toBe('-0')
    expect(formatNumber(-0.0004)).toBe('-0')
    expect(formatNumber(1e21)).toBe(['1', ...Array.from({ length: 7 }, () => '000')].join(NNBSP))
  })

  it('est identique à toLocaleString fr-FR sur des valeurs-clés', () => {
    const values = [
      ...[0, 1, 999, 1000, 1200, 1234567, -1, -1234.5, -1234567.891, 0.5, 1.5, 1234.5678],
      ...[1.0005, 0.0005, 0.0015, 0.9995, 99999.9995, 0.1 + 0.2, 123456789.123456, 1e-7, 5e-324],
      ...[1e15, 2 ** 53, 1.2345678901234567e19, 1e21, 1e300, -0, -0.0004],
      ...[Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY],
    ]
    expect(values.filter((n) => formatNumber(n) !== intlNumber(n))).toEqual([])
  })

  it('est identique à toLocaleString fr-FR sur un échantillon pseudo-aléatoire', () => {
    const random: RandomFn = seededRandom(2026)
    const values: number[] = []
    for (let i = 0; i < 3000; i++) {
      const sign = random() < 0.3 ? -1 : 1
      const integer = Math.floor(random() * 10 ** Math.floor(random() * 13))
      const decimals = Math.floor(random() * 7)
      const fraction = Math.floor(random() * 10 ** decimals) / 10 ** decimals
      values.push(sign * (integer + fraction))
      // Égalité au quatrième chiffre (« x,xxx5 ») : le cas où `toFixed` et ICU divergent.
      const thousandths = String(Math.floor(random() * 1000)).padStart(3, '0')
      values.push(sign * Number(`${integer}.${thousandths}5`))
    }
    expect(values.filter((n) => formatNumber(n) !== intlNumber(n))).toEqual([])
  })
})

describe('pluralize', () => {
  it('accorde selon la règle française (0 et 1 au singulier)', () => {
    expect(pluralize(0, 'carte')).toBe('0 carte')
    expect(pluralize(1, 'carte')).toBe('1 carte')
    expect(pluralize(2, 'carte')).toBe('2 cartes')
  })

  it('accepte un pluriel irrégulier', () => {
    expect(pluralize(3, 'travail', 'travaux')).toBe('3 travaux')
  })

  it('groupe les milliers et gère négatifs et décimaux comme toLocaleString fr-FR', () => {
    expect(pluralize(1200, 'carte')).toBe(`1${NNBSP}200 cartes`)
    expect(pluralize(-1, 'carte')).toBe('-1 carte')
    expect(pluralize(-2, 'carte')).toBe('-2 cartes')
    expect(pluralize(1.5, 'carte')).toBe('1,5 carte')
    for (const count of [0, 1, 2, 999, 1000, 1234567, -3, 1.5, 2.5]) {
      const word = Math.abs(count) >= 2 ? 'cartes' : 'carte'
      expect(pluralize(count, 'carte')).toBe(`${intlNumber(count)} ${word}`)
    }
  })
})
