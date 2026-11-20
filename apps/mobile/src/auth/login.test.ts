import { describe, expect, it } from 'vitest'
import { AuthFlowError } from './http'
import { type BrowserResult, createLogin, MESSAGES } from './login'
import { challengeFor } from './pkce'
import { createSession } from './session'
import { createStatusStore } from './status'
import { createAuthStore, PENDING_TTL_MS, STORE_KEYS } from './store'
import {
  type Call,
  ENDPOINTS,
  emptyResponse,
  fakeFetch,
  formOf,
  jsonResponse,
  memoryKv,
  noDelay,
  nodeRandom,
  nodeSha256,
  TEST_CONFIG,
} from './test-kit'

const REQUEST_URI = 'urn:ietf:params:oauth:request_uri:abc'
const TOKEN_BODY = { access_token: 'at-1', refresh_token: 'rt-1', expires_in: 3600 }
const NOW = 1_700_000_000_000

interface Options {
  /** Réponse du endpoint token. */
  token?: (call: Call) => Response | Promise<Response>
  par?: (call: Call) => Response | Promise<Response>
  getEndpoints?: () => Promise<typeof ENDPOINTS>
  open?: (url: string, context: OpenContext) => Promise<BrowserResult>
  kv?: ReturnType<typeof memoryKv>
}

/** Ce que le faux Custom Tab peut consulter pour fabriquer son résultat. */
interface OpenContext {
  memory: ReturnType<typeof memoryKv>
  stateSent(): string
  callbackUrl(query: string): string
}

function setup(options: Options = {}) {
  const memory = options.kv ?? memoryKv()
  const store = createAuthStore(memory.kv)
  const status = createStatusStore()
  const clock = { now: NOW }
  const net = fakeFetch((call) => {
    if (call.url === ENDPOINTS.parEndpoint) {
      return options.par?.(call) ?? jsonResponse(201, { request_uri: REQUEST_URI, expires_in: 90 })
    }
    if (call.url === ENDPOINTS.tokenEndpoint) {
      return options.token?.(call) ?? jsonResponse(200, TOKEN_BODY)
    }
    throw new Error(`appel inattendu : ${call.url}`)
  })
  const getEndpoints = options.getEndpoints ?? (async () => ENDPOINTS)
  const session = createSession({
    store,
    status,
    getEndpoints,
    fetch: net.fetch,
    clientId: TEST_CONFIG.clientId,
    now: () => clock.now,
    delay: noDelay,
  })
  // Délai de grâce piloté à la main : `fireGrace()` le fait expirer.
  const graceTimers: (() => void)[] = []
  const opened: string[] = []
  const harness = {
    memory,
    store,
    status,
    clock,
    net,
    session,
    opened,
    fireGrace: () => {
      for (const fire of graceTimers.splice(0)) fire()
    },
    login: undefined as unknown as ReturnType<typeof createLogin>,
    /** `state` envoyé dans le PAR. */
    stateSent: () =>
      formOf(net.calls.find((c) => c.url === ENDPOINTS.parEndpoint)?.init).state ?? '',
    tokenCalls: () => net.calls.filter((c) => c.url === ENDPOINTS.tokenEndpoint),
    callbackUrl: (query: string) => `quizlet://callback?${query}`,
  }
  harness.login = createLogin({
    config: TEST_CONFIG,
    getEndpoints,
    store,
    session,
    fetch: net.fetch,
    now: () => clock.now,
    random: nodeRandom,
    sha256: nodeSha256,
    openAuthSession: async (url) => {
      opened.push(url)
      return options.open ? options.open(url, harness) : { type: 'dismiss' }
    },
    delay: () => new Promise<void>((resolve) => graceTimers.push(resolve)),
  })
  return harness
}

/** Ouvre le Custom Tab, le callback arrive dans la valeur de retour (chemin `success`). */
const succeedWith =
  (extra = '') =>
  async (_url: string, h: OpenContext): Promise<BrowserResult> => ({
    type: 'success',
    url: h.callbackUrl(`code=code-1&state=${h.stateSent()}${extra}`),
  })

