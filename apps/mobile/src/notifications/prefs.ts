/** Préférences du rappel quotidien (stockées par `useReminderSync` / `ReminderSection`). */
export interface ReminderPrefs {
  enabled: boolean
  /** 0 à 23, heure locale de l'appareil. */
  hour: number
  /** 0 à 59. */
  minute: number
}

/** Rappel désactivé par défaut (opt-in), 18:00 une fois activé. */
export const DEFAULT_REMINDER_PREFS: ReminderPrefs = { enabled: false, hour: 18, minute: 0 }
