import { seededRandom } from '@quizlet/shared'
import { describe, expect, it } from 'vitest'
import {
  currentCardId,
  type FlashcardsAction,
  type FlashcardsState,
  flashcardsReducer,
  initFlashcards,
  progressOf,
  reviewIds,
} from './flashcards'

const ids = ['a', 'b', 'c', 'd']
const run = (state: FlashcardsState, ...actions: FlashcardsAction[]) =>
  actions.reduce(flashcardsReducer, state)

describe('session de flashcards', () => {
  it("démarre sur la première carte, côté terme, dans l'ordre du set", () => {
    const state = initFlashcards(ids)
    expect(currentCardId(state)).toBe('a')
    expect(state.flipped).toBe(false)
    expect(progressOf(state)).toEqual({
      position: 1,
      total: 4,
      percent: 0,
      known: 0,
      review: 0,
      unmarked: 4,
    })
  })

  it('retourne la carte et revient au terme en changeant de carte', () => {
    let state = run(initFlashcards(ids), { type: 'flip' })
    expect(state.flipped).toBe(true)
    state = run(state, { type: 'next' })
    expect(currentCardId(state)).toBe('b')
    expect(state.flipped).toBe(false)
  })

  it('reste dans les bornes avec précédent', () => {
    const state = run(initFlashcards(ids), { type: 'previous' })
    expect(currentCardId(state)).toBe('a')
    expect(currentCardId(run(state, { type: 'next' }, { type: 'previous' }))).toBe('a')
  })

  it('termine la session après la dernière carte', () => {
    const state = run(initFlashcards(ids), ...Array(4).fill({ type: 'next' }))
    expect(state.finished).toBe(true)
    expect(currentCardId(state)).toBeUndefined()
    expect(progressOf(state).percent).toBe(100)
    // Les actions de navigation n'ont plus d'effet une fois la session terminée.
    expect(run(state, { type: 'next' }, { type: 'flip' })).toEqual(state)
  })

  it('enregistre « Je sais » / « À revoir » et passe à la carte suivante', () => {
    const state = run(
      initFlashcards(ids),
      { type: 'mark', mark: 'known' },
      { type: 'mark', mark: 'review' },
      { type: 'next' },
      { type: 'mark', mark: 'review' },
    )
    expect(state.finished).toBe(true)
    expect(state.marks).toEqual({ a: 'known', b: 'review', d: 'review' })
    expect(progressOf(state)).toMatchObject({ known: 1, review: 2, unmarked: 1, percent: 100 })
    expect(reviewIds(state)).toEqual(['b', 'd'])
  })

  it('calcule la progression en cours de session', () => {
    const state = run(initFlashcards(ids), { type: 'next' }, { type: 'next' })
    expect(progressOf(state)).toMatchObject({ position: 3, percent: 50 })
  })

  it('relance une session avec seulement les cartes à revoir', () => {
    const finished = run(
      initFlashcards(ids),
      { type: 'mark', mark: 'review' },
      { type: 'mark', mark: 'known' },
      { type: 'mark', mark: 'review' },
      { type: 'mark', mark: 'known' },
    )
    const state = run(finished, { type: 'restart', onlyReview: true })
    expect(state.order).toEqual(['a', 'c'])
    expect(state.marks).toEqual({})
    expect(state.finished).toBe(false)
    expect(progressOf(state).total).toBe(2)
  })

  it('recommence avec toutes les cartes du set, même après une révision ciblée', () => {
    const reviewing = run(
      initFlashcards(ids),
      { type: 'mark', mark: 'review' },
      { type: 'restart', onlyReview: true },
    )
    expect(reviewing.order).toEqual(['a'])
    expect(run(reviewing, { type: 'restart' }).order).toEqual(ids)
  })

  it('mélanger pendant une révision ciblée garde les mêmes cartes', () => {
    const state = run(
      initFlashcards(ids),
      { type: 'mark', mark: 'review' },
      { type: 'mark', mark: 'review' },
      { type: 'restart', onlyReview: true },
      { type: 'toggleShuffle', random: seededRandom(3) },
    )
    expect([...state.order].sort()).toEqual(['a', 'b'])
  })

  it('mélange de façon déterministe avec une graine, puis revient à l’ordre du set', () => {
    const random = seededRandom(42)
    const shuffled = run(initFlashcards(ids), { type: 'next' }, { type: 'toggleShuffle', random })
    expect(shuffled.shuffled).toBe(true)
    expect([...shuffled.order].sort()).toEqual(ids)
    expect(shuffled.order).not.toEqual(ids)
    expect(shuffled.index).toBe(0)

    const ordered = run(shuffled, { type: 'toggleShuffle' })
    expect(ordered.shuffled).toBe(false)
    expect(ordered.order).toEqual(ids)
  })

  it('conserve le mélange quand on recommence', () => {
    const state = run(
      initFlashcards(ids),
      { type: 'toggleShuffle', random: seededRandom(1) },
      { type: 'restart', random: seededRandom(2) },
    )
    expect(state.shuffled).toBe(true)
  })

  it('gère un set vide', () => {
    const state = initFlashcards([])
    expect(state.finished).toBe(true)
    expect(progressOf(state)).toMatchObject({ total: 0, percent: 0, position: 0 })
  })
})