describe('connexion réussie', () => {
  it('PKCE + PAR, Custom Tab, échange du code avec le redirect_uri https, jetons stockés', async () => {
    const pendingWhenOpened: string[] = []
    const h = setup({
      open: async (url, harness) => {
        pendingWhenOpened.push(harness.memory.data.get(STORE_KEYS.pending) ?? '')
        return succeedWith(`&iss=${encodeURIComponent(ENDPOINTS.issuer)}`)(url, harness)
      },
    })

    expect(await h.login.startLogin()).toEqual({ kind: 'signedIn' })

    // PAR : le challenge est celui du verifier gardé dans le pending.
    const par = formOf(h.net.calls[0]?.init)
    expect(par.client_id).toBe('quizlet-mobile')
    expect(par.redirect_uri).toBe('https://quizlet.example.com/api/mobile/callback')
    expect(par.state).toMatch(/^[0-9a-f]{32}$/)

    // Le pending est écrit AVANT l'ouverture du navigateur.
    const pending = JSON.parse(pendingWhenOpened[0] ?? 'null')
    expect(pending.state).toBe(par.state)
    expect(await challengeFor(pending.verifier, nodeSha256)).toBe(par.code_challenge)

    expect(h.opened).toEqual([
      `${ENDPOINTS.authorizationEndpoint}?client_id=quizlet-mobile&request_uri=${encodeURIComponent(REQUEST_URI)}`,
    ])

    // Échange : redirect_uri https (pas quizlet://), verifier d'origine.
    expect(h.tokenCalls()).toHaveLength(1)
    expect(formOf(h.tokenCalls()[0]?.init)).toEqual({
      grant_type: 'authorization_code',
      client_id: 'quizlet-mobile',
      code: 'code-1',
      redirect_uri: 'https://quizlet.example.com/api/mobile/callback',
      code_verifier: pending.verifier,
    })

    expect(h.status.get()).toBe('signedIn')
    expect(h.session.getTokens()).toEqual({
      accessToken: 'at-1',
      refreshToken: 'rt-1',
      expiresAt: NOW + 3600 * 1000,
    })
    expect(await h.store.readTokens()).toEqual(h.session.getTokens())
    // Le pending est consommé.
    expect(h.memory.data.has(STORE_KEYS.pending)).toBe(false)
  })

  it('avancement : opening puis exchanging puis idle', async () => {
    const phases: string[] = []
    const h = setup({ open: succeedWith() })
    h.login.phase.subscribe((phase) => phases.push(phase))
    expect(h.login.phase.get()).toBe('idle')
    await h.login.startLogin()
    expect(phases).toEqual(['opening', 'exchanging', 'idle'])
  })

  it('un iss avec « / » final est accepté ; un iss absent aussi', async () => {
    const withSlash = setup({
      open: succeedWith(`&iss=${encodeURIComponent(`${ENDPOINTS.issuer}/`)}`),
    })
    expect((await withSlash.login.startLogin()).kind).toBe('signedIn')
    const without = setup({ open: succeedWith() })
    expect((await without.login.startLogin()).kind).toBe('signedIn')
  })

  it('démarrage à froid : le callback est traité par une autre instance, avec le pending du stockage', async () => {
    const kv = memoryKv()
    const first = setup({ kv, open: async () => ({ type: 'dismiss' }) })
    const started = first.login.startLogin()
    await Promise.resolve()
    await new Promise((resolve) => setTimeout(resolve, 0))
    const state = first.stateSent()
    first.fireGrace()
    expect(await started).toEqual({ kind: 'cancelled' })

    // L'app a été tuée : nouvelle instance, même stockage.
    const second = setup({ kv })
    expect(await second.login.completeLogin({ code: 'code-9', state })).toEqual({
      kind: 'signedIn',
    })
    expect(second.status.get()).toBe('signedIn')
  })
})

