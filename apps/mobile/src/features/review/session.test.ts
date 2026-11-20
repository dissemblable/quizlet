import { initReviewSession, reviewReducer } from '@quizlet/shared'
import { describe, expect, it } from 'vitest'
import type { QueueCard } from '@/lib/queries'
import {
  applyGradeOutcome,
  cardAnnouncement,
  gradeAnnouncement,
  intervalLabel,
  pendingNotice,
  progressPercent,
  ratingAccessibilityLabel,
  recapAnnouncement,
  recapCounters,
  reviewedCount,
  reviewedLabel,
  reviewQueueView,
  reviewTarget,
  sessionStatus,
} from './session'

const now = new Date('2026-03-10T12:00:00.000Z')
const inMinutes = (minutes: number) => new Date(now.getTime() + minutes * 60_000).toISOString()
const inDays = (days: number) => new Date(now.getTime() + days * 86_400_000).toISOString()

function queueCard(id: string): QueueCard {
  return {
    id,
    setId: 's1',
    term: `Terme ${id}`,
    definition: `Définition ${id}`,
    state: 'new',
    intervals: [inMinutes(10), inMinutes(10), inDays(1), inDays(3)],
  }
}

describe('applyGradeOutcome', () => {
  it('note enregistrée sans retour en file : la carte est terminée', () => {
    expect(applyGradeOutcome(3, { kind: 'synced', requeue: null, ignored: false })).toEqual({
      type: 'graded',
      rating: 3,
      requeue: null,
    })
  })

  it('note enregistrée avec retour en file : la carte revient avec ses nouveaux intervalles', () => {
    const again = queueCard('c1')
    expect(applyGradeOutcome(1, { kind: 'synced', requeue: again, ignored: false })).toEqual({
      type: 'graded',
      rating: 1,
      requeue: again,
    })
  })

  it('note ignorée par le serveur : comptée, jamais remise en file', () => {
    expect(
      applyGradeOutcome(1, { kind: 'synced', requeue: queueCard('c1'), ignored: true }),
    ).toEqual({ type: 'graded', rating: 1, requeue: null })
  })

  it('note en attente : action locale, quelle que soit la note', () => {
    expect(applyGradeOutcome(1, { kind: 'queued' })).toEqual({ type: 'gradedLocal', rating: 1 })
    expect(applyGradeOutcome(4, { kind: 'queued' })).toEqual({ type: 'gradedLocal', rating: 4 })
  })

  it('branché sur le reducer partagé : la file avance comme attendu', () => {
    const [c1, c2] = [queueCard('c1'), queueCard('c2')]
    let state = initReviewSession([c1, c2])
    state = reviewReducer(state, { type: 'flip' })
    // « À revoir » hors ligne : c1 repart en fin de file, ses intervalles sont périmés.
    state = reviewReducer(state, applyGradeOutcome(1, { kind: 'queued' }))
    expect(state.queue.map((card) => card.id)).toEqual(['c2', 'c1'])
    expect(state.flipped).toBe(false)
    expect(state.staleIds).toEqual(['c1'])
    // « Bien » en ligne : c2 est terminée.
    state = reviewReducer(
      state,
      applyGradeOutcome(3, { kind: 'synced', requeue: null, ignored: false }),
    )
    expect(state.queue.map((card) => card.id)).toEqual(['c1'])
    expect(state.ratings).toEqual({ 1: 1, 2: 0, 3: 1, 4: 0 })
  })
})

