/**
 * CONTRAT : écran de connexion (`/login`), sans props, SANS en-tête (`Screen edges` avec `'top'`).
 * Passif : il est monté derrière le splash pendant `loading` (la garde `signedOut` inclut `loading`),
 * donc AUCUN effet de bord au montage (pas de connexion automatique). Bouton → `useAuth().signIn()`.
 */
export function LoginScreen() {
  return null
}
