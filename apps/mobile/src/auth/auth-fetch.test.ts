import { ApiError, NETWORK_ERROR_MESSAGE, SESSION_EXPIRED_MESSAGE } from '@quizlet/shared'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAuthFetch } from './auth-fetch'
import { createSession } from './session'
import { createStatusStore } from './status'
import { createAuthStore, STORE_KEYS } from './store'
import {
  type Call,
  ENDPOINTS,
  emptyResponse,
  fakeFetch,
  jsonResponse,
  memoryKv,
  noDelay,
  TEST_CONFIG,
} from './test-kit'
import type { Tokens } from './tokens'

const NOW = 1_700_000_000_000
const OLD: Tokens = { accessToken: 'at-old', refreshToken: 'rt-old', expiresAt: NOW + 3_600_000 }
const NEW_BODY = { access_token: 'at-new', refresh_token: 'rt-new', expires_in: 3600 }
const API = 'https://quizlet.example.com/api/me'

const redirect = () => new Response(null, { status: 302, headers: { location: '' } })
const unauthorized = () => emptyResponse(401)

interface Options {
  tokens?: Tokens | null
  /** Réponse de l'API selon le jeton Bearer reçu. */
  api?: (token: string, index: number) => Response | Promise<Response>
  token?: (call: Call, index: number) => Response | Promise<Response>
  timeoutMs?: number
  clock?: { now: number }
}

function setup(options: Options = {}) {
  const tokens = options.tokens === undefined ? OLD : options.tokens
  const memory = memoryKv(tokens ? { [STORE_KEYS.tokens]: JSON.stringify(tokens) } : {})
  const status = createStatusStore()
  const clock = options.clock ?? { now: NOW }
  const oidc = fakeFetch((call, index) => {
    if (call.url === ENDPOINTS.tokenEndpoint) {
      return options.token ? options.token(call, index) : jsonResponse(200, NEW_BODY)
    }
    throw new Error(`appel inattendu : ${call.url}`)
  })
  const session = createSession({
    store: createAuthStore(memory.kv),
    status,
    getEndpoints: async () => ENDPOINTS,
    fetch: oidc.fetch,
    clientId: TEST_CONFIG.clientId,
    now: () => clock.now,
    delay: noDelay,
  })
  const apiCalls: { input: unknown; init: RequestInit | undefined; bearer: string | null }[] = []
  const apiFetch = vi.fn<typeof fetch>(async (input, init) => {
    const headers = new Headers(init?.headers)
    const bearer = headers.get('authorization')
    apiCalls.push({ input, init, bearer })
    const token = bearer?.replace('Bearer ', '') ?? ''
    return options.api ? options.api(token, apiCalls.length - 1) : jsonResponse(200, { ok: true })
  })
  const authFetch = createAuthFetch({
    session,
    status,
    fetch: apiFetch,
    now: () => clock.now,
    timeoutMs: options.timeoutMs,
  })
  const refreshCalls = () => oidc.calls.filter((c) => c.url === ENDPOINTS.tokenEndpoint)
  return { memory, status, session, authFetch, apiFetch, apiCalls, refreshCalls, clock }
}

/** Réponse de l'API : 200 pour le jeton neuf, `bad` pour l'ancien. */
const acceptsNewOnly = (bad: () => Response) => (token: string) =>
  token === 'at-new' ? jsonResponse(200, { ok: true }) : bad()

afterEach(() => {
  vi.useRealTimers()
})

