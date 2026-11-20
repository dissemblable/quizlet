/**
 * CONTRAT : `fetch` authentifié, passé à `hc<AppType>` (`@/lib/api`).
 * - ajoute `Authorization: Bearer <jeton>` (marge de 60 s avant l'expiration, timeout 20 s) ;
 * - `redirect: 'manual'` ; 302 ou 401 → un refresh partagé, UNE relance, puis `SESSION_EXPIRED` ;
 * - erreur réseau → `ApiError` `NETWORK_ERROR` (`NETWORK_ERROR_MESSAGE` de `@quizlet/shared`),
 *   jamais la bannière « session expirée » ;
 * - en mode `expired`, court-circuite et lève `SESSION_EXPIRED` (`SESSION_EXPIRED_MESSAGE`).
 * Version provisoire : simple passe-plat.
 */
export const authFetch: typeof fetch = (input, init) => fetch(input, init)