describe('callback invalide', () => {
  it('state inconnu : erreur, aucun échange, la connexion en cours reste valable', async () => {
    const h = setup()
    const started = h.login.startLogin()
    await new Promise((resolve) => setTimeout(resolve, 0))
    const state = h.stateSent()

    expect(await h.login.completeLogin({ code: 'x', state: 'ffff' })).toEqual({
      kind: 'error',
      message: MESSAGES.stateMismatch,
    })
    expect(h.tokenCalls()).toHaveLength(0)
    expect(h.memory.data.has(STORE_KEYS.pending)).toBe(true)

    // Le vrai callback aboutit encore.
    expect(await h.login.completeLogin({ code: 'x', state })).toEqual({ kind: 'signedIn' })
    expect(await started).toEqual({ kind: 'signedIn' })
  })

  it('iss différent : erreur, aucun échange, connexion abandonnée', async () => {
    const h = setup({ open: succeedWith('&iss=https%3A%2F%2Fevil.example.com') })
    expect(await h.login.startLogin()).toEqual({ kind: 'error', message: MESSAGES.issuer })
    expect(h.tokenCalls()).toHaveLength(0)
    expect(h.status.get()).toBe('signedOut')
    expect(h.memory.data.has(STORE_KEYS.pending)).toBe(false)
  })

  it('code ou state manquant : erreur', async () => {
    const h = setup()
    expect(await h.login.completeLogin({ state: 's' })).toEqual({
      kind: 'error',
      message: MESSAGES.invalid,
    })
    expect(await h.login.completeLogin({ code: 'c' })).toEqual({
      kind: 'error',
      message: MESSAGES.invalid,
    })
    expect(await h.login.completeLogin({})).toEqual({ kind: 'error', message: MESSAGES.invalid })
  })

  it('aucune connexion en cours : « expirée »', async () => {
    const h = setup()
    expect(await h.login.completeLogin({ code: 'c', state: 's' })).toEqual({
      kind: 'error',
      message: MESSAGES.expired,
    })
  })

  it('pending périmé (TTL 15 min) : erreur, rien n’est échangé', async () => {
    const h = setup()
    const started = h.login.startLogin()
    await new Promise((resolve) => setTimeout(resolve, 0))
    const state = h.stateSent()
    h.clock.now += PENDING_TTL_MS + 1
    expect(await h.login.completeLogin({ code: 'c', state })).toEqual({
      kind: 'error',
      message: MESSAGES.expired,
    })
    expect(h.tokenCalls()).toHaveLength(0)
    h.fireGrace()
    await started
  })
})

describe('erreur renvoyée par le portail ou le relais', () => {
  it('state valide : le détail est affiché, la connexion est consommée', async () => {
    const h = setup()
    const started = h.login.startLogin()
    await new Promise((resolve) => setTimeout(resolve, 0))
    const state = h.stateSent()
    const result = await h.login.completeLogin({
      error: 'server_error',
      error_description: 'Le portail est en panne',
      state,
    })
    expect(result).toEqual({
      kind: 'error',
      message: 'La connexion a échoué : Le portail est en panne',
    })
    expect(h.memory.data.has(STORE_KEYS.pending)).toBe(false)
    expect(h.tokenCalls()).toHaveLength(0)
    h.fireGrace()
    await started
  })

  it('access_denied : message dédié', async () => {
    const h = setup()
    const started = h.login.startLogin()
    await new Promise((resolve) => setTimeout(resolve, 0))
    const result = await h.login.completeLogin({ error: 'access_denied', state: h.stateSent() })
    expect(result).toEqual({ kind: 'error', message: MESSAGES.denied })
    h.fireGrace()
    await started
  })

  it('invalid_request du relais (sans state) : message générique, la connexion en cours est gardée', async () => {
    const h = setup()
    const started = h.login.startLogin()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(
      await h.login.completeLogin({
        error: 'invalid_request',
        error_description: 'Appelez le 0123',
      }),
    ).toEqual({ kind: 'error', message: MESSAGES.invalid })
    expect(h.memory.data.has(STORE_KEYS.pending)).toBe(true)
    h.fireGrace()
    await started
  })

  it('un state étranger ne fait pas afficher la description (lien malveillant)', async () => {
    const h = setup()
    const result = await h.login.completeLogin({
      error: 'x',
      error_description: 'Appelez le 0123',
      state: 'pas-le-bon',
    })
    expect(result).toEqual({ kind: 'error', message: MESSAGES.invalid })
  })
})

