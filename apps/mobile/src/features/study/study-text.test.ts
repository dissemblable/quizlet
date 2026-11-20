import {
  ApiError,
  initFlashcards,
  initQuiz,
  initWrite,
  mistakesOf,
  progressOf,
  type QuizQuestion,
  quizReducer,
  type WriteAnswer,
  writeReducer,
  writeScoreOf,
} from '@quizlet/shared'
import { describe, expect, it } from 'vitest'
import { choiceAccessibilityLabel, choiceStatus } from './choice-status'
import {
  countsLabel,
  faceAnnouncement,
  markLabel,
  pickCards,
  positionLabel,
  recapAnnouncement,
  recapSubtitle,
  reviewAgainLabel,
} from './flashcards-view'
import {
  isNotEnoughCards,
  nextQuestionLabel,
  quizFeedback,
  quizMistakeRows,
  quizStatement,
} from './quiz-text'
import {
  correctCountLabel,
  percentOf,
  questionAnnouncement,
  questionPosition,
  resultAnnouncement,
  scoreLine,
} from './result-text'
import { dueStatus, selectWritePool, startLabel } from './write-pool'
import {
  answerFieldLabel,
  canOverride,
  continueLabel,
  promptLabel,
  writeFeedback,
  writeFeedbackAnnouncement,
  writeMistakeRows,
  writeStatement,
} from './write-text'

const question: QuizQuestion = {
  cardId: 'c1',
  term: 'France',
  choices: ['Rome', 'Paris', 'Madrid', 'Berlin'],
  answerIndex: 1,
}

describe('résultat', () => {
  it('calcule le pourcentage sans NaN', () => {
    expect(percentOf(1, 3)).toBe(33)
    expect(percentOf(2, 3)).toBe(67)
    expect(percentOf(0, 0)).toBe(0)
  })

  it('formule position, compteur et score comme le web', () => {
    expect(questionPosition(0, 4, false, 'Quiz terminé')).toBe('Question 1 sur 4')
    expect(questionPosition(4, 4, true, 'Quiz terminé')).toBe('Quiz terminé')
    expect(correctCountLabel(2, 3)).toBe('Bonnes réponses : 2 / 3')
    expect(scoreLine(50)).toBe('50 % de bonnes réponses. Bien joué, encore un effort.')
    expect(scoreLine(100)).toBe('100 % de bonnes réponses. Sans faute, bravo !')
    expect(resultAnnouncement(1, 2)).toBe(
      'Résultat : 1 sur 2. 50 % de bonnes réponses. Bien joué, encore un effort.',
    )
    expect(questionAnnouncement(1, 4, 'Terme : France')).toBe('Question 2 sur 4. Terme : France')
  })
})

describe('états des choix du quiz', () => {
  it('reste « idle » tant qu’aucune réponse n’est donnée', () => {
    expect([0, 1, 2, 3].map((i) => choiceStatus(question, undefined, i))).toEqual([
      'idle',
      'idle',
      'idle',
      'idle',
    ])
  })

  it('marque la bonne réponse, la mauvaise choisie et grise le reste', () => {
    expect([0, 1, 2, 3].map((i) => choiceStatus(question, 0, i))).toEqual([
      'wrong',
      'correct',
      'dimmed',
      'dimmed',
    ])
    expect([0, 1, 2, 3].map((i) => choiceStatus(question, 1, i))).toEqual([
      'dimmed',
      'correct',
      'dimmed',
      'dimmed',
    ])
  })

  it('libelle les choix pour TalkBack', () => {
    expect(choiceAccessibilityLabel(0, 'Rome', 'wrong')).toBe('1. Rome (votre réponse)')
    expect(choiceAccessibilityLabel(1, 'Paris', 'correct')).toBe('2. Paris (bonne réponse)')
    expect(choiceAccessibilityLabel(2, 'Madrid', 'dimmed')).toBe('3. Madrid')
    expect(choiceAccessibilityLabel(3, 'Berlin', 'idle')).toBe('4. Berlin')
  })
})