describe('requête normale', () => {
  it('ajoute le Bearer, ne suit pas les redirections, garde les en-têtes et le corps', async () => {
    const h = setup()
    const response = await h.authFetch(API, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"a":1}',
    })
    expect(response.status).toBe(200)
    expect(h.apiCalls).toHaveLength(1)
    const call = h.apiCalls[0]
    expect(call?.bearer).toBe('Bearer at-old')
    expect(call?.init?.redirect).toBe('manual')
    expect(call?.init?.method).toBe('POST')
    expect(call?.init?.body).toBe('{"a":1}')
    expect(new Headers(call?.init?.headers).get('content-type')).toBe('application/json')
    expect(call?.init?.signal).toBeInstanceOf(AbortSignal)
    expect(h.refreshCalls()).toHaveLength(0)
  })

  it('attend la lecture du stockage au démarrage (statut loading)', async () => {
    const h = setup()
    expect(h.status.get()).toBe('loading')
    await h.authFetch(API)
    expect(h.status.get()).toBe('signedIn')
    expect(h.apiCalls[0]?.bearer).toBe('Bearer at-old')
  })

  it('une réponse d’erreur ordinaire (404, 500) est rendue telle quelle, sans refresh', async () => {
    for (const status of [400, 403, 404, 500]) {
      const h = setup({ api: () => emptyResponse(status) })
      expect((await h.authFetch(API)).status).toBe(status)
      expect(h.refreshCalls()).toHaveLength(0)
    }
  })
})

describe('302 ou 401 : refresh puis UNE relance', () => {
  it.each([
    ['302', redirect],
    ['401', unauthorized],
    ['307', () => new Response(null, { status: 307 })],
  ])('%s puis succès avec le jeton neuf', async (_name, bad) => {
    const h = setup({ api: acceptsNewOnly(bad) })
    const response = await h.authFetch(API)
    expect(response.status).toBe(200)
    expect(h.apiCalls.map((c) => c.bearer)).toEqual(['Bearer at-old', 'Bearer at-new'])
    expect(h.refreshCalls()).toHaveLength(1)
    expect(h.status.get()).toBe('signedIn')
  })

  it('304 (requête conditionnelle) n’est pas un refus : rendu tel quel, sans refresh', async () => {
    const h = setup({ api: () => new Response(null, { status: 304 }) })
    expect((await h.authFetch(API)).status).toBe(304)
    expect(h.refreshCalls()).toHaveLength(0)
    expect(h.status.get()).toBe('signedIn')
  })

  it('refresh mort : SESSION_EXPIRED, statut expired, pas de relance', async () => {
    const h = setup({
      api: () => redirect(),
      token: () => jsonResponse(400, { error: 'invalid_grant' }),
    })
    const error = await h.authFetch(API).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({
      status: 401,
      code: 'SESSION_EXPIRED',
      message: SESSION_EXPIRED_MESSAGE,
    })
    expect(h.status.get()).toBe('expired')
    expect(h.apiCalls).toHaveLength(1)
  })

  it('jeton neuf refusé aussi : expired, jamais de boucle (2 requêtes, 1 refresh)', async () => {
    const h = setup({ api: () => redirect() })
    const error = await h.authFetch(API).catch((e: unknown) => e)
    expect(error).toMatchObject({ code: 'SESSION_EXPIRED' })
    expect(h.status.get()).toBe('expired')
    expect(h.apiCalls).toHaveLength(2)
    expect(h.refreshCalls()).toHaveLength(1)
  })

  it('refresh en panne passagère : NETWORK_ERROR, JAMAIS la bannière, jetons gardés', async () => {
    const h = setup({ api: () => redirect(), token: () => emptyResponse(503) })
    const error = await h.authFetch(API).catch((e: unknown) => e)
    expect(error).toMatchObject({
      status: 0,
      code: 'NETWORK_ERROR',
      message: NETWORK_ERROR_MESSAGE,
    })
    expect(h.status.get()).toBe('signedIn')
    expect(h.session.getTokens()).toEqual(OLD)
  })

  it('N requêtes refusées en même temps : un seul refresh, toutes réussissent', async () => {
    const h = setup({ api: acceptsNewOnly(redirect) })
    const responses = await Promise.all([h.authFetch(API), h.authFetch(API), h.authFetch(API)])
    expect(responses.map((r) => r.status)).toEqual([200, 200, 200])
    expect(h.refreshCalls()).toHaveLength(1)
  })

  it('requête partie avec un jeton que quelqu’un a déjà remplacé : pas de second refresh', async () => {
    const h = setup({ api: acceptsNewOnly(redirect) })
    await h.session.init()
    let release: () => void = () => {}
    const gate = new Promise<void>((resolve) => (release = resolve))
    const slow = vi.fn<typeof fetch>(async (_input, init) => {
      const token = new Headers(init?.headers).get('authorization')
      await gate
      return token === 'Bearer at-new' ? jsonResponse(200, {}) : redirect()
    })
    const slowFetch = createAuthFetch({
      session: h.session,
      status: h.status,
      fetch: slow,
      now: () => NOW,
    })
    const pending = slowFetch(API) // part avec at-old, bloquée
    await new Promise((resolve) => setTimeout(resolve, 0))
    await h.session.refresh('at-old') // une autre requête a déjà fait le refresh
    release()
    expect((await pending).status).toBe(200)
    expect(h.refreshCalls()).toHaveLength(1)
  })
})

