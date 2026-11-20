import { verdict } from '@quizlet/shared'

/** Pourcentage arrondi ; 0 quand il n'y a rien à compter (jamais NaN). */
export function percentOf(part: number, total: number): number {
  return total === 0 ? 0 : Math.round((part / total) * 100)
}

/** « Question 2 sur 5 », ou le libellé de fin (« Quiz terminé », « Session terminée »). */
export function questionPosition(
  index: number,
  total: number,
  finished: boolean,
  finishedLabel: string,
): string {
  return finished ? finishedLabel : `Question ${index + 1} sur ${total}`
}

export function correctCountLabel(correct: number, answered: number): string {
  return `Bonnes réponses : ${correct} / ${answered}`
}

export function scoreLine(percent: number): string {
  return `${percent} % de bonnes réponses. ${verdict(percent)}`
}

export function resultAnnouncement(correct: number, total: number): string {
  return `Résultat : ${correct} sur ${total}. ${scoreLine(percentOf(correct, total))}`
}

/** Annonce d'une nouvelle question (le web déplace le focus sur l'énoncé). */
export function questionAnnouncement(index: number, total: number, statement: string): string {
  return `Question ${index + 1} sur ${total}. ${statement}`
}

/** Une erreur du récapitulatif (quiz et mode écrit). */
export interface MistakeRow {
  key: string
  prompt: string
  given: string
  expected: string
}
