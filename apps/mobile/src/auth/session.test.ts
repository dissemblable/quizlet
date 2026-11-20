import { describe, expect, it, vi } from 'vitest'
import { createSession, type RefreshResult } from './session'
import { createStatusStore } from './status'
import { createAuthStore, STORE_KEYS } from './store'
import {
  type Call,
  ENDPOINTS,
  emptyResponse,
  fakeFetch,
  formOf,
  jsonResponse,
  memoryKv,
  neverDelay,
  noDelay,
  TEST_CONFIG,
} from './test-kit'
import type { Tokens } from './tokens'

const NOW = 1_700_000_000_000
const OLD: Tokens = { accessToken: 'at-old', refreshToken: 'rt-old', expiresAt: NOW + 3_600_000 }
const NEW_BODY = { access_token: 'at-new', refresh_token: 'rt-new', expires_in: 3600 }

interface Options {
  tokens?: Tokens | null
  token?: (call: Call, index: number) => Response | Promise<Response>
  revoke?: (call: Call) => Response | Promise<Response>
  delay?: (ms: number) => Promise<void>
  onSignedOut?: () => void | Promise<void>
  memory?: ReturnType<typeof memoryKv>
}

function setup(options: Options = {}) {
  const tokens = options.tokens === undefined ? OLD : options.tokens
  const memory =
    options.memory ?? memoryKv(tokens ? { [STORE_KEYS.tokens]: JSON.stringify(tokens) } : {})
  const store = createAuthStore(memory.kv)
  const status = createStatusStore()
  let tokenIndex = 0
  const net = fakeFetch((call) => {
    if (call.url === ENDPOINTS.tokenEndpoint) {
      return options.token ? options.token(call, tokenIndex++) : jsonResponse(200, NEW_BODY)
    }
    if (call.url === ENDPOINTS.revocationEndpoint) {
      return options.revoke ? options.revoke(call) : emptyResponse(200)
    }
    throw new Error(`appel inattendu : ${call.url}`)
  })
  const delay = vi.fn(options.delay ?? noDelay)
  const session = createSession({
    store,
    status,
    getEndpoints: async () => ENDPOINTS,
    fetch: net.fetch,
    clientId: TEST_CONFIG.clientId,
    now: () => NOW,
    delay,
    onSignedOut: options.onSignedOut,
  })
  const refreshCalls = () => net.calls.filter((c) => c.url === ENDPOINTS.tokenEndpoint)
  const revokeCalls = () => net.calls.filter((c) => c.url === ENDPOINTS.revocationEndpoint)
  return { memory, store, status, net, session, delay, refreshCalls, revokeCalls }
}

const networkDown = () => {
  throw new TypeError('Network request failed')
}

describe('démarrage', () => {
  it('jetons présents : signedIn ; absents : signedOut ; aucun appel réseau', async () => {
    const a = setup()
    expect(a.status.get()).toBe('loading')
    await a.session.init()
    expect(a.status.get()).toBe('signedIn')
    expect(a.session.getTokens()).toEqual(OLD)
    expect(a.net.calls).toHaveLength(0)

    const b = setup({ tokens: null })
    await b.session.init()
    expect(b.status.get()).toBe('signedOut')
    expect(b.session.getTokens()).toBeNull()
  })

  it('stockage corrompu : signedOut, entrée supprimée, jamais de rejet', async () => {
    const memory = memoryKv({ [STORE_KEYS.tokens]: '{"accessToken":"at"' })
    const h = setup({ memory })
    await h.session.init()
    expect(h.status.get()).toBe('signedOut')
    expect(memory.data.has(STORE_KEYS.tokens)).toBe(false)
  })

  it('un seul accès au stockage, même si init est appelé plusieurs fois', async () => {
    const memory = memoryKv({ [STORE_KEYS.tokens]: JSON.stringify(OLD) })
    const get = vi.spyOn(memory.kv, 'get')
    const h = setup({ memory })
    await Promise.all([h.session.init(), h.session.init(), h.session.init()])
    expect(get).toHaveBeenCalledTimes(1)
  })

  it('une connexion terminée pendant la lecture du stockage n’est pas écrasée', async () => {
    const memory = memoryKv()
    let release: () => void = () => {}
    const realGet = memory.kv.get
    memory.kv.get = (key) => new Promise((resolve) => (release = () => resolve(realGet(key))))
    const h = setup({ memory, tokens: null })
    const init = h.session.init()
    h.status.markSignedIn() // /callback a fini avant la lecture
    release()
    await init
    expect(h.status.get()).toBe('signedIn')
  })
})