describe('textes du quiz', () => {
  it('donne le retour de la réponse', () => {
    expect(quizFeedback(question, undefined)).toBeNull()
    expect(quizFeedback(question, 1)).toEqual({ correct: true, text: 'Bonne réponse !' })
    expect(quizFeedback(question, 0)).toEqual({
      correct: false,
      text: 'Mauvaise réponse. La bonne réponse était : Paris',
    })
  })

  it('propose « Voir le résultat » à la dernière question', () => {
    expect(nextQuestionLabel(0, 2)).toBe('Question suivante')
    expect(nextQuestionLabel(1, 2)).toBe('Voir le résultat')
  })

  it('reconnaît le refus de l’API pour un set trop petit', () => {
    expect(isNotEnoughCards(new ApiError(422, 'QUIZ_NOT_ENOUGH_CARDS', 'Au moins 4 cartes.'))).toBe(
      true,
    )
    expect(isNotEnoughCards(new ApiError(500, 'UNKNOWN', 'Erreur'))).toBe(false)
    expect(isNotEnoughCards(new Error('QUIZ_NOT_ENOUGH_CARDS'))).toBe(false)
    expect(quizStatement('France')).toBe('Quelle est la définition de : France')
  })

  it('résume les erreurs d’une session jouée avec le reducer partagé', () => {
    let state = initQuiz([question])
    state = quizReducer(state, { type: 'answer', choice: 0 })
    state = quizReducer(state, { type: 'next' })
    expect(state.finished).toBe(true)
    expect(quizMistakeRows(mistakesOf(state))).toEqual([
      { key: 'c1', prompt: 'France', given: 'Rome', expected: 'Paris' },
    ])
  })
})

describe('textes du mode écrit', () => {
  const questions = [
    { cardId: 'c1', shown: 'term' as const, prompt: 'France', answer: 'Paris' },
    { cardId: 'c2', shown: 'definition' as const, prompt: 'Rome', answer: 'Italie' },
  ]

  function answered(given: string): WriteAnswer {
    const { current } = writeReducer(initWrite(questions), { type: 'submit', given })
    if (!current) throw new Error('réponse attendue')
    return current
  }

  it('libelle l’énoncé et le champ selon le côté affiché', () => {
    expect(promptLabel('term')).toBe('Terme')
    expect(promptLabel('definition')).toBe('Définition')
    expect(answerFieldLabel('term')).toBe('Votre définition')
    expect(answerFieldLabel('definition')).toBe('Votre terme')
    expect(writeStatement({ shown: 'term', prompt: 'France' })).toBe('Terme : France')
    expect(continueLabel(0, 2)).toBe('Continuer')
    expect(continueLabel(1, 2)).toBe('Voir le résultat')
  })

  it('corrige : exact, faute de frappe, faux, vide', () => {
    expect(writeFeedback(answered('paris'))).toEqual({
      correct: true,
      title: 'Correct !',
      detail: null,
    })
    expect(writeFeedback(answered('Pariss'))).toEqual({
      correct: true,
      title: 'Correct, à une faute près.',
      detail: 'Réponse attendue : Paris',
    })
    expect(writeFeedback(answered('Lyon'))).toEqual({
      correct: false,
      title: 'Incorrect.',
      detail: 'Bonne réponse : Paris',
    })
    expect(writeFeedback(answered('  '))).toEqual({
      correct: false,
      title: 'Voici la réponse.',
      detail: 'Bonne réponse : Paris',
    })
  })

  it('compte « J’avais raison » et l’annonce', () => {
    const wrong = answered('Lyon')
    expect(canOverride(wrong)).toBe(true)
    const state = writeReducer(
      writeReducer(initWrite(questions), { type: 'submit', given: 'Lyon' }),
      {
        type: 'override',
      },
    )
    const overridden = state.current
    if (!overridden) throw new Error('réponse attendue')
    expect(canOverride(overridden)).toBe(false)
    const feedback = writeFeedback(overridden)
    expect(feedback.title).toBe('Réponse comptée juste.')
    expect(writeFeedbackAnnouncement(feedback)).toBe(
      'Réponse comptée juste. Réponse attendue : Paris',
    )
    expect(writeFeedbackAnnouncement(writeFeedback(answered('paris')))).toBe('Correct !')
  })

  it('ne propose pas « J’avais raison » pour une saisie vide ou juste', () => {
    expect(canOverride(answered(''))).toBe(false)
    expect(canOverride(answered('Pariss'))).toBe(false)
    expect(canOverride(answered('paris'))).toBe(false)
  })

  it('résume les erreurs, « (aucune) » pour une saisie vide', () => {
    let state = initWrite(questions)
    state = writeReducer(state, { type: 'submit', given: '' })
    state = writeReducer(state, { type: 'next' })
    state = writeReducer(state, { type: 'submit', given: ' italie ' })
    state = writeReducer(state, { type: 'next' })
    expect(state.finished).toBe(true)
    expect(writeMistakeRows(writeScoreOf(state).mistakes)).toEqual([
      { key: 'c1', prompt: 'France', given: '(aucune)', expected: 'Paris' },
    ])
  })
})

