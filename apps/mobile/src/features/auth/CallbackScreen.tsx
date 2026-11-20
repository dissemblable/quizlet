/**
 * CONTRAT : route `/callback` (cible de `quizlet://callback?…`), sans props, HORS garde d'auth.
 * Lit `code`, `state`, `iss`, `error`, `error_description` (`useLocalSearchParams`), appelle
 * `completeLogin` (idempotent) puis `router.replace(routes.home)` si `signedIn`, sinon
 * `router.replace(routes.login)` (avec le message d'erreur, hors annulation).
 * DOIT tolérer d'être montée SANS paramètres (route ouverte à la main, rechargement) : alors
 * rediriger selon `useAuth().status` (`signedIn` | `expired` → `routes.home`, `signedOut` →
 * `routes.login`, `loading` → attendre) au lieu de rester affichée.
 */
export function CallbackScreen() {
  return null
}
