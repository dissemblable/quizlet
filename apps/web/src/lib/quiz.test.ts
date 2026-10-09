import { describe, expect, it } from 'vitest'
import {
  currentQuestion,
  initQuiz,
  mistakesOf,
  type QuizAction,
  type QuizQuestion,
  type QuizState,
  quizReducer,
  scoreOf,
  verdict,
} from './quiz'

const questions: QuizQuestion[] = [
  { cardId: '1', term: 'France', choices: ['Rome', 'Paris', 'Madrid', 'Berlin'], answerIndex: 1 },
  { cardId: '2', term: 'Italie', choices: ['Rome', 'Paris', 'Madrid', 'Berlin'], answerIndex: 0 },
  { cardId: '3', term: 'Espagne', choices: ['Rome', 'Paris', 'Madrid', 'Berlin'], answerIndex: 2 },
]
const run = (state: QuizState, ...actions: QuizAction[]) => actions.reduce(quizReducer, state)

describe('session de quiz', () => {
  it('commence à la première question, sans réponse', () => {
    const state = initQuiz(questions)
    expect(currentQuestion(state)?.term).toBe('France')
    expect(scoreOf(state)).toEqual({ correct: 0, answered: 0, total: 3, percent: 0 })
  })

  it('n’accepte qu’une réponse par question', () => {
    const state = run(
      initQuiz(questions),
      { type: 'answer', choice: 0 },
      { type: 'answer', choice: 1 },
    )
    expect(state.answers[0]).toBe(0)
  })

  it('ignore un choix hors des propositions', () => {
    const state = run(
      initQuiz(questions),
      { type: 'answer', choice: 4 },
      { type: 'answer', choice: -1 },
    )
    expect(state.answers[0]).toBeUndefined()
  })

  it('ne passe à la question suivante qu’après une réponse', () => {
    expect(run(initQuiz(questions), { type: 'next' }).index).toBe(0)
    expect(run(initQuiz(questions), { type: 'answer', choice: 1 }, { type: 'next' }).index).toBe(1)
  })

  it('calcule le score et les erreurs en fin de quiz', () => {
    const state = run(
      initQuiz(questions),
      { type: 'answer', choice: 1 },
      { type: 'next' },
      { type: 'answer', choice: 3 },
      { type: 'next' },
      { type: 'answer', choice: 2 },
      { type: 'next' },
    )
    expect(state.finished).toBe(true)
    expect(currentQuestion(state)).toBeUndefined()
    expect(scoreOf(state)).toEqual({ correct: 2, answered: 3, total: 3, percent: 67 })
    expect(mistakesOf(state)).toEqual([
      { question: questions[1], chosen: 'Berlin', expected: 'Rome' },
    ])
    // Le quiz terminé n'accepte plus rien.
    expect(run(state, { type: 'answer', choice: 0 })).toBe(state)
  })
})

describe('verdict', () => {
  it.each([
    [100, 'Sans faute, bravo !'],
    [80, 'Excellent travail !'],
    [50, 'Bien joué, encore un effort.'],
    [20, 'Continuez à réviser, ça viendra.'],
  ])('%i %% → %s', (percent, message) => {
    expect(verdict(percent)).toBe(message)
  })
})