describe('pool « à revoir » du mode écrit', () => {
  const cards = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]

  it('garde tout le set sans l’option', () => {
    expect(selectWritePool(cards, ['b'], false)).toEqual(cards)
    expect(selectWritePool(cards, undefined, false)).toEqual(cards)
  })

  it('retient l’intersection avec les cartes dues, dans l’ordre du set', () => {
    expect(selectWritePool(cards, ['c', 'a', 'inconnue'], true)).toEqual([{ id: 'a' }, { id: 'c' }])
    expect(selectWritePool(cards, [], true)).toEqual([])
  })

  it('est vide tant que les cartes dues ne sont pas chargées', () => {
    expect(selectWritePool(cards, undefined, true)).toEqual([])
  })

  it('décrit l’état de la recherche', () => {
    const base = { onlyDue: true, errorText: null, loading: false, count: 2 }
    expect(dueStatus({ ...base, onlyDue: false })).toBeNull()
    expect(dueStatus({ ...base, errorText: 'Boum' })).toBe('Boum')
    expect(dueStatus({ ...base, loading: true })).toBe('Recherche des cartes à revoir…')
    expect(dueStatus({ ...base, count: 0 })).toBe(
      "Aucune carte de ce set n'est à revoir aujourd'hui.",
    )
    expect(dueStatus({ ...base, count: 1 })).toBe("1 carte à revoir aujourd'hui.")
    expect(dueStatus(base)).toBe("2 cartes à revoir aujourd'hui.")
  })

  it('libelle le bouton de départ', () => {
    expect(startLabel(1)).toBe('Commencer (1 carte)')
    expect(startLabel(3)).toBe('Commencer (3 cartes)')
    expect(startLabel(0)).toBe('Commencer (0 carte)')
  })
})

describe('textes des flashcards', () => {
  it('suit la progression avec le reducer partagé', () => {
    const state = initFlashcards(['a', 'b'])
    expect(positionLabel(progressOf(state), false)).toBe('Carte 1 sur 2')
    expect(positionLabel(progressOf(state), true)).toBe('Session terminée')
    expect(countsLabel(progressOf(state))).toBe('Je sais : 0 · À revoir : 0')
  })

  it('libelle les marques, les faces et le récapitulatif', () => {
    expect(markLabel('known')).toBe('Marquée « Je sais »')
    expect(markLabel('review')).toBe('Marquée « À revoir »')
    const card = { term: 'France', definition: 'Paris' }
    expect(faceAnnouncement(card, false)).toBe('Terme : France')
    expect(faceAnnouncement(card, true)).toBe('Définition : Paris')
    expect(recapSubtitle(1)).toBe('Vous avez parcouru 1 carte.')
    expect(recapSubtitle(12)).toBe('Vous avez parcouru 12 cartes.')
    expect(recapAnnouncement(2)).toBe('Session terminée. Vous avez parcouru 2 cartes.')
    expect(reviewAgainLabel(1)).toBe('Réviser la carte à revoir')
    expect(reviewAgainLabel(3)).toBe('Réviser les 3 cartes à revoir')
  })

  it('retrouve les cartes par identifiant et ignore les absentes', () => {
    const cards = [{ id: 'a' }, { id: 'b' }]
    expect(pickCards(['b', 'x', 'a'], cards)).toEqual([{ id: 'b' }, { id: 'a' }])
  })
})