describe('erreurs réseau', () => {
  it('fetch qui échoue : NETWORK_ERROR, statut et jetons intacts, aucun refresh', async () => {
    const h = setup({
      api: () => {
        throw new TypeError('Network request failed')
      },
    })
    const error = await h.authFetch(API).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({
      status: 0,
      code: 'NETWORK_ERROR',
      message: NETWORK_ERROR_MESSAGE,
    })
    expect(h.status.get()).toBe('signedIn')
    expect(h.refreshCalls()).toHaveLength(0)
  })

  it('délai de 20 s dépassé : NETWORK_ERROR', async () => {
    vi.useFakeTimers()
    const h = setup()
    const hanging = createAuthFetch({
      session: h.session,
      status: h.status,
      fetch: (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          )
        }),
      now: () => NOW,
    })
    const outcome = hanging(API).catch((e: unknown) => e)
    await vi.advanceTimersByTimeAsync(19_999)
    let settled = false
    void outcome.then(() => {
      settled = true
    })
    await vi.advanceTimersByTimeAsync(0)
    expect(settled).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(await outcome).toMatchObject({ code: 'NETWORK_ERROR' })
    expect(h.status.get()).toBe('signedIn')
  })

  it('annulation voulue par l’appelant : l’erreur d’origine, pas NETWORK_ERROR', async () => {
    const controller = new AbortController()
    const h = setup()
    const aborting = createAuthFetch({
      session: h.session,
      status: h.status,
      fetch: (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          )
        }),
      now: () => NOW,
    })
    const outcome = aborting(API, { signal: controller.signal }).catch((e: unknown) => e)
    await new Promise((resolve) => setTimeout(resolve, 0))
    controller.abort()
    const error = await outcome
    expect(error).toBeInstanceOf(DOMException)
    expect(error).toMatchObject({ name: 'AbortError' })
  })
})

