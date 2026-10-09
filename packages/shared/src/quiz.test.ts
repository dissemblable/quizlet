import { describe, expect, it } from 'vitest'
import { countDistinctDefinitions, normalizeAnswer } from './quiz'

describe('normalizeAnswer', () => {
  it('ignore la casse et les espaces superflus', () => {
    expect(normalizeAnswer('  Paris   (France) ')).toBe('paris (france)')
    expect(normalizeAnswer('ÉTÉ')).toBe('été')
  })
})

describe('countDistinctDefinitions', () => {
  it('compte une seule fois les définitions équivalentes', () => {
    const cards = [{ definition: 'dog' }, { definition: 'Dog ' }, { definition: 'cat' }]
    expect(countDistinctDefinitions(cards)).toBe(2)
  })
})
