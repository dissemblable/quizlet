import { countDistinctDefinitions, QUIZ_MIN_CARDS } from '@quizlet/shared'

export type StudyModeKey = 'review' | 'flashcards' | 'quiz' | 'write'

export interface StudyMode {
  key: StudyModeKey
  title: string
  description: string
  /** Présent : le mode n'est pas disponible, la raison remplace la description (bloc désactivé). */
  unavailableReason?: string
}

export const NO_CARDS_REASON = 'Ajoutez des cartes pour réviser.'

export function quizUnavailableReason(cards: ReadonlyArray<{ definition: string }>) {
  return countDistinctDefinitions(cards) < QUIZ_MIN_CARDS
    ? `Il faut au moins ${QUIZ_MIN_CARDS} cartes aux définitions différentes.`
    : undefined
}

/**
 * Les 4 modes d'étude d'un set, avec les mêmes textes et les mêmes raisons d'indisponibilité que le
 * web. Le quiz ne dépend que des définitions distinctes : un set vide affiche donc la raison du
 * quiz, pas « Ajoutez des cartes ».
 */
export function studyModes(cards: ReadonlyArray<{ definition: string }>): StudyMode[] {
  const noCards = cards.length === 0 ? NO_CARDS_REASON : undefined
  return [
    {
      key: 'review',
      title: 'Répétition espacée',
      description: 'Révisez chaque carte au bon moment (FSRS).',
      unavailableReason: noCards,
    },
    {
      key: 'flashcards',
      title: 'Flashcards',
      description: 'Retournez les cartes et notez celles à revoir.',
      unavailableReason: noCards,
    },
    {
      key: 'quiz',
      title: 'Quiz',
      description: 'Questions à choix multiples, avec un score final.',
      unavailableReason: quizUnavailableReason(cards),
    },
    {
      key: 'write',
      title: 'Mode écrit',
      description: 'Tapez la réponse, corrigée avec tolérance.',
      unavailableReason: noCards,
    },
  ]
}
