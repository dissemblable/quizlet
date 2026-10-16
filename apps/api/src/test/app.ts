import type { HttpBindings } from '@hono/node-server'
import { type AppDeps, createApp } from '../app'
import type { Db } from '../db/client'
import type { Config } from '../env'
import { TEST_DATABASE_URL } from './test-db'

/** IP du « reverse proxy » dans les tests (seule adresse de confiance par défaut). */
export const PROXY_IP = '10.0.0.2'
export const APP_ORIGIN = 'https://quizlet.test'

export function testConfig(overrides: Partial<Config> = {}): Config {
  return {
    nodeEnv: 'test',
    host: '127.0.0.1',
    port: 0,
    databaseUrl: TEST_DATABASE_URL,
    migrateOnStart: false,
    trustedProxies: [PROXY_IP],
    appOrigins: [APP_ORIGIN],
    corsOrigins: [],
    logoutUrl: 'https://auth.example.test/logout',
    anthropicApiKey: null,
    devIdentity: null,
    ...overrides,
  }
}

/** Simule le socket TCP vu par @hono/node-server (lu par getConnInfo). */
export function socketFrom(remoteAddress: string): HttpBindings {
  const remoteFamily = remoteAddress.includes(':') ? 'IPv6' : 'IPv4'
  return { incoming: { socket: { remoteAddress, remoteFamily } } } as unknown as HttpBindings
}

/** En-têtes tels que nginx les transmet après validation par Authelia. */
export function ssoHeaders(username: string, extra: Record<string, string> = {}) {
  return {
    'remote-user': username,
    'remote-name': username.charAt(0).toUpperCase() + username.slice(1),
    'remote-email': `${username}@example.test`,
    'remote-groups': 'users',
    ...extra,
  }
}

interface RequestOptions {
  method?: string
  /** Utilisateur SSO à simuler ; omis = aucune identité. */
  as?: string
  body?: unknown
  /** Corps multipart (le navigateur fixe lui-même son Content-Type). */
  form?: FormData
  headers?: Record<string, string>
  /** Adresse du pair TCP ; par défaut le proxy de confiance. */
  from?: string
}

/** App de test branchée sur la base de test, avec un helper de requête « derrière nginx ». */
export function createTestClient(
  db: Db,
  overrides: Partial<Config> = {},
  { now, generator }: Pick<AppDeps, 'now' | 'generator'> = {},
) {
  const app = createApp({ db, config: testConfig(overrides), now, generator })

  function request(path: string, options: RequestOptions = {}) {
    const headers: Record<string, string> = {
      ...(options.as ? ssoHeaders(options.as) : {}),
      ...(options.body !== undefined ? { 'content-type': 'application/json' } : {}),
      // Le front est servi sur la même origine que l'API.
      ...(options.method && options.method !== 'GET' ? { 'sec-fetch-site': 'same-origin' } : {}),
      ...options.headers,
    }
    return app.request(
      path,
      {
        method: options.method ?? 'GET',
        headers,
        body:
          options.form ?? (options.body !== undefined ? JSON.stringify(options.body) : undefined),
      },
      socketFrom(options.from ?? PROXY_IP),
    )
  }

  return { app, request }
}

/** Corps de réponse de GET /api/me, pour typer les assertions des tests. */
export interface MeBody {
  user: { id: string; username: string; displayName: string; email: string | null }
  logoutUrl: string | null
  aiEnabled: boolean
}

export function readJson<T>(res: Response): Promise<T> {
  return res.json() as Promise<T>
}
