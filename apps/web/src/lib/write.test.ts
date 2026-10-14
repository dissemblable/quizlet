import { seededRandom } from '@quizlet/shared'
import { describe, expect, it } from 'vitest'
import {
  allowedTypos,
  buildQuestions,
  checkAnswer,
  initWrite,
  levenshtein,
  normalizeForComparison,
  scoreOf,
  type WriteAction,
  writeReducer,
} from './write'

describe('normalizeForComparison', () => {
  it('ignore la casse, les accents, la ponctuation et les espaces multiples', () => {
    expect(normalizeForComparison('  Élève,  à   l’ÉCOLE ! ')).toBe('eleve a l ecole')
    expect(normalizeForComparison('Saint-Étienne')).toBe(normalizeForComparison('saint etienne'))
  })
})

describe('levenshtein', () => {
  it('compte insertions, suppressions et substitutions', () => {
    expect(levenshtein('', '')).toBe(0)
    expect(levenshtein('chat', 'chat')).toBe(0)
    expect(levenshtein('chat', 'chats')).toBe(1)
    expect(levenshtein('chat', 'cat')).toBe(1)
    expect(levenshtein('chat', 'chut')).toBe(1)
    expect(levenshtein('kitten', 'sitting')).toBe(3)
    expect(levenshtein('', 'abc')).toBe(3)
  })

  it('traite un emoji comme un seul caractère', () => {
    expect(levenshtein('a😀', 'a😃')).toBe(1)
  })
})

describe('checkAnswer', () => {
  it('accepte la réponse exacte à la normalisation près', () => {
    expect(checkAnswer('LISBONNE', 'Lisbonne')).toBe('exact')
    expect(checkAnswer('Athenes.', 'Athènes')).toBe('exact')
  })

  it('tolère une faute par tranche de 5 caractères, aucune sur une réponse courte', () => {
    expect(allowedTypos('rome')).toBe(0)
    expect(allowedTypos('paris')).toBe(1)
    expect(allowedTypos('planche a decouper')).toBe(3)
    expect(checkAnswer('Rom', 'Rome')).toBe('wrong')
    expect(checkAnswer('Pariss', 'Paris')).toBe('typo')
    expect(checkAnswer('Parisss', 'Paris')).toBe('wrong')
    expect(checkAnswer('une planche a decoupr', 'une planche à découper')).toBe('typo')
  })

  it('refuse une réponse vide', () => {
    expect(checkAnswer('   ', 'Paris')).toBe('wrong')
  })
})

const cards = [
  { id: '1', term: 'France', definition: 'Paris' },
  { id: '2', term: 'Italie', definition: 'Rome' },
  { id: '3', term: 'Espagne', definition: 'Madrid' },
]

describe('buildQuestions', () => {
  it('affiche le terme ou la définition selon le sens choisi', () => {
    const fromTerm = buildQuestions(cards, { direction: 'term', shuffle: false })
    expect(fromTerm[0]).toEqual({ cardId: '1', shown: 'term', prompt: 'France', answer: 'Paris' })
    const fromDefinition = buildQuestions(cards, { direction: 'definition', shuffle: false })
    expect(fromDefinition[0]).toMatchObject({
      shown: 'definition',
      prompt: 'Paris',
      answer: 'France',
    })
  })

  it('mélange les cartes et les sens à la demande', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({
      id: String(i),
      term: `t${i}`,
      definition: `d${i}`,
    }))
    const mixed = buildQuestions(many, { direction: 'mixed', shuffle: true }, seededRandom(3))
    expect(new Set(mixed.map((question) => question.shown))).toEqual(
      new Set(['term', 'definition']),
    )
    expect(mixed.map((question) => question.cardId)).not.toEqual(many.map((card) => card.id))
    expect(mixed.map((question) => question.cardId).sort()).toEqual(
      many.map((card) => card.id).sort(),
    )
  })
})

describe('session du mode écrit', () => {
  const play = (actions: WriteAction[]) =>
    actions.reduce(
      writeReducer,
      initWrite(buildQuestions(cards, { direction: 'term', shuffle: false })),
    )

  it('corrige chaque réponse puis passe à la suivante', () => {
    const state = play([{ type: 'submit', given: 'paris' }])
    expect(state.current).toMatchObject({ result: 'exact', given: 'paris' })
    const next = writeReducer(state, { type: 'next' })
    expect(next).toMatchObject({ index: 1, current: null, finished: false })
  })

  it('« J’avais raison » compte une réponse fausse comme juste', () => {
    const state = play([
      { type: 'submit', given: 'Naples' },
      { type: 'override' },
      { type: 'next' },
      { type: 'submit', given: 'Milan' },
      { type: 'next' },
      { type: 'submit', given: 'Madrid' },
      { type: 'next' },
    ])
    expect(state.finished).toBe(true)
    const { correct, total, mistakes } = scoreOf(state)
    expect({ correct, total }).toEqual({ correct: 2, total: 3 })
    expect(mistakes.map((mistake) => mistake.given)).toEqual(['Milan'])
  })

  it('ignore « J’avais raison » sur une réponse déjà juste et une double validation', () => {
    const state = play([
      { type: 'submit', given: 'Paris' },
      { type: 'submit', given: 'Autre' },
      { type: 'override' },
    ])
    expect(state.current).toMatchObject({ given: 'Paris', overridden: false })
  })
})
