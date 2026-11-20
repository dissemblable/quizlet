/**
 * CONTRAT : monté dans le layout racine, APRÈS le `Stack` (le navigateur existe). Au toucher d'une
 * notification (`useLastNotificationResponse` à froid + écouteur à chaud), navigue vers
 * `data.route` (`/review`) si l'état est `signedIn`, une seule fois par réponse. Rend `null`.
 */
export function NotificationTapHandler() {
  return null
}