describe('modes de session', () => {
  it('expired : court-circuite, aucune requête ni vers l’API ni vers Authelia', async () => {
    const h = setup({ api: () => redirect(), token: () => jsonResponse(400, {}) })
    await h.authFetch(API).catch(() => {}) // passe en expired
    expect(h.status.get()).toBe('expired')
    const apiBefore = h.apiCalls.length
    const refreshBefore = h.refreshCalls().length

    for (let i = 0; i < 3; i++) {
      const error = await h.authFetch(API).catch((e: unknown) => e)
      expect(error).toMatchObject({ code: 'SESSION_EXPIRED' })
    }
    expect(h.apiCalls).toHaveLength(apiBefore)
    expect(h.refreshCalls()).toHaveLength(refreshBefore)
  })

  it('expired avec des jetons encore en mémoire : court-circuite quand même (aucun appel)', async () => {
    const h = setup()
    await h.session.init()
    h.status.markExpired()
    expect(h.status.get()).toBe('expired')
    expect(h.session.getTokens()).toEqual(OLD)

    const error = await h.authFetch(API).catch((e: unknown) => e)
    expect(error).toMatchObject({ code: 'SESSION_EXPIRED' })
    expect(h.apiCalls).toHaveLength(0)
    expect(h.refreshCalls()).toHaveLength(0)
  })

  it('déconnecté : SESSION_EXPIRED sans requête, le statut n’est PAS modifié', async () => {
    const h = setup({ tokens: null })
    const error = await h.authFetch(API).catch((e: unknown) => e)
    expect(error).toMatchObject({ code: 'SESSION_EXPIRED' })
    expect(h.apiCalls).toHaveLength(0)
    expect(h.status.get()).toBe('signedOut')
  })

  it('après une re-connexion, les requêtes repartent', async () => {
    const h = setup({ api: acceptsNewOnly(redirect), token: () => jsonResponse(400, {}) })
    await h.authFetch(API).catch(() => {})
    expect(h.status.get()).toBe('expired')
    await h.session.startSession({
      accessToken: 'at-new',
      refreshToken: 'rt-2',
      expiresAt: NOW + 1e6,
    })
    expect(h.status.get()).toBe('signedIn')
    expect((await h.authFetch(API)).status).toBe(200)
  })
})

describe('marge de 60 s avant expiration', () => {
  it('jeton presque expiré : refresh AVANT la requête, une seule requête vers l’API', async () => {
    const h = setup({ tokens: { ...OLD, expiresAt: NOW + 30_000 } })
    await h.authFetch(API)
    expect(h.refreshCalls()).toHaveLength(1)
    expect(h.apiCalls.map((c) => c.bearer)).toEqual(['Bearer at-new'])
  })

  it('jeton encore valable au-delà de la marge : pas de refresh', async () => {
    const h = setup({ tokens: { ...OLD, expiresAt: NOW + 61_000 } })
    await h.authFetch(API)
    expect(h.refreshCalls()).toHaveLength(0)
  })

  it('refresh préventif mort : SESSION_EXPIRED sans requête vers l’API', async () => {
    const h = setup({
      tokens: { ...OLD, expiresAt: NOW - 1 },
      token: () => jsonResponse(400, { error: 'invalid_grant' }),
    })
    const error = await h.authFetch(API).catch((e: unknown) => e)
    expect(error).toMatchObject({ code: 'SESSION_EXPIRED' })
    expect(h.apiCalls).toHaveLength(0)
    expect(h.status.get()).toBe('expired')
  })

  it('refresh préventif en panne passagère : la requête part quand même avec le jeton courant', async () => {
    const h = setup({
      tokens: { ...OLD, expiresAt: NOW + 30_000 },
      token: () => emptyResponse(503),
    })
    expect((await h.authFetch(API)).status).toBe(200)
    expect(h.apiCalls.map((c) => c.bearer)).toEqual(['Bearer at-old'])
    expect(h.status.get()).toBe('signedIn')
  })
})

describe('entrée de type Request', () => {
  it('chaque tentative repart d’un clone : le corps est relu à la relance', async () => {
    const bodies: string[] = []
    const h = setup({ api: acceptsNewOnly(redirect) })
    const withBodies = createAuthFetch({
      session: h.session,
      status: h.status,
      fetch: async (input, init) => {
        const request = input as Request
        bodies.push(await request.text())
        const token = new Headers(init?.headers).get('authorization')
        return token === 'Bearer at-new' ? jsonResponse(200, {}) : redirect()
      },
      now: () => NOW,
    })
    const request = new Request(API, {
      method: 'POST',
      body: 'corps',
      headers: { 'x-test': '1' },
    })
    expect((await withBodies(request)).status).toBe(200)
    expect(bodies).toEqual(['corps', 'corps'])
  })
})
