import { describe, expect, it } from 'vitest'
import {
  formatInterval,
  initReviewSession,
  isIntervalStale,
  RATING_LABELS,
  reviewReducer,
} from './review-session'

const now = new Date('2026-10-13T08:00:00Z')
const later = (ms: number) => new Date(now.getTime() + ms)
const MINUTE = 60_000
const DAY = 24 * 60 * MINUTE

describe('formatInterval', () => {
  it('arrondit le délai à l’unité la plus parlante', () => {
    expect(formatInterval(later(0), now)).toBe('1 min')
    expect(formatInterval(later(10 * MINUTE), now)).toBe('10 min')
    expect(formatInterval(later(3 * 60 * MINUTE), now)).toBe('3 h')
    expect(formatInterval(later(DAY), now)).toBe('1 j')
    expect(formatInterval(later(12 * DAY), now)).toBe('12 j')
    expect(formatInterval(later(61 * DAY), now)).toBe('2 mois')
    expect(formatInterval(later(400 * DAY), now)).toBe('1 an')
    expect(formatInterval(later(800 * DAY), now)).toBe('2 ans')
  })
})

/** Carte de file de révision, réduite à ce que les tests manipulent (le reducer n'exige que id). */
interface TestCard {
  id: string
  setId: string
  term: string
  definition: string
  state: string
  intervals: string[]
}

const card = (id: string): TestCard => ({
  id,
  setId: 's',
  term: `terme ${id}`,
  definition: `définition ${id}`,
  state: 'new',
  intervals: [],
})

describe('séance de révision', () => {
  it('retourne la carte puis passe à la suivante après la note', () => {
    let state = initReviewSession([card('a'), card('b')])
    state = reviewReducer(state, { type: 'flip' })
    expect(state.flipped).toBe(true)
    state = reviewReducer(state, { type: 'graded', rating: 4, requeue: null })
    expect(state.queue.map((item) => item.id)).toEqual(['b'])
    expect(state).toMatchObject({ flipped: false, ratings: { 1: 0, 2: 0, 3: 0, 4: 1 } })
  })

  it('remet en fin de séance une carte encore due aujourd’hui', () => {
    let state = initReviewSession([card('a'), card('b')])
    const updated: TestCard = { ...card('a'), state: 'learning' }
    state = reviewReducer(state, { type: 'graded', rating: 1, requeue: updated })
    expect(state.queue).toEqual([card('b'), updated])
    expect(state.ratings[1]).toBe(1)
  })

  it('démarre sans note, face cachée et sans intervalle périmé', () => {
    const state = initReviewSession([card('a')])
    expect(state).toEqual({
      queue: [card('a')],
      flipped: false,
      ratings: { 1: 0, 2: 0, 3: 0, 4: 0 },
      staleIds: [],
    })
    expect(isIntervalStale(state, 'a')).toBe(false)
  })

  it('ne retourne rien sur une file vide', () => {
    const empty = initReviewSession<TestCard>([])
    expect(reviewReducer(empty, { type: 'flip' })).toBe(empty)
  })

  it('nomme les quatre notes', () => {
    expect(Object.values(RATING_LABELS)).toEqual(['À revoir', 'Difficile', 'Bien', 'Facile'])
  })
})

const ids = (state: { queue: TestCard[] }) => state.queue.map((item) => item.id)

