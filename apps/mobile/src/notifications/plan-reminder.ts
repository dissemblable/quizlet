import { pluralize } from '@quizlet/shared'
import type { AuthStatus } from '@/auth/types'
import { normalizeReminderPrefs, type ReminderPrefs } from './prefs'

export type ReminderPermission = 'granted' | 'denied' | 'undetermined'

/** Dernier résumé de révision connu. */
export interface ReminderSummary {
  due: number
  new: number
  /** Horodatage (ms depuis l'epoch) de la dernière synchronisation (`dataUpdatedAt`). */
  updatedAt: number
}

export interface PlanReminderInput {
  prefs: ReminderPrefs
  permission: ReminderPermission
  status: AuthStatus
  /** `null` : jamais synchronisé. */
  summary: ReminderSummary | null
  now: Date
}

export type ReminderPlan =
  | { action: 'cancel' }
  | { action: 'schedule'; hour: number; minute: number; title: string; body: string }

export const REMINDER_TITLE = 'Quizlet'
export const REMINDER_GENERIC_BODY = "C'est l'heure de réviser vos cartes."
/** Au-delà, le compteur est jugé trop vieux pour être cité (le contenu est figé à la programmation). */
export const SUMMARY_MAX_AGE_MS = 12 * 60 * 60 * 1000

/**
 * CONTRAT : décide quoi programmer (pur, testé). `cancel` si le rappel est désactivé, la permission
 * n'est pas `granted` ou `status !== 'signedIn'`. Sinon `schedule` à l'heure choisie ; le texte cite
 * le nombre de cartes (`due + new`) SEULEMENT si le résumé existe, date de moins de 12 h et que le
 * total est > 0 ; sinon texte générique. Titre : « Quizlet ».
 */
export function planReminder({
  prefs,
  permission,
  status,
  summary,
  now,
}: PlanReminderInput): ReminderPlan {
  const { enabled, hour, minute } = normalizeReminderPrefs(prefs)
  if (!enabled || permission !== 'granted' || status !== 'signedIn') return { action: 'cancel' }

  // Un résumé daté du futur (horloge reculée) n'est pas fiable : texte générique.
  const age = summary === null ? Number.POSITIVE_INFINITY : now.getTime() - summary.updatedAt
  const total = summary === null ? 0 : summary.due + summary.new
  const body =
    age >= 0 && age < SUMMARY_MAX_AGE_MS && total > 0
      ? `${pluralize(total, 'carte')} à réviser aujourd'hui.`
      : REMINDER_GENERIC_BODY

  return { action: 'schedule', hour, minute, title: REMINDER_TITLE, body }
}
