/**
 * CONTRAT : annule le rappel quotidien programmé (`cancelScheduledNotificationAsync('daily-reminder')`)
 * et oublie ses préférences. Appelée à la déconnexion (`onSignedOut` du layout racine). Ne rejette
 * jamais. Fichier exempté de la règle de pureté (`*-adapter.ts`) : c'est là que vit `expo-notifications`.
 * Provisoire : ne fait rien.
 */
export async function cancelReminder(): Promise<void> {}