describe('note locale (sans réponse du serveur)', () => {
  it.each([2, 3, 4] as const)(
    'termine la carte avec la note %i, comme une note confirmée',
    (rating) => {
      const flipped = reviewReducer(initReviewSession([card('a'), card('b')]), { type: 'flip' })
      const local = reviewReducer(flipped, { type: 'gradedLocal', rating })
      expect(local).toEqual(reviewReducer(flipped, { type: 'graded', rating, requeue: null }))
      expect(ids(local)).toEqual(['b'])
      expect(local.ratings[rating]).toBe(1)
      expect(local.flipped).toBe(false)
      expect(local.staleIds).toEqual([])
    },
  )

  it('remet la carte en fin de file avec « À revoir » et périme ses intervalles', () => {
    const start = initReviewSession([card('a'), card('b'), card('c')])
    const flipped = reviewReducer(start, { type: 'flip' })
    const state = reviewReducer(flipped, { type: 'gradedLocal', rating: 1 })
    expect(ids(state)).toEqual(['b', 'c', 'a'])
    // La carte repart telle quelle : ses intervalles sont ceux d'avant la note.
    expect(state.queue[2]).toBe(start.queue[0])
    expect(state).toMatchObject({
      flipped: false,
      ratings: { 1: 1, 2: 0, 3: 0, 4: 0 },
      staleIds: ['a'],
    })
    expect(isIntervalStale(state, 'a')).toBe(true)
    expect(isIntervalStale(state, 'b')).toBe(false)
    expect(isIntervalStale(state, 'inconnue')).toBe(false)
  })

  it('compte la note et fait tourner la file, sans doublon dans les intervalles périmés', () => {
    let state = initReviewSession([card('a')])
    state = reviewReducer(state, { type: 'gradedLocal', rating: 1 })
    state = reviewReducer(state, { type: 'gradedLocal', rating: 1 })
    expect(ids(state)).toEqual(['a'])
    expect(state.staleIds).toEqual(['a'])
    expect(state.ratings[1]).toBe(2)
  })

  it('retire la carte des intervalles périmés quand elle est enfin terminée', () => {
    let state = initReviewSession([card('a'), card('b')])
    state = reviewReducer(state, { type: 'gradedLocal', rating: 1 }) // b, a : a est périmée
    state = reviewReducer(state, { type: 'gradedLocal', rating: 3 }) // b terminée
    expect(state).toMatchObject({ queue: [card('a')], staleIds: ['a'] })
    state = reviewReducer(state, { type: 'gradedLocal', rating: 4 }) // a terminée
    expect(state).toMatchObject({ queue: [], staleIds: [] })
    expect(state.ratings).toEqual({ 1: 1, 2: 0, 3: 1, 4: 1 })
  })

  it('ne change rien sur une file vide', () => {
    const empty = initReviewSession<TestCard>([])
    expect(reviewReducer(empty, { type: 'gradedLocal', rating: 1 })).toBe(empty)
    expect(reviewReducer(empty, { type: 'gradedLocal', rating: 3 })).toBe(empty)
    // Une fois la file vidée par des notes locales, une note de plus est ignorée.
    const done = reviewReducer(initReviewSession([card('a')]), { type: 'gradedLocal', rating: 2 })
    expect(reviewReducer(done, { type: 'gradedLocal', rating: 2 })).toBe(done)
  })
})

describe('réponse du serveur après des notes locales', () => {
  const offline = () => {
    let state = initReviewSession([card('a'), card('b'), card('c')])
    state = reviewReducer(state, { type: 'gradedLocal', rating: 1 }) // b, c, a
    state = reviewReducer(state, { type: 'gradedLocal', rating: 1 }) // c, a, b
    return state
  }

  it('une carte revenue avec des intervalles frais n’est plus périmée', () => {
    let state = offline()
    expect(state.staleIds).toEqual(['a', 'b'])
    state = reviewReducer(state, { type: 'graded', rating: 3, requeue: null }) // c terminée
    const fresh: TestCard = { ...card('a'), state: 'learning', intervals: ['2026-10-13T08:10:00Z'] }
    state = reviewReducer(state, { type: 'graded', rating: 1, requeue: fresh })
    expect(state.queue).toEqual([card('b'), fresh])
    // Les autres cartes restent périmées : seule `a` a reçu une réponse du serveur.
    expect(state.staleIds).toEqual(['b'])
    expect(isIntervalStale(state, 'a')).toBe(false)
    expect(isIntervalStale(state, 'b')).toBe(true)
  })

  it('une carte notée par le serveur puis terminée n’est plus périmée', () => {
    let state = reviewReducer(initReviewSession([card('a')]), { type: 'gradedLocal', rating: 1 })
    state = reviewReducer(state, { type: 'graded', rating: 3, requeue: null })
    expect(state).toMatchObject({ queue: [], staleIds: [] })
    expect(state.ratings).toEqual({ 1: 1, 2: 0, 3: 1, 4: 0 })
  })

  it('une note du serveur sans carte périmée laisse la liste intacte', () => {
    const state = reviewReducer(initReviewSession([card('a'), card('b')]), {
      type: 'graded',
      rating: 4,
      requeue: null,
    })
    expect(state.staleIds).toEqual([])
  })
})
