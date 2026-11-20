/** Aides communes aux tests de `src/auth` (Node uniquement : jamais importé par le code de l'app). */
import { createHash, randomBytes } from 'node:crypto'
import type { Endpoints } from './endpoints'
import type { FetchLike } from './http'
import type { SecureKv } from './store'

export const AUTH_URL = 'https://auth.example.com'

export const ENDPOINTS: Endpoints = {
  issuer: AUTH_URL,
  authorizationEndpoint: `${AUTH_URL}/api/oidc/authorization`,
  tokenEndpoint: `${AUTH_URL}/api/oidc/token`,
  parEndpoint: `${AUTH_URL}/api/oidc/pushed-authorization-request`,
  revocationEndpoint: `${AUTH_URL}/api/oidc/revocation`,
}

export const DISCOVERY_DOCUMENT = {
  issuer: AUTH_URL,
  authorization_endpoint: ENDPOINTS.authorizationEndpoint,
  token_endpoint: ENDPOINTS.tokenEndpoint,
  pushed_authorization_request_endpoint: ENDPOINTS.parEndpoint,
  revocation_endpoint: ENDPOINTS.revocationEndpoint,
}

export const TEST_CONFIG = {
  clientId: 'quizlet-mobile',
  scope: 'authelia.bearer.authz offline_access',
  apiUrl: 'https://quizlet.example.com',
  resource: 'https://quizlet.example.com/api',
  redirectUri: 'https://quizlet.example.com/api/mobile/callback',
  callbackUrl: 'quizlet://callback',
}

export function memoryKv(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  const kv: SecureKv = {
    get: async (key) => data.get(key) ?? null,
    set: async (key, value) => {
      data.set(key, value)
    },
    remove: async (key) => {
      data.delete(key)
    },
  }
  return { kv, data }
}

export const nodeRandom = async (count: number) => new Uint8Array(randomBytes(count))
export const nodeSha256 = async (data: Uint8Array) =>
  new Uint8Array(createHash('sha256').update(data).digest())

export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

export const emptyResponse = (status: number) => new Response(null, { status })

/** Champs d'un corps `application/x-www-form-urlencoded`. */
export function formOf(init: RequestInit | undefined): Record<string, string> {
  const fields: Record<string, string> = {}
  for (const pair of String(init?.body ?? '').split('&')) {
    const [key = '', value = ''] = pair.split('=')
    if (key) fields[decodeURIComponent(key)] = decodeURIComponent(value)
  }
  return fields
}

export interface Call {
  url: string
  init: RequestInit | undefined
}

/** `fetch` factice : `handler` répond (ou rejette) ; chaque appel est enregistré. */
export function fakeFetch(handler: (call: Call, index: number) => Response | Promise<Response>) {
  const calls: Call[] = []
  const fetchImpl: FetchLike = async (url, init) => {
    calls.push({ url, init })
    return handler({ url, init }, calls.length - 1)
  }
  return { fetch: fetchImpl, calls }
}

/** Plus de timer réel dans les tests : les attentes injectées se résolvent tout de suite. */
export const noDelay = () => Promise.resolve()
/** Attente qui ne se termine jamais (pour qu'un `Promise.race` n'écourte pas l'opération testée). */
export const neverDelay = () => new Promise<void>(() => {})