describe('refresh partagé', () => {
  it('N appels simultanés : UNE requête, même résultat, jetons écrits AVANT la réponse', async () => {
    const memory = memoryKv({ [STORE_KEYS.tokens]: JSON.stringify(OLD) })
    const realSet = memory.kv.set
    // Écriture lente : si `refresh` résolvait avant, le stockage serait encore à l'ancien jeton.
    memory.kv.set = async (key, value) => {
      await new Promise((resolve) => setTimeout(resolve, 10))
      return realSet(key, value)
    }
    const h = setup({ memory })
    await h.session.init()

    const results = await Promise.all([
      h.session.refresh('at-old'),
      h.session.refresh('at-old'),
      h.session.refresh('at-old'),
    ])
    expect(h.refreshCalls()).toHaveLength(1)
    const expected: RefreshResult = {
      kind: 'ok',
      tokens: { accessToken: 'at-new', refreshToken: 'rt-new', expiresAt: NOW + 3_600_000 },
    }
    expect(results).toEqual([expected, expected, expected])
    expect(JSON.parse(memory.data.get(STORE_KEYS.tokens) ?? '{}').refreshToken).toBe('rt-new')
    expect(h.session.getTokens()).toEqual(expected.tokens)
    expect(formOf(h.refreshCalls()[0]?.init)).toEqual({
      grant_type: 'refresh_token',
      client_id: 'quizlet-mobile',
      refresh_token: 'rt-old',
    })
  })

  it('jeton déjà remplacé par un autre refresh : aucune requête, on rend le jeton courant', async () => {
    const h = setup()
    await h.session.init()
    await h.session.refresh('at-old')
    expect(h.refreshCalls()).toHaveLength(1)
    // Une requête partie avec l'ancien jeton échoue après coup : pas de second refresh.
    const late = await h.session.refresh('at-old')
    expect(late).toMatchObject({ kind: 'ok', tokens: { accessToken: 'at-new' } })
    expect(h.refreshCalls()).toHaveLength(1)
  })

  it('refresh token absent de la réponse : on garde le précédent', async () => {
    const h = setup({ token: () => jsonResponse(200, { access_token: 'at-new', expires_in: 60 }) })
    await h.session.init()
    expect(await h.session.refresh('at-old')).toMatchObject({
      kind: 'ok',
      tokens: { refreshToken: 'rt-old' },
    })
  })

  it('sans session : mort, sans requête', async () => {
    const h = setup({ tokens: null })
    await h.session.init()
    expect(await h.session.refresh('x')).toEqual({ kind: 'dead' })
    expect(h.net.calls).toHaveLength(0)
    expect(h.status.get()).toBe('signedOut')
  })
})

