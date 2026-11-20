/**
 * Câblage de production : instances uniques de la session, de la connexion et d'`authFetch`, avec
 * les adaptateurs appareil. Aucun test ne l'importe (il tire Expo) : les tests construisent leurs
 * propres instances avec `createSession`, `createLogin`, `createAuthFetch`.
 */
import { config } from '@/config'
import { openAuthSession, randomBytes, secureKv, sha256 } from './adapters'
import { createAuthFetch } from './auth-fetch'
import { createDiscovery } from './endpoints'
import type { FetchLike } from './http'
import { createLogin } from './login'
import { createSession } from './session'
import { authStatusStore } from './status'
import { createAuthStore } from './store'

const now = () => Date.now()
const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
// Appelés à chaque requête (pas capturés) : le `fetch` global reste substituable.
const globalFetch: FetchLike = (input, init) => fetch(input, init)

let signedOutHandler: (() => void | Promise<void>) | undefined

/** Enregistre `onSignedOut` de `AuthProvider` (appelé APRÈS l'effacement des jetons). */
export function setSignedOutHandler(handler: (() => void | Promise<void>) | undefined): void {
  signedOutHandler = handler
}

const store = createAuthStore(secureKv)
const getEndpoints = createDiscovery({ fetch: globalFetch, authUrl: config.authUrl, now })

export const session = createSession({
  store,
  status: authStatusStore,
  getEndpoints,
  fetch: globalFetch,
  clientId: config.clientId,
  now,
  delay,
  onSignedOut: () => signedOutHandler?.(),
})

export const login = createLogin({
  config,
  getEndpoints,
  store,
  session,
  fetch: globalFetch,
  now,
  random: randomBytes,
  sha256,
  openAuthSession,
  delay,
})

export const completeLogin = login.completeLogin

export const authFetch = createAuthFetch({
  session,
  status: authStatusStore,
  fetch: (input, init) => fetch(input, init),
  now,
})
