/**
 * CONTRAT : barrel du module d'authentification. IMPUR (il ré-exporte un `.tsx` et le câblage de
 * production) : les modules purs et les tests importent le fichier précis (`@/auth/types`,
 * `@/auth/status`…), jamais ce barrel.
 * `completeLogin` et `authFetch` sont les instances de `runtime.ts` (les fabriques pures sont dans
 * `login.ts` et `auth-fetch.ts`).
 */
export { AuthProvider, useAuth, useLoginPhase } from './AuthProvider'
export type { LoginPhase } from './login'
export { authFetch, completeLogin } from './runtime'
export { getAuthStatus, subscribeAuthStatus, whenAuthenticated } from './status'
export type { AuthApi, AuthStatus, CallbackParams, LoginResult } from './types'
