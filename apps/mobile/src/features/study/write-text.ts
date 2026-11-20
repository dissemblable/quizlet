import type { WriteAnswer, WriteDirection, WriteQuestion } from '@quizlet/shared'
import type { MistakeRow } from './result-text'

export const WRITE_DIRECTIONS: ReadonlyArray<{ value: WriteDirection; label: string }> = [
  { value: 'term', label: 'Le terme : j’écris la définition' },
  { value: 'definition', label: 'La définition : j’écris le terme' },
  { value: 'mixed', label: 'Les deux, mélangés' },
]

/** Côté affiché de la question (« Terme » : on écrit la définition). */
export function promptLabel(shown: WriteQuestion['shown']): string {
  return shown === 'term' ? 'Terme' : 'Définition'
}

export function answerFieldLabel(shown: WriteQuestion['shown']): string {
  return shown === 'term' ? 'Votre définition' : 'Votre terme'
}

export function writeStatement(question: Pick<WriteQuestion, 'shown' | 'prompt'>): string {
  return `${promptLabel(question.shown)} : ${question.prompt}`
}

export function continueLabel(index: number, total: number): string {
  return index >= total - 1 ? 'Voir le résultat' : 'Continuer'
}

export interface WriteFeedback {
  correct: boolean
  title: string
  /** Réponse attendue ; `null` quand la réponse est exacte. */
  detail: string | null
}

/** Correction affichée sous le champ une fois la réponse validée. */
export function writeFeedback(answer: WriteAnswer): WriteFeedback {
  const expected = answer.question.answer
  if (answer.result === 'exact') return { correct: true, title: 'Correct !', detail: null }
  if (answer.result === 'typo' || answer.overridden) {
    return {
      correct: true,
      title: answer.overridden ? 'Réponse comptée juste.' : 'Correct, à une faute près.',
      detail: `Réponse attendue : ${expected}`,
    }
  }
  return {
    correct: false,
    title: answer.given.trim() ? 'Incorrect.' : 'Voici la réponse.',
    detail: `Bonne réponse : ${expected}`,
  }
}

export function writeFeedbackAnnouncement({ title, detail }: WriteFeedback): string {
  return detail === null ? title : `${title} ${detail}`
}

/** « J'avais raison » : seulement pour une réponse fausse, non déjà comptée, et non vide. */
export function canOverride(answer: WriteAnswer): boolean {
  return answer.result === 'wrong' && !answer.overridden && answer.given.trim() !== ''
}

export function writeMistakeRows(mistakes: readonly WriteAnswer[]): MistakeRow[] {
  return mistakes.map(({ question, given }) => ({
    key: question.cardId,
    prompt: question.prompt,
    given: given.trim() || '(aucune)',
    expected: question.answer,
  }))
}
