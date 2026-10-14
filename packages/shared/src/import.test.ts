import { describe, expect, it } from 'vitest'
import { LIMITS } from './constants'
import { detectSeparators, parseCards, utf8Size } from './import'

const lines = { term: '\t', card: '\n' }

describe('detectSeparators', () => {
  it('reconnaît la tabulation d’un copier-coller de tableur ou de Quizlet', () => {
    expect(detectSeparators('chat\tcat\nchien, loup\tdog')).toEqual({ term: '\t', card: '\n' })
  })

  it('choisit le séparateur CSV présent sur le plus de lignes', () => {
    expect(detectSeparators('France;Paris\nItalie;Rome, la ville éternelle')).toEqual({
      term: ';',
      card: '\n',
    })
    expect(detectSeparators('France,Paris\nItalie,Rome\nEspagne;Madrid')).toEqual({
      term: ',',
      card: '\n',
    })
  })

  it('se rabat sur la tabulation sans séparateur reconnu', () => {
    expect(detectSeparators('')).toEqual({ term: '\t', card: '\n' })
    expect(detectSeparators('une seule colonne')).toEqual({ term: '\t', card: '\n' })
  })
})

describe('parseCards', () => {
  it('lit une carte par ligne et nettoie les espaces (fins de ligne Windows comprises)', () => {
    expect(parseCards(' chat \t cat \r\nchien\tdog\r\n', lines)).toEqual({
      cards: [
        { line: 1, term: 'chat', definition: 'cat' },
        { line: 2, term: 'chien', definition: 'dog' },
      ],
      invalid: [],
    })
  })

  it('coupe au premier séparateur : la suite appartient à la définition', () => {
    const { cards } = parseCards('Italie,Rome,capitale', { term: ',', card: '\n' })
    expect(cards).toEqual([{ line: 1, term: 'Italie', definition: 'Rome,capitale' }])
  })

  it('ignore les lignes vides et signale les lignes invalides', () => {
    const { cards, invalid } = parseCards(
      'chat\tcat\n\n   \nsans définition\n\tsans terme\n',
      lines,
    )
    expect(cards).toHaveLength(1)
    expect(invalid).toEqual([
      { line: 4, text: 'sans définition', reason: 'Définition vide' },
      { line: 5, text: 'sans terme', reason: 'Terme vide' },
    ])
  })

  it('refuse un terme ou une définition trop longs', () => {
    const long = 'x'.repeat(LIMITS.term + 1)
    const { invalid } = parseCards(`${long}\tok`, lines)
    expect(invalid[0]?.reason).toBe(`Terme trop long (${LIMITS.term} caractères au plus)`)
  })

  it('gère les champs entre guillemets (séparateurs, retours à la ligne, "" échappé)', () => {
    const text = '"Paris, France";"Capitale ""lumière""\nsur la Seine"\nRome; "Italie"'
    expect(parseCards(text, { term: ';', card: '\n' })).toEqual({
      cards: [
        {
          line: 1,
          term: 'Paris, France',
          definition: 'Capitale "lumière"\nsur la Seine',
        },
        { line: 3, term: 'Rome', definition: 'Italie' },
      ],
      invalid: [],
    })
  })

  it('garde un guillemet au milieu d’un champ tel quel', () => {
    const { cards } = parseCards('il dit "bonjour"\tgreeting', lines)
    expect(cards[0]?.term).toBe('il dit "bonjour"')
  })

  it('accepte des séparateurs personnalisés de plusieurs caractères', () => {
    const { cards } = parseCards('chat - cat\n\nchien - dog\nloup', { term: ' - ', card: '\n\n' })
    expect(cards).toEqual([
      { line: 1, term: 'chat', definition: 'cat' },
      { line: 3, term: 'chien', definition: 'dog\nloup' },
    ])
  })
})

describe('utf8Size', () => {
  it('compte les octets, pas les caractères', () => {
    expect(utf8Size('abc')).toBe(3)
    expect(utf8Size('é')).toBe(2)
    expect(utf8Size('😀')).toBe(4)
  })
})
