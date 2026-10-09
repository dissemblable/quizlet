import { normalizeAnswer, QUIZ_MIN_CARDS, type RandomFn, shuffle } from '@quizlet/shared'

export interface QuizCard {
  id: string
  term: string
  definition: string
}

export interface QuizQuestion {
  cardId: string
  term: string
  /** QUIZ_MIN_CARDS définitions, dans un ordre aléatoire. */
  choices: string[]
  /** Position de la bonne définition dans `choices`. */
  answerIndex: number
}

export class NotEnoughCardsError extends Error {
  constructor() {
    super(`Un quiz demande au moins ${QUIZ_MIN_CARDS} cartes aux définitions différentes.`)
    this.name = 'NotEnoughCardsError'
  }
}

/**
 * Un QCM par carte, dans un ordre aléatoire : le terme, sa définition et trois distracteurs tirés
 * des autres cartes. Les définitions équivalentes (casse, espaces) ne comptent qu'une fois, pour
 * qu'aucun distracteur ne soit une autre écriture de la bonne réponse.
 */
export function generateQuiz(
  cards: readonly QuizCard[],
  random: RandomFn = Math.random,
): QuizQuestion[] {
  // Une écriture par définition distincte (la première rencontrée).
  const distinct = new Map<string, string>()
  for (const card of cards) {
    const key = normalizeAnswer(card.definition)
    if (!distinct.has(key)) distinct.set(key, card.definition)
  }
  if (distinct.size < QUIZ_MIN_CARDS) throw new NotEnoughCardsError()

  return shuffle(cards, random).map((card) => {
    const answerKey = normalizeAnswer(card.definition)
    const pool = [...distinct].filter(([key]) => key !== answerKey).map(([, text]) => text)
    const distractors = shuffle(pool, random).slice(0, QUIZ_MIN_CARDS - 1)
    const choices = shuffle([card.definition, ...distractors], random)
    return {
      cardId: card.id,
      term: card.term,
      choices,
      answerIndex: choices.indexOf(card.definition),
    }
  })
}
