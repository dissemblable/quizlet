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

/** Clé AsyncStorage des préférences (versionnée : un changement de forme passe à `v2`). */
export const REMINDER_PREFS_KEY = 'quizlet.reminder.v1'

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.trunc(value)))
}

/** Rend des préférences valides depuis n'importe quelle valeur : champ par champ, repli sur le défaut. */
export function normalizeReminderPrefs(value: unknown): ReminderPrefs {
  const source: { enabled?: unknown; hour?: unknown; minute?: unknown } =
    typeof value === 'object' && value !== null ? value : {}
  return {
    enabled: source.enabled === true,
    hour: clampInt(source.hour, 0, 23, DEFAULT_REMINDER_PREFS.hour),
    minute: clampInt(source.minute, 0, 59, DEFAULT_REMINDER_PREFS.minute),
  }
}

/** Lecture tolérante du JSON stocké : absent ou corrompu → défauts. */
export function parseReminderPrefs(raw: string | null): ReminderPrefs {
  if (raw === null) return { ...DEFAULT_REMINDER_PREFS }
  try {
    return normalizeReminderPrefs(JSON.parse(raw))
  } catch {
    return { ...DEFAULT_REMINDER_PREFS }
  }
}

export function serializeReminderPrefs(prefs: ReminderPrefs): string {
  return JSON.stringify(normalizeReminderPrefs(prefs))
}

/** « 08:05 ». Pas d'`Intl` (Hermes). */
export function formatReminderTime(hour: number, minute: number): string {
  const { hour: h, minute: m } = normalizeReminderPrefs({ hour, minute })
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}
