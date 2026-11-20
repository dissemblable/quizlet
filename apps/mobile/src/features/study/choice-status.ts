import type { QuizQuestion } from '@quizlet/shared'

export type ChoiceStatus = 'idle' | 'correct' | 'wrong' | 'dimmed'

export function choiceStatus(
  question: Pick<QuizQuestion, 'answerIndex'>,
  answer: number | undefined,
  index: number,
): ChoiceStatus {
  if (answer === undefined) return 'idle'
  if (index === question.answerIndex) return 'correct'
  return index === answer ? 'wrong' : 'dimmed'
}

/** Ce que le web ajoute en texte masqué (lecteurs d'écran) à côté du choix. */
export function choiceStatusSuffix(status: ChoiceStatus): string {
  if (status === 'correct') return ' (bonne réponse)'
  if (status === 'wrong') return ' (votre réponse)'
  return ''
}

/** Libellé lu par TalkBack : « 2. Paris (bonne réponse) ». */
export function choiceAccessibilityLabel(
  index: number,
  label: string,
  status: ChoiceStatus,
): string {
  return `${index + 1}. ${label}${choiceStatusSuffix(status)}`
}
