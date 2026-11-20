import { ApiError, type QuizMistake, type QuizQuestion } from '@quizlet/shared'
import type { MistakeRow } from './result-text'

export const QUIZ_OFFLINE_TITLE = 'Quiz indisponible hors ligne'
export const QUIZ_OFFLINE_MESSAGE = 'Le quiz nécessite une connexion.'
export const QUIZ_PROMPT = 'Quelle est la définition de :'

export function quizStatement(term: string): string {
  return `${QUIZ_PROMPT} ${term}`
}

/** Le set n'a pas assez de cartes (ou de définitions distinctes) : l'API refuse le tirage. */
export function isNotEnoughCards(error: unknown): error is ApiError {
  return error instanceof ApiError && error.code === 'QUIZ_NOT_ENOUGH_CARDS'
}

export interface QuizFeedback {
  correct: boolean
  text: string
}

/** Retour sous les choix, une fois la question répondue ; `null` avant. */
export function quizFeedback(
  question: Pick<QuizQuestion, 'choices' | 'answerIndex'>,
  answer: number | undefined,
): QuizFeedback | null {
  if (answer === undefined) return null
  if (answer === question.answerIndex) return { correct: true, text: 'Bonne réponse !' }
  const expected = question.choices[question.answerIndex] ?? ''
  return { correct: false, text: `Mauvaise réponse. La bonne réponse était : ${expected}` }
}

export function nextQuestionLabel(index: number, total: number): string {
  return index >= total - 1 ? 'Voir le résultat' : 'Question suivante'
}

export function quizMistakeRows(mistakes: readonly QuizMistake[]): MistakeRow[] {
  return mistakes.map(({ question, chosen, expected }) => ({
    key: question.cardId,
    prompt: question.term,
    given: chosen,
    expected,
  }))
}
