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
/**
 * Au-delà, le compteur est jugé trop vieux pour être cité. Mesuré entre le dernier résumé et le
 * PROCHAIN déclenchement (le texte est figé à la programmation : c'est ce que la personne lira).
 */
export const SUMMARY_MAX_AGE_MS = 12 * 60 * 60 * 1000

/**
 * Prochain déclenchement d'un rappel quotidien à `hour:minute` (heure locale) : aujourd'hui si
 * l'instant n'est pas passé, sinon demain. Un instant égal à `now` compte comme passé.
 */
export function nextTrigger(now: Date, hour: number, minute: number): Date {
  const next = new Date(now)
  next.setHours(hour, minute, 0, 0)
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1)
  return next
}

/**
 * CONTRAT : décide quoi programmer (pur, testé). `cancel` si le rappel est désactivé, la permission
 * n'est pas `granted` ou `status !== 'signedIn'`. Sinon `schedule` à l'heure choisie ; le texte cite
 * le nombre de cartes (`due + new`) SEULEMENT si le résumé existe, n'est pas daté du futur, que le
 * PROCHAIN déclenchement a lieu moins de 12 h après sa date (un rappel dans 20 h citerait un
 * compteur vieux de plus de 20 h) et que le total est > 0 ; sinon texte générique. Le déclencheur
 * quotidien répète ce texte tel quel jusqu'à la prochaine reprogrammation (`useReminderSync`, à
 * chaque nouveau résumé). Titre : « Quizlet ».
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
  const usable = summary !== null && summary.updatedAt <= now.getTime()
  const ageAtTrigger = usable
    ? nextTrigger(now, hour, minute).getTime() - summary.updatedAt
    : Number.POSITIVE_INFINITY
  const total = summary === null ? 0 : summary.due + summary.new
  const body =
    ageAtTrigger < SUMMARY_MAX_AGE_MS && total > 0
      ? `${pluralize(total, 'carte')} à réviser aujourd'hui.`
      : REMINDER_GENERIC_BODY

  return { action: 'schedule', hour, minute, title: REMINDER_TITLE, body }
}