describe('annulation', () => {
  it('Custom Tab fermé sans callback : « annulée » après le délai de grâce', async () => {
    const h = setup({ open: async () => ({ type: 'dismiss' }) })
    const started = h.login.startLogin()
    await new Promise((resolve) => setTimeout(resolve, 0))
    h.fireGrace()
    expect(await started).toEqual({ kind: 'cancelled' })
    expect(h.tokenCalls()).toHaveLength(0)
    expect(h.status.get()).toBe('signedOut')
  })

  it('`cancel` : même chemin', async () => {
    const h = setup({ open: async () => ({ type: 'cancel' }) })
    const started = h.login.startLogin()
    await new Promise((resolve) => setTimeout(resolve, 0))
    h.fireGrace()
    expect(await started).toEqual({ kind: 'cancelled' })
  })

  it('`dismiss` PUIS callback par la route /callback dans le délai de grâce : connecté', async () => {
    const h = setup({ open: async () => ({ type: 'dismiss' }) })
    const started = h.login.startLogin()
    await new Promise((resolve) => setTimeout(resolve, 0))
    // Le callback arrive par un autre chemin (route, écouteur Linking).
    const viaRoute = h.login.completeLogin({ code: 'code-1', state: h.stateSent() })
    expect(await started).toEqual({ kind: 'signedIn' })
    expect(await viaRoute).toEqual({ kind: 'signedIn' })
    expect(h.tokenCalls()).toHaveLength(1)
  })

  it('le délai de grâce ne coupe pas un échange déjà commencé', async () => {
    let releaseToken: (response: Response) => void = () => {}
    const h = setup({
      open: async () => ({ type: 'dismiss' }),
      token: () => new Promise<Response>((resolve) => (releaseToken = resolve)),
    })
    const started = h.login.startLogin()
    await new Promise((resolve) => setTimeout(resolve, 0))
    const exchange = h.login.completeLogin({ code: 'c', state: h.stateSent() })
    await new Promise((resolve) => setTimeout(resolve, 0))
    h.fireGrace()
    releaseToken(jsonResponse(200, TOKEN_BODY))
    expect(await started).toEqual({ kind: 'signedIn' })
    expect(await exchange).toEqual({ kind: 'signedIn' })
  })
})

describe('idempotence', () => {
  it('deux completeLogin simultanés avec le même state : UN seul échange', async () => {
    const h = setup()
    const started = h.login.startLogin()
    await new Promise((resolve) => setTimeout(resolve, 0))
    const state = h.stateSent()
    const [a, b, c] = await Promise.all([
      h.login.completeLogin({ code: 'c', state }),
      h.login.completeLogin({ code: 'c', state }),
      h.login.completeLogin({ code: 'c', state, iss: ENDPOINTS.issuer }),
    ])
    expect([a, b, c]).toEqual([{ kind: 'signedIn' }, { kind: 'signedIn' }, { kind: 'signedIn' }])
    expect(h.tokenCalls()).toHaveLength(1)
    await started
  })

  it('un appel tardif, après la fin de l’échange, reçoit le même résultat (pas « expirée »)', async () => {
    const h = setup()
    const started = h.login.startLogin()
    await new Promise((resolve) => setTimeout(resolve, 0))
    const state = h.stateSent()
    expect(await h.login.completeLogin({ code: 'c', state })).toEqual({ kind: 'signedIn' })
    expect(await h.login.completeLogin({ code: 'c', state })).toEqual({ kind: 'signedIn' })
    expect(h.tokenCalls()).toHaveLength(1)
    await started
  })

  it('double appui sur « Se connecter » : un seul parcours', async () => {
    const h = setup({ open: succeedWith() })
    const [a, b] = await Promise.all([h.login.startLogin(), h.login.startLogin()])
    expect(a).toEqual(b)
    expect(h.opened).toHaveLength(1)
  })
})

