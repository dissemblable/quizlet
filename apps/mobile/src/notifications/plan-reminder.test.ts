import { describe, expect, it } from 'vitest'
import type { AuthStatus } from '@/auth/types'
import {
  nextTrigger,
  type PlanReminderInput,
  planReminder,
  REMINDER_GENERIC_BODY,
  SUMMARY_MAX_AGE_MS,
} from './plan-reminder'

// Heure LOCALE : le prochain déclenchement se calcule en heure locale, la machine de test a son fuseau.
const NOW = new Date(2026, 2, 10, 12, 0, 0)
const HOUR = 60 * 60 * 1000

function input(overrides: Partial<PlanReminderInput> = {}): PlanReminderInput {
  return {
    prefs: { enabled: true, hour: 18, minute: 30 },
    permission: 'granted',
    status: 'signedIn',
    summary: { due: 3, new: 2, updatedAt: NOW.getTime() - HOUR },
    now: NOW,
    ...overrides,
  }
}

describe('planReminder : annulation', () => {
  it('annule si le rappel est désactivé', () => {
    const prefs = { enabled: false, hour: 18, minute: 0 }
    expect(planReminder(input({ prefs }))).toEqual({ action: 'cancel' })
  })

  it.each(['denied', 'undetermined'] as const)('annule si la permission est %s', (permission) => {
    expect(planReminder(input({ permission }))).toEqual({ action: 'cancel' })
  })

  it.each(['signedOut', 'expired', 'loading'] as const satisfies AuthStatus[])(
    'annule si le statut est %s',
    (status) => {
      expect(planReminder(input({ status }))).toEqual({ action: 'cancel' })
    },
  )
})

describe('planReminder : programmation', () => {
  it("programme à l'heure choisie avec le titre « Quizlet »", () => {
    expect(planReminder(input())).toMatchObject({
      action: 'schedule',
      hour: 18,
      minute: 30,
      title: 'Quizlet',
    })
  })

  it("cite le nombre de cartes (à réviser + nouvelles) d'un résumé récent", () => {
    expect(planReminder(input())).toMatchObject({ body: "5 cartes à réviser aujourd'hui." })
  })

  it('accorde le singulier', () => {
    const summary = { due: 1, new: 0, updatedAt: NOW.getTime() }
    expect(planReminder(input({ summary }))).toMatchObject({
      body: "1 carte à réviser aujourd'hui.",
    })
  })

  it('texte générique si le résumé est périmé', () => {
    const summary = { due: 3, new: 2, updatedAt: NOW.getTime() - 13 * HOUR }
    expect(planReminder(input({ summary }))).toMatchObject({ body: REMINDER_GENERIC_BODY })
  })

  it('limite de 12 h entre le résumé et le déclenchement : 12 h pile est périmé', () => {
    // Rappel à 18:30, soit 6 h 30 après NOW : le résumé peut avoir 5 h 30 au plus.
    const at = (age: number) => ({ due: 4, new: 0, updatedAt: NOW.getTime() - age })
    const toTrigger = 6.5 * HOUR
    expect(planReminder(input({ summary: at(SUMMARY_MAX_AGE_MS - toTrigger) }))).toMatchObject({
      body: REMINDER_GENERIC_BODY,
    })
    expect(planReminder(input({ summary: at(SUMMARY_MAX_AGE_MS - toTrigger - 1) }))).toMatchObject({
      body: "4 cartes à réviser aujourd'hui.",
    })
  })

  describe('le texte est figé : il compte pour le PROCHAIN déclenchement', () => {
    const summary = { due: 3, new: 2, updatedAt: NOW.getTime() }

    it('rappel dans 1 h : le compteur est cité', () => {
      const prefs = { enabled: true, hour: 13, minute: 0 }
      expect(planReminder(input({ prefs, summary }))).toMatchObject({
        body: "5 cartes à réviser aujourd'hui.",
      })
    })

    it('rappel dans 20 h (demain matin) : texte générique, même avec un résumé du jour', () => {
      const prefs = { enabled: true, hour: 8, minute: 0 }
      expect(planReminder(input({ prefs, summary }))).toMatchObject({ body: REMINDER_GENERIC_BODY })
    })

    it("une heure déjà passée aujourd'hui vise demain", () => {
      const prefs = { enabled: true, hour: 11, minute: 59 }
      expect(planReminder(input({ prefs, summary }))).toMatchObject({ body: REMINDER_GENERIC_BODY })
    })
  })

  it('texte générique si le compteur vaut 0', () => {
    const summary = { due: 0, new: 0, updatedAt: NOW.getTime() }
    expect(planReminder(input({ summary }))).toMatchObject({ body: REMINDER_GENERIC_BODY })
  })

  it('texte générique si le résumé est inconnu', () => {
    expect(planReminder(input({ summary: null }))).toMatchObject({ body: REMINDER_GENERIC_BODY })
  })

  it('texte générique si le résumé est daté du futur (horloge reculée)', () => {
    const summary = { due: 3, new: 2, updatedAt: NOW.getTime() + HOUR }
    expect(planReminder(input({ summary }))).toMatchObject({ body: REMINDER_GENERIC_BODY })
  })

  it.each([
    [0, 0],
    [23, 59],
  ])("accepte l'heure limite %i:%i", (hour, minute) => {
    const prefs = { enabled: true, hour, minute }
    expect(planReminder(input({ prefs }))).toMatchObject({ action: 'schedule', hour, minute })
  })

  it('borne les heures et minutes hors plage', () => {
    const prefs = { enabled: true, hour: 24, minute: -1 }
    expect(planReminder(input({ prefs }))).toMatchObject({ hour: 23, minute: 0 })
  })

  it('remplace une heure NaN par le défaut', () => {
    const prefs = { enabled: true, hour: Number.NaN, minute: Number.NaN }
    expect(planReminder(input({ prefs }))).toMatchObject({ hour: 18, minute: 0 })
  })
})

describe('nextTrigger', () => {
  const at = (hour: number, minute: number) => nextTrigger(NOW, hour, minute)

  it("aujourd'hui si l'heure n'est pas passée", () => {
    expect(at(18, 30).getTime()).toBe(new Date(2026, 2, 10, 18, 30).getTime())
  })

  it('demain si elle est passée, ou égale à maintenant', () => {
    expect(at(8, 0).getTime()).toBe(new Date(2026, 2, 11, 8, 0).getTime())
    expect(at(12, 0).getTime()).toBe(new Date(2026, 2, 11, 12, 0).getTime())
  })

  it('ne modifie pas la date reçue', () => {
    const now = new Date(NOW)
    nextTrigger(now, 1, 1)
    expect(now.getTime()).toBe(NOW.getTime())
  })
})
