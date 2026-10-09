import { type RandomFn, shuffle } from '@quizlet/shared'

export type Mark = 'known' | 'review'

export interface FlashcardsState {
  /** Toutes les cartes du set, dans l'ordre du set. */
  all: string[]
  /** Cartes de la session, dans l'ordre du set (toutes, ou seulement celles « à revoir »). */
  deck: string[]
  /** Ordre de passage : `deck`, éventuellement mélangé. */
  order: string[]
  index: number
  flipped: boolean
  shuffled: boolean
  marks: Record<string, Mark>
  finished: boolean
}

export type FlashcardsAction =
  | { type: 'flip' }
  | { type: 'next' }
  | { type: 'previous' }
  | { type: 'mark'; mark: Mark }
  | { type: 'toggleShuffle'; random?: RandomFn }
  | { type: 'restart'; onlyReview?: boolean; random?: RandomFn }

function startSession(
  all: string[],
  deck: string[],
  shuffled: boolean,
  random: RandomFn = Math.random,
): FlashcardsState {
  return {
    all,
    deck,
    order: shuffled ? shuffle(deck, random) : [...deck],
    index: 0,
    flipped: false,
    shuffled,
    marks: {},
    finished: deck.length === 0,
  }
}

export function initFlashcards(cardIds: readonly string[]): FlashcardsState {
  return startSession([...cardIds], [...cardIds], false)
}

export function currentCardId(state: FlashcardsState): string | undefined {
  return state.finished ? undefined : state.order[state.index]
}

function goNext(state: FlashcardsState): FlashcardsState {
  if (state.index >= state.order.length - 1) return { ...state, flipped: false, finished: true }
  return { ...state, index: state.index + 1, flipped: false }
}

export function flashcardsReducer(
  state: FlashcardsState,
  action: FlashcardsAction,
): FlashcardsState {
  switch (action.type) {
    case 'flip':
      return state.finished ? state : { ...state, flipped: !state.flipped }
    case 'next':
      return state.finished ? state : goNext(state)
    case 'previous':
      return state.finished || state.index === 0
        ? state
        : { ...state, index: state.index - 1, flipped: false }
    case 'mark': {
      const id = currentCardId(state)
      if (!id) return state
      // Marquer une carte passe automatiquement à la suivante.
      return goNext({ ...state, marks: { ...state.marks, [id]: action.mark } })
    }
    case 'toggleShuffle':
      // Mélanger (ou revenir à l'ordre du set) relance la session sur les mêmes cartes.
      return startSession(state.all, state.deck, !state.shuffled, action.random)
    case 'restart': {
      // « Réviser les cartes à revoir » ou « Recommencer » (toutes les cartes du set).
      const review = reviewIds(state)
      const deck = action.onlyReview && review.length > 0 ? review : state.all
      return startSession(state.all, deck, state.shuffled, action.random)
    }
  }
}

/** Cartes marquées « à revoir », dans l'ordre du set. */
export function reviewIds(state: FlashcardsState): string[] {
  return state.deck.filter((id) => state.marks[id] === 'review')
}

export interface FlashcardsProgress {
  /** Position affichée (« carte 3 sur 12 »). */
  position: number
  total: number
  /** Part des cartes déjà passées, de 0 à 100. */
  percent: number
  known: number
  review: number
  unmarked: number
}

export function progressOf(state: FlashcardsState): FlashcardsProgress {
  const total = state.order.length
  const passed = state.finished ? total : state.index
  const marks = state.deck.map((id) => state.marks[id])
  const known = marks.filter((mark) => mark === 'known').length
  const review = marks.filter((mark) => mark === 'review').length
  return {
    position: Math.min(state.index + 1, total),
    total,
    percent: total === 0 ? 0 : Math.round((passed / total) * 100),
    known,
    review,
    unmarked: total - known - review,
  }
}