describe('échecs', () => {
  it('PAR refusé : erreur, pending effacé, navigateur jamais ouvert', async () => {
    const h = setup({ par: () => jsonResponse(400, { error: 'invalid_request' }) })
    const result = await h.login.startLogin()
    expect(result.kind).toBe('error')
    expect(h.opened).toHaveLength(0)
    expect(h.memory.data.has(STORE_KEYS.pending)).toBe(false)
  })

  it('PAR injoignable : message réseau', async () => {
    const h = setup({
      par: () => {
        throw new TypeError('Network request failed')
      },
    })
    expect(await h.login.startLogin()).toEqual({ kind: 'error', message: MESSAGES.network })
    expect(h.opened).toHaveLength(0)
  })

  it('découverte en échec : erreur, rien d’écrit, rien d’ouvert', async () => {
    const h = setup({
      getEndpoints: async () => {
        throw new AuthFlowError('Découverte KO')
      },
    })
    expect(await h.login.startLogin()).toEqual({ kind: 'error', message: 'Découverte KO' })
    expect(h.memory.data.size).toBe(0)
    expect(h.net.calls).toHaveLength(0)
  })

  it('« WebBrowser is already open » : erreur claire, pending effacé', async () => {
    const h = setup({
      open: async () => {
        throw new Error('WebBrowser is already open, only one can be open at a time')
      },
    })
    expect(await h.login.startLogin()).toEqual({ kind: 'error', message: MESSAGES.alreadyOpen })
    expect(h.memory.data.has(STORE_KEYS.pending)).toBe(false)
  })

  it('navigateur impossible à ouvrir : erreur', async () => {
    const h = setup({
      open: async () => {
        throw new Error('No browser')
      },
    })
    expect(await h.login.startLogin()).toEqual({ kind: 'error', message: MESSAGES.browser })
  })

  it('échange refusé : 400 = code invalide, autre statut = échec, réseau, réponse sans jeton', async () => {
    const cases: [() => Response | never, string][] = [
      [() => jsonResponse(400, { error: 'invalid_grant' }), MESSAGES.codeRejected],
      [() => emptyResponse(503), MESSAGES.exchange],
      [() => jsonResponse(200, { access_token: 'at' }), MESSAGES.tokens],
      [
        () => {
          throw new TypeError('Network request failed')
        },
        MESSAGES.network,
      ],
    ]
    for (const [token, message] of cases) {
      const h = setup({ token, open: succeedWith() })
      expect(await h.login.startLogin()).toEqual({ kind: 'error', message })
      expect(h.status.get()).toBe('signedOut')
      expect(await h.store.readTokens()).toBeNull()
    }
  })

  it('jetons impossibles à enregistrer : erreur, jamais « connecté »', async () => {
    const memory = memoryKv()
    const realSet = memory.kv.set
    memory.kv.set = async (key, value) => {
      if (key === STORE_KEYS.tokens) throw new Error('Keystore indisponible')
      return realSet(key, value)
    }
    const h = setup({ kv: memory, open: succeedWith() })
    const result = await h.login.startLogin()
    expect(result.kind).toBe('error')
    expect(h.status.get()).toBe('signedOut')
  })
})

describe('re-connexion depuis la session expirée', () => {
  it('passe de expired à signedIn avec de nouveaux jetons', async () => {
    const h = setup({ open: succeedWith() })
    await h.session.init()
    h.status.markSignedIn()
    h.status.markExpired()
    expect(h.status.get()).toBe('expired')
    expect(await h.login.startLogin()).toEqual({ kind: 'signedIn' })
    expect(h.status.get()).toBe('signedIn')
  })
})
