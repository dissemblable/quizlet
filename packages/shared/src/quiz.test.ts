import { describe, expect, it } from 'vitest'
import { countDistinctDefinitions, normalizeAnswer } from './quiz'

describe('normalizeAnswer', () => {
  it('ignore la casse et les espaces superflus', () => {
    expect(normalizeAnswer('  Paris   (France) ')).toBe('paris (france)')
    expect(normalizeAnswer('ÉTÉ')).toBe('été')
  })

  it('met en minuscules comme toLocaleLowerCase fr-FR (aucune règle propre au français)', () => {
    for (const text of ['ÉTÉ', 'ŒUVRE', 'İSTANBUL', 'ΟΔΥΣΣΕΥΣ', 'ǅ', 'ẞ', 'ÇA VA']) {
      expect(normalizeAnswer(text)).toBe(text.toLocaleLowerCase('fr-FR'))
    }
  })
})

describe('countDistinctDefinitions', () => {
  it('compte une seule fois les définitions équivalentes', () => {
    const cards = [{ definition: 'dog' }, { definition: 'Dog ' }, { definition: 'cat' }]
    expect(countDistinctDefinitions(cards)).toBe(2)
  })
})