describe('progression et libellés', () => {
  it('arrondit la part de cartes notées', () => {
    expect(progressPercent(0, 3)).toBe(0)
    expect(progressPercent(1, 2)).toBe(33)
    expect(progressPercent(2, 1)).toBe(67)
    expect(progressPercent(3, 0)).toBe(100)
    expect(progressPercent(0, 0)).toBe(0)
  })

  it('compte les notes données', () => {
    expect(reviewedCount({ 1: 2, 2: 0, 3: 3, 4: 1 })).toBe(6)
  })

  it('annonce le nombre de cartes restantes ou la fin de la séance', () => {
    expect(sessionStatus(1)).toBe('Encore 1 carte')
    expect(sessionStatus(2)).toBe('Encore 2 cartes')
    expect(sessionStatus(0)).toBe('Séance terminée')
  })

  it('accorde « note donnée »', () => {
    expect(reviewedLabel(0)).toBe('0 note donnée')
    expect(reviewedLabel(1)).toBe('1 note donnée')
    expect(reviewedLabel(2)).toBe('2 notes données')
  })

  it('liste un compteur par note, dans l’ordre', () => {
    expect(recapCounters({ 1: 2, 2: 0, 3: 3, 4: 1 })).toEqual([
      { rating: 1, label: 'À revoir', count: 2 },
      { rating: 2, label: 'Difficile', count: 0 },
      { rating: 3, label: 'Bien', count: 3 },
      { rating: 4, label: 'Facile', count: 1 },
    ])
  })

  it('accorde les notes en attente de synchronisation', () => {
    expect(pendingNotice(1)).toBe('1 note en attente de synchronisation')
    expect(pendingNotice(3)).toBe('3 notes en attente de synchronisation')
  })

  it('annonce la face visible, la note et le récapitulatif', () => {
    const card = queueCard('c1')
    expect(cardAnnouncement(card, false)).toBe('Terme : Terme c1')
    expect(cardAnnouncement(card, true)).toBe('Définition : Définition c1')
    expect(gradeAnnouncement(3)).toBe('Note donnée : Bien')
    expect(recapAnnouncement(2)).toBe('Séance terminée. 2 notes données.')
  })
})

describe('intervalLabel', () => {
  const card = queueCard('c1')

  it('affiche l’intervalle prévu pour la note', () => {
    expect(intervalLabel({ staleIds: [] }, card, 1, now)).toBe('10 min')
    expect(intervalLabel({ staleIds: [] }, card, 3, now)).toBe('1 j')
    expect(intervalLabel({ staleIds: [] }, card, 4, now)).toBe('3 j')
  })

  it('masque l’intervalle d’une carte aux prévisions périmées', () => {
    expect(intervalLabel({ staleIds: ['c1'] }, card, 3, now)).toBeNull()
    expect(intervalLabel({ staleIds: ['autre'] }, card, 3, now)).toBe('1 j')
  })

  it('retombe sur « maintenant » si la prévision manque', () => {
    expect(intervalLabel({ staleIds: [] }, { id: 'c1', intervals: [] }, 2, now)).toBe('1 min')
  })

  it('compose le libellé d’accessibilité', () => {
    expect(ratingAccessibilityLabel(4, '3 j')).toBe('Facile, revue dans 3 j')
    expect(ratingAccessibilityLabel(1, null)).toBe('À revoir')
  })
})

describe('reviewQueueView', () => {
  const base = { hasData: false, isPending: true, isError: false, fetchStatus: 'idle' } as const

  it('attend la file fraîche en ligne, même si un instantané existe', () => {
    expect(
      reviewQueueView({ ...base, hasData: true, isPending: false, fetchStatus: 'fetching' }),
    ).toBe('loading')
    expect(reviewQueueView({ ...base, fetchStatus: 'fetching' })).toBe('loading')
  })

  it('utilise l’instantané hors ligne (requête en pause) ou après un échec de rafraîchissement', () => {
    expect(
      reviewQueueView({ ...base, hasData: true, isPending: false, fetchStatus: 'paused' }),
    ).toBe('ready')
    expect(
      reviewQueueView({
        ...base,
        hasData: true,
        isPending: false,
        isError: true,
        fetchStatus: 'idle',
      }),
    ).toBe('ready')
  })

  it('hors ligne sans instantané : données indisponibles ; sans données et en erreur : erreur', () => {
    expect(reviewQueueView({ ...base, fetchStatus: 'paused' })).toBe('offline')
    expect(reviewQueueView({ ...base, isPending: false, isError: true })).toBe('error')
  })

  it('attend la restauration du cache (en attente, au repos)', () => {
    expect(reviewQueueView(base)).toBe('loading')
  })
})

describe('reviewTarget', () => {
  it('révision du jour : retour à la bibliothèque', () => {
    expect(reviewTarget()).toEqual({
      title: 'Révision du jour',
      route: '/',
      backLabel: 'Bibliothèque',
      recapBackLabel: 'Retour à la bibliothèque',
    })
  })

  it('révision d’un set : titre et retour vers le set', () => {
    expect(reviewTarget({ id: 'abc', title: 'Capitales' })).toEqual({
      title: 'Réviser « Capitales »',
      route: '/sets/abc',
      backLabel: 'Capitales',
      recapBackLabel: 'Retour au set',
    })
  })
})