describe('échecs du refresh', () => {
  it('400 invalid_grant : session morte, statut expired, jetons effacés', async () => {
    const h = setup({ token: () => jsonResponse(400, { error: 'invalid_grant' }) })
    await h.session.init()
    expect(await h.session.refresh('at-old')).toEqual({ kind: 'dead' })
    expect(h.status.get()).toBe('expired')
    expect(h.session.getTokens()).toBeNull()
    expect(h.memory.data.has(STORE_KEYS.tokens)).toBe(false)
    expect(h.refreshCalls()).toHaveLength(1)
  })

  it('un autre 4xx est définitif aussi', async () => {
    const h = setup({ token: () => emptyResponse(403) })
    await h.session.init()
    expect(await h.session.refresh('at-old')).toEqual({ kind: 'dead' })
    expect(h.status.get()).toBe('expired')
  })

  it('un 500 puis un 200 : UN nouvel essai suffit', async () => {
    const h = setup({
      token: (_call, index) => (index === 0 ? emptyResponse(500) : jsonResponse(200, NEW_BODY)),
    })
    await h.session.init()
    expect(await h.session.refresh('at-old')).toMatchObject({ kind: 'ok' })
    expect(h.refreshCalls()).toHaveLength(2)
    expect(h.status.get()).toBe('signedIn')
  })

  it('un 500 puis un 500 : mort (jeton révoqué côté Authelia)', async () => {
    const h = setup({ token: () => jsonResponse(500, { error: 'server_error' }) })
    await h.session.init()
    expect(await h.session.refresh('at-old')).toEqual({ kind: 'dead' })
    expect(h.refreshCalls()).toHaveLength(2)
    expect(h.status.get()).toBe('expired')
  })

  it('un 500 puis un 502 : passager', async () => {
    const h = setup({
      token: (_call, index) => emptyResponse(index === 0 ? 500 : 502),
    })
    await h.session.init()
    expect(await h.session.refresh('at-old')).toEqual({ kind: 'transient' })
    expect(h.status.get()).toBe('signedIn')
  })

  it('429, 502, 503, 504, 408, 520 : passager, jetons conservés, aucune bannière', async () => {
    for (const status of [429, 502, 503, 504, 408, 520]) {
      const h = setup({ token: () => emptyResponse(status) })
      await h.session.init()
      expect(await h.session.refresh('at-old'), String(status)).toEqual({ kind: 'transient' })
      expect(h.status.get()).toBe('signedIn')
      expect(h.session.getTokens()).toEqual(OLD)
      expect(h.memory.data.has(STORE_KEYS.tokens)).toBe(true)
      expect(h.refreshCalls()).toHaveLength(1)
    }
  })

  it('réseau coupé, délai dépassé, réponse inutilisable : passager', async () => {
    const down = setup({ token: networkDown })
    await down.session.init()
    expect(await down.session.refresh('at-old')).toEqual({ kind: 'transient' })
    expect(down.status.get()).toBe('signedIn')

    const html = setup({ token: () => new Response('<html>Just a moment</html>', { status: 200 }) })
    await html.session.init()
    expect(await html.session.refresh('at-old')).toEqual({ kind: 'transient' })
    expect(html.session.getTokens()).toEqual(OLD)
  })

  it('après une panne passagère, le refresh suivant réessaie', async () => {
    const h = setup({
      token: (_call, index) => (index === 0 ? emptyResponse(503) : jsonResponse(200, NEW_BODY)),
    })
    await h.session.init()
    expect(await h.session.refresh('at-old')).toEqual({ kind: 'transient' })
    expect(await h.session.refresh('at-old')).toMatchObject({ kind: 'ok' })
  })

  it('markExpired : seulement pour le jeton courant, et seulement depuis signedIn', async () => {
    const h = setup()
    await h.session.init()
    h.session.markExpired('un-autre-jeton')
    expect(h.status.get()).toBe('signedIn')
    h.session.markExpired('at-old')
    expect(h.status.get()).toBe('expired')
    expect(h.session.getTokens()).toBeNull()
  })

  it('la mort de la session n’appelle JAMAIS onSignedOut (la file de notes doit survivre)', async () => {
    const onSignedOut = vi.fn()
    const h = setup({ token: () => jsonResponse(400, {}), onSignedOut })
    await h.session.init()
    await h.session.refresh('at-old')
    expect(h.status.get()).toBe('expired')
    expect(onSignedOut).not.toHaveBeenCalled()
  })
})

describe('déconnexion pendant un refresh', () => {
  it('le résultat est jeté, la session ne ressuscite pas, le jeton neuf est révoqué', async () => {
    let release: (response: Response) => void = () => {}
    const h = setup({ token: () => new Promise<Response>((resolve) => (release = resolve)) })
    await h.session.init()
    const refreshing = h.session.refresh('at-old')
    await new Promise((resolve) => setTimeout(resolve, 0))
    await h.session.signOut()
    release(jsonResponse(200, NEW_BODY))
    expect(await refreshing).toEqual({ kind: 'dead' })
    expect(h.status.get()).toBe('signedOut')
    expect(h.session.getTokens()).toBeNull()
    expect(h.memory.data.has(STORE_KEYS.tokens)).toBe(false)
    await vi.waitFor(() => expect(h.revokeCalls()).toHaveLength(2))
    expect(formOf(h.revokeCalls()[1]?.init).token).toBe('rt-new')
  })
})

