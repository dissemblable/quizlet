import { normalizeAnswer, seededRandom } from '@quizlet/shared'
import { describe, expect, it } from 'vitest'
import { generateQuiz, NotEnoughCardsError, type QuizCard } from './quiz'

const capitals: QuizCard[] = [
  { id: '1', term: 'France', definition: 'Paris' },
  { id: '2', term: 'Italie', definition: 'Rome' },
  { id: '3', term: 'Espagne', definition: 'Madrid' },
  { id: '4', term: 'Portugal', definition: 'Lisbonne' },
  { id: '5', term: 'Grèce', definition: 'Athènes' },
  { id: '6', term: 'Irlande', definition: 'Dublin' },
]

describe('generateQuiz', () => {
  it('pose une question par carte, chacune avec 4 choix distincts', () => {
    const questions = generateQuiz(capitals, seededRandom(1))
    expect(questions).toHaveLength(capitals.length)
    expect(new Set(questions.map((q) => q.cardId)).size).toBe(capitals.length)
    for (const question of questions) {
      expect(question.choices).toHaveLength(4)
      expect(new Set(question.choices).size).toBe(4)
    }
  })

  it('place la bonne définition à answerIndex et tire les distracteurs des autres cartes', () => {
    const definitions = new Set(capitals.map((card) => card.definition))
    for (const question of generateQuiz(capitals, seededRandom(2))) {
      const card = capitals.find((c) => c.id === question.cardId)
      expect(question.term).toBe(card?.term)
      expect(question.choices[question.answerIndex]).toBe(card?.definition)
      for (const choice of question.choices) expect(definitions.has(choice)).toBe(true)
    }
  })

  it('est déterministe pour une même graine et varie sinon', () => {
    expect(generateQuiz(capitals, seededRandom(7))).toEqual(generateQuiz(capitals, seededRandom(7)))
    expect(generateQuiz(capitals, seededRandom(7))).not.toEqual(
      generateQuiz(capitals, seededRandom(8)),
    )
  })

  it('mélange l’ordre des questions et la position de la bonne réponse', () => {
    const positions = new Map<number, number>()
    const random = seededRandom(3)
    for (let i = 0; i < 400; i++) {
      for (const question of generateQuiz(capitals, random)) {
        positions.set(question.answerIndex, (positions.get(question.answerIndex) ?? 0) + 1)
      }
    }
    expect([...positions.keys()].sort()).toEqual([0, 1, 2, 3])
    // 2 400 réponses : chaque position autour de 600.
    for (const count of positions.values()) expect(count).toBeGreaterThan(450)
  })

  it('exige au moins 4 cartes', () => {
    expect(() => generateQuiz(capitals.slice(0, 3))).toThrow(NotEnoughCardsError)
    expect(generateQuiz(capitals.slice(0, 4), seededRandom(4))).toHaveLength(4)
  })

  it('exige 4 définitions différentes, sans tenir compte de la casse ni des espaces', () => {
    const duplicates: QuizCard[] = [
      { id: '1', term: 'chien', definition: 'dog' },
      { id: '2', term: 'clebs', definition: 'Dog ' },
      { id: '3', term: 'chat', definition: 'cat' },
      { id: '4', term: 'oiseau', definition: 'bird' },
    ]
    expect(() => generateQuiz(duplicates)).toThrow(NotEnoughCardsError)
  })

  it('ne propose jamais une autre écriture de la bonne réponse comme distracteur', () => {
    const cards: QuizCard[] = [
      ...capitals.slice(0, 4),
      { id: '7', term: 'Capitale de la France', definition: 'paris' },
    ]
    for (let seed = 0; seed < 50; seed++) {
      for (const question of generateQuiz(cards, seededRandom(seed))) {
        const keys = question.choices.map(normalizeAnswer)
        expect(new Set(keys).size).toBe(4)
      }
    }
  })
})
