import type { AuthStatus } from '@/auth/types'
import type { ReminderPrefs } from './prefs'

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

/**
 * CONTRAT : décide quoi programmer (pur, testé). `cancel` si le rappel est désactivé, la permission
 * n'est pas `granted` ou `status !== 'signedIn'`. Sinon `schedule` à l'heure choisie ; le texte cite
 * le nombre de cartes (`due + new`) SEULEMENT si le résumé existe, date de moins de 12 h et que le
 * total est > 0 ; sinon texte générique. Titre : « Quizlet ».
 */
export function planReminder(_input: PlanReminderInput): ReminderPlan {
  throw new Error('non implémenté')
}
