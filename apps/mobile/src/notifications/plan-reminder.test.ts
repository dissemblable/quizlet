import { describe, expect, it } from 'vitest'
import type { AuthStatus } from '@/auth/types'
import {
  type PlanReminderInput,
  planReminder,
  REMINDER_GENERIC_BODY,
  SUMMARY_MAX_AGE_MS,
} from './plan-reminder'

const NOW = new Date('2026-03-10T12:00:00Z')
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

  it('limite de 12 h : 12 h pile est périmé, 1 ms de moins est récent', () => {
    const at = (age: number) => ({ due: 4, new: 0, updatedAt: NOW.getTime() - age })
    expect(planReminder(input({ summary: at(SUMMARY_MAX_AGE_MS) }))).toMatchObject({
      body: REMINDER_GENERIC_BODY,
    })
    expect(planReminder(input({ summary: at(SUMMARY_MAX_AGE_MS - 1) }))).toMatchObject({
      body: "4 cartes à réviser aujourd'hui.",
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
