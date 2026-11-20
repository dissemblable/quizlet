/**
 * CONTRAT : monté dans le layout racine (dans `AuthProvider` et `AppQueryProvider`). Reprogramme le
 * rappel (`planReminder`) au démarrage, au changement de préférences, de résumé, de statut
 * d'authentification et au retour au premier plan. Le contenu d'une notification est figé à la
 * programmation, d'où ces reprogrammations. Ne demande jamais la permission (c'est `ReminderSection`).
 */
export function useReminderSync(): void {}
