import type { RandomFn } from '@quizlet/shared'
import type { Db } from '../db/client'
import type { User } from '../db/schema'
import { generateQuiz, NotEnoughCardsError, type QuizQuestion } from '../domain/quiz'
import { ApiError } from '../errors'
import { findViewableSet, loadCards } from './sets'

/** Quiz d'un set lisible par l'utilisateur (même règle d'accès que la lecture du set). */
export async function getQuiz(
  db: Db,
  setId: string,
  user: User,
  random?: RandomFn,
): Promise<QuizQuestion[]> {
  const set = await findViewableSet(db, setId, user)
  try {
    return generateQuiz(await loadCards(db, set.id), random)
  } catch (error) {
    if (error instanceof NotEnoughCardsError) {
      throw new ApiError(422, 'QUIZ_NOT_ENOUGH_CARDS', error.message)
    }
    throw error
  }
}
