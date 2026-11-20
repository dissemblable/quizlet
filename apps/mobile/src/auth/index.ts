/**
 * CONTRAT : barrel du module d'authentification. IMPUR (il ré-exporte un `.tsx`) : les modules purs
 * et les tests importent le fichier précis (`@/auth/types`, `@/auth/status`…), jamais ce barrel.
 */
export { AuthProvider, useAuth } from './AuthProvider'
export { authFetch } from './auth-fetch'
export { completeLogin } from './login'
export { getAuthStatus, subscribeAuthStatus, whenAuthenticated } from './status'
export type { AuthApi, AuthStatus, CallbackParams, LoginResult } from './types'
