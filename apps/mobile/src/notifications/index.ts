/**
 * CONTRAT : barrel des notifications. IMPUR (il ré-exporte des `.tsx`) : les modules purs et les
 * tests importent le fichier précis (`@/notifications/prefs`, `@/notifications/plan-reminder`).
 */
export { NotificationTapHandler } from './NotificationTapHandler'
export {
  type PlanReminderInput,
  planReminder,
  type ReminderPermission,
  type ReminderPlan,
  type ReminderSummary,
} from './plan-reminder'
export { DEFAULT_REMINDER_PREFS, type ReminderPrefs } from './prefs'
export { ReminderSection } from './ReminderSection'
export { cancelReminder } from './reminder-adapter'
export { useReminderSync } from './use-reminder-sync'