describe('déconnexion', () => {
  it('révoque le refresh token, efface les jetons, appelle onSignedOut APRÈS, puis signedOut', async () => {
    const order: string[] = []
    const memory = memoryKv({ [STORE_KEYS.tokens]: JSON.stringify(OLD) })
    const h = setup({
      memory,
      onSignedOut: () => {
        order.push(
          `onSignedOut (jetons : ${memory.data.has(STORE_KEYS.tokens) ? 'présents' : 'effacés'})`,
        )
      },
    })
    h.status.subscribe((status) => order.push(`statut ${status}`))
    await h.session.init()
    order.length = 0

    await h.session.signOut()

    expect(formOf(h.revokeCalls()[0]?.init)).toEqual({
      client_id: 'quizlet-mobile',
      token: 'rt-old',
    })
    expect(order).toEqual(['onSignedOut (jetons : effacés)', 'statut signedOut'])
    expect(h.status.get()).toBe('signedOut')
    expect(h.session.getTokens()).toBeNull()
    expect(memory.data.has(STORE_KEYS.tokens)).toBe(false)
    expect(memory.data.has(STORE_KEYS.revoke)).toBe(false)
  })

  it('révocation en échec (réseau, 503, 429) : le jeton reste dans revoke.v1, déconnecté quand même', async () => {
    for (const revoke of [networkDown, () => emptyResponse(503), () => emptyResponse(429)]) {
      const h = setup({ revoke })
      await h.session.init()
      await h.session.signOut()
      expect(h.memory.data.get(STORE_KEYS.revoke)).toBe('rt-old')
      expect(h.memory.data.has(STORE_KEYS.tokens)).toBe(false)
      expect(h.status.get()).toBe('signedOut')
    }
  })

  it('refus définitif (400) : rien à réessayer, revoke.v1 libéré', async () => {
    const h = setup({ revoke: () => jsonResponse(400, { error: 'invalid_request' }) })
    await h.session.init()
    await h.session.signOut()
    expect(h.memory.data.has(STORE_KEYS.revoke)).toBe(false)
  })

  it('hors ligne, la déconnexion n’attend pas la fin de la révocation', async () => {
    let timeoutElapsed: () => void = () => {}
    const h = setup({
      revoke: () => new Promise<Response>(() => {}),
      delay: () => new Promise<void>((resolve) => (timeoutElapsed = resolve)),
    })
    await h.session.init()
    const done = h.session.signOut()
    await new Promise((resolve) => setTimeout(resolve, 0))
    timeoutElapsed()
    await done
    expect(h.status.get()).toBe('signedOut')
    expect(h.memory.data.get(STORE_KEYS.revoke)).toBe('rt-old')
  })

  it('onSignedOut qui lève : la déconnexion aboutit', async () => {
    const h = setup({
      onSignedOut: () => {
        throw new Error('purge impossible')
      },
    })
    await h.session.init()
    await h.session.signOut()
    expect(h.status.get()).toBe('signedOut')
  })

  it('deux déconnexions simultanées : une seule révocation', async () => {
    const h = setup()
    await h.session.init()
    await Promise.all([h.session.signOut(), h.session.signOut()])
    expect(h.revokeCalls()).toHaveLength(1)
  })

  it('efface aussi une connexion commencée (pending)', async () => {
    const memory = memoryKv({
      [STORE_KEYS.tokens]: JSON.stringify(OLD),
      [STORE_KEYS.pending]: JSON.stringify({ state: 's', verifier: 'v', createdAt: NOW }),
    })
    const h = setup({ memory })
    await h.session.init()
    await h.session.signOut()
    expect(memory.data.has(STORE_KEYS.pending)).toBe(false)
  })

  it('depuis la session expirée : se déconnecte sans rien à révoquer', async () => {
    const onSignedOut = vi.fn()
    const h = setup({ token: () => jsonResponse(400, {}), onSignedOut })
    await h.session.init()
    await h.session.refresh('at-old')
    await h.session.signOut()
    expect(h.status.get()).toBe('signedOut')
    expect(onSignedOut).toHaveBeenCalledTimes(1)
    expect(h.revokeCalls()).toHaveLength(0)
  })
})

describe('révocation en attente', () => {
  it('réessayée au démarrage : libérée sur 200, conservée sur échec', async () => {
    const memory = memoryKv({ [STORE_KEYS.revoke]: 'rt-à-révoquer' })
    const ok = setup({ memory, tokens: null })
    await ok.session.retryPendingRevocation()
    expect(formOf(ok.revokeCalls()[0]?.init).token).toBe('rt-à-révoquer')
    expect(memory.data.has(STORE_KEYS.revoke)).toBe(false)

    const failing = setup({
      memory: memoryKv({ [STORE_KEYS.revoke]: 'rt-à-révoquer' }),
      tokens: null,
      revoke: networkDown,
    })
    await failing.session.retryPendingRevocation()
    expect(failing.memory.data.get(STORE_KEYS.revoke)).toBe('rt-à-révoquer')
  })

  it('rien en attente : aucune requête', async () => {
    const h = setup({ tokens: null })
    await h.session.retryPendingRevocation()
    expect(h.net.calls).toHaveLength(0)
  })
})

describe('délais injectés', () => {
  it('le second essai après un 500 passe par `delay` (aucun timer réel)', async () => {
    const h = setup({
      delay: neverDelay,
      token: (_call, index) => (index === 0 ? emptyResponse(500) : jsonResponse(200, NEW_BODY)),
    })
    await h.session.init()
    void h.session.refresh('at-old')
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(h.delay).toHaveBeenCalledTimes(1)
    expect(h.refreshCalls()).toHaveLength(1)
  })
})
