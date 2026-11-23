import { describe, expect, it } from 'vitest'
import { createTestClient, PROXY_IP, socketFrom, ssoHeaders } from '../test/app'
import { useTestDb } from '../test/test-db'

const db = useTestDb()

/** Origine du `logoutUrl` de test (`https://auth.example.test/logout`) : le portail Authelia. */
const PORTAL = 'https://auth.example.test'
const CALLBACK = '/api/mobile/callback'
const INVALID = 'quizlet://callback?error=invalid_request'

interface PostOptions {
  path?: string
  /** Corps déjà encodé ; par défaut les champs, encodés comme le fait un navigateur. */
  body?: string
  headers?: Record<string, string>
  /** Utilisateur SSO ; `null` = aucune identité. */
  as?: string | null
  from?: string
  logoutUrl?: string | null
}

/**
 * POST tel que l'envoie le formulaire auto-soumis du portail. Appelle `app.request` directement :
 * `createTestClient().request` ajoute `sec-fetch-site: same-origin` à tout POST et masquerait la
 * garde CSRF.
 */
function postForm(fields: Record<string, string>, options: PostOptions = {}) {
  const logoutUrl = options.logoutUrl === undefined ? `${PORTAL}/logout` : options.logoutUrl
  const { app } = createTestClient(db, { logoutUrl })
  const as = options.as === undefined ? 'alice' : options.as
  return app.request(
    options.path ?? CALLBACK,
    {
      method: 'POST',
      headers: {
        ...(as ? ssoHeaders(as) : {}),
        'content-type': 'application/x-www-form-urlencoded',
        'sec-fetch-site': 'same-site',
        origin: PORTAL,
        ...options.headers,
      },
      body: options.body ?? new URLSearchParams(fields).toString(),
    },
    socketFrom(options.from ?? PROXY_IP),
  )
}

const location = (res: Response) => res.headers.get('location')

describe('relais mobile (POST /api/mobile/callback)', () => {
  it('redirige vers l’app avec le code et le state', async () => {
    const res = await postForm({ code: 'abc', state: 'xyz' })
    expect(res.status).toBe(302)
    expect(location(res)).toBe('quizlet://callback?code=abc&state=xyz')
    expect(await res.text()).toBe('')
    expect(res.headers.get('cache-control')).toBe('no-store')
  })

  it('transmet iss, dans un ordre fixe (code, state, iss) quel que soit celui du formulaire', async () => {
    const res = await postForm({ iss: 'https://auth.example.test', state: 's', code: 'c' })
    expect(location(res)).toBe(
      'quizlet://callback?code=c&state=s&iss=https%3A%2F%2Fauth.example.test',
    )
  })

  it('encode chaque valeur avec encodeURIComponent (espace en %20, pas +)', async () => {
    const code = 'a+b/c=d&e f'
    const state = 'é ü?#'
    const res = await postForm({ code, state })
    const target = location(res) ?? ''
    expect(target).toBe('quizlet://callback?code=a%2Bb%2Fc%3Dd%26e%20f&state=%C3%A9%20%C3%BC%3F%23')
    // L'app retrouve les valeurs d'origine.
    const { searchParams } = new URL(target)
    expect(searchParams.get('code')).toBe(code)
    expect(searchParams.get('state')).toBe(state)
  })

  it('relaie une erreur du portail, avec son state', async () => {
    const res = await postForm({
      error_description: 'The resource owner denied the request.',
      error: 'access_denied',
      state: 'xyz',
    })
    expect(res.status).toBe(302)
    expect(location(res)).toBe(
      'quizlet://callback?state=xyz&error=access_denied&error_description=The%20resource%20owner%20denied%20the%20request.',
    )
  })

  it('accepte error seul', async () => {
    expect(location(await postForm({ error: 'server_error' }))).toBe(
      'quizlet://callback?error=server_error',
    )
  })

  it('ignore les champs hors liste', async () => {
    const res = await postForm({
      code: 'c',
      state: 's',
      redirect_uri: 'https://evil.example/',
      scope: 'authelia.bearer.authz',
      id_token: 'x',
    })
    expect(location(res)).toBe('quizlet://callback?code=c&state=s')
  })

  it('renvoie error=invalid_request (en 302, jamais du JSON) quand code ou state manque', async () => {
    const incomplete: Array<Record<string, string>> = [
      {},
      { code: 'c' },
      { state: 's' },
      { iss: 'https://auth.example.test' },
      { code: '', state: 's' },
      { code: 'c', state: '' },
      { error_description: 'sans error', state: 's' },
      { error: '' },
    ]
    for (const fields of incomplete) {
      const res = await postForm(fields)
      expect(res.status, JSON.stringify(fields)).toBe(302)
      // Rien d'autre n'est relayé, pas même un code sans state.
      expect(location(res), JSON.stringify(fields)).toBe(INVALID)
    }
  })

  it('refuse (302 invalid_request) une valeur de plus de 2048 caractères', async () => {
    const ok = await postForm({ code: 'c'.repeat(2048), state: 's' })
    expect(location(ok)).toBe(`quizlet://callback?code=${'c'.repeat(2048)}&state=s`)
    expect(location(await postForm({ code: 'c'.repeat(2049), state: 's' }))).toBe(INVALID)
    expect(location(await postForm({ error: 'e'.repeat(2049) }))).toBe(INVALID)
  })

  it('redirige aussi quand le corps est illisible ou d’un autre type', async () => {
    const jsonBody = JSON.stringify({ code: 'c', state: 's' })
    const unreadable: PostOptions[] = [
      { body: '' },
      { body: jsonBody, headers: { 'content-type': 'application/json' } },
      { body: 'code=c&state=s', headers: { 'content-type': 'text/plain' } },
      { body: '--x\r\n', headers: { 'content-type': 'multipart/form-data; boundary=x' } },
      { body: '%', headers: { 'content-type': 'application/x-www-form-urlencoded' } },
    ]
    for (const options of unreadable) {
      const res = await postForm({}, options)
      expect(res.status, JSON.stringify(options)).toBe(302)
      expect(location(res), JSON.stringify(options)).toBe(INVALID)
    }
  })

  it('refuse (403 CSRF_REJECTED) une autre origine que celle du portail', async () => {
    const rejected: Array<Record<string, string>> = [
      { origin: 'https://evil.example' },
      { origin: 'https://evil.example', 'sec-fetch-site': 'cross-site' },
      { origin: 'https://quizlet.example.test' },
    ]
    for (const headers of rejected) {
      const res = await postForm({ code: 'c', state: 's' }, { headers })
      expect(res.status, JSON.stringify(headers)).toBe(403)
      expect(await res.json()).toMatchObject({ error: { code: 'CSRF_REJECTED' } })
    }
  })

  it('n’accorde aucune exception à l’origine du portail sur un autre chemin', async () => {
    for (const path of [
      '/api/sets',
      '/api/review/cards/00000000-0000-4000-8000-000000000000',
      '/api/settings',
      '/api/mobile/callback/',
      '/api/mobile/callbackx',
    ]) {
      const res = await postForm({ code: 'c', state: 's' }, { path })
      expect(res.status, path).toBe(403)
      expect(await res.json(), path).toMatchObject({ error: { code: 'CSRF_REJECTED' } })
    }
  })

  it('accepte Origin: null (portail avec Referrer-Policy: no-referrer) sur le relais seulement', async () => {
    const headers = { origin: 'null' }
    const res = await postForm({ code: 'c', state: 's' }, { headers })
    expect(res.status).toBe(302)
    const other = await postForm({ code: 'c', state: 's' }, { path: '/api/sets', headers })
    expect(other.status).toBe(403)
  })

  it('n’accorde aucune exception sans portail configuré (AUTH_LOGOUT_URL absente)', async () => {
    const res = await postForm({ code: 'c', state: 's' }, { logoutUrl: null })
    expect(res.status).toBe(403)
    expect(await res.json()).toMatchObject({ error: { code: 'CSRF_REJECTED' } })
  })

  it('déduit l’origine du portail de AUTH_LOGOUT_URL : port compris, chemin et requête exclus', async () => {
    const logoutUrl =
      'https://auth.example.test:9091/logout?rd=https%3A%2F%2Fquizlet.example.test%2F'
    const fields = { code: 'c', state: 's' }
    const withPort = { logoutUrl, headers: { origin: 'https://auth.example.test:9091' } }
    expect((await postForm(fields, withPort)).status).toBe(302)
    expect((await postForm(fields, { logoutUrl, headers: { origin: PORTAL } })).status).toBe(403)
  })

  it('passe après identity : 401 sans identité, 403 si le pair TCP n’est pas un proxy de confiance', async () => {
    const anonymous = await postForm({ code: 'c', state: 's' }, { as: null })
    expect(anonymous.status).toBe(401)
    expect(await anonymous.json()).toMatchObject({ error: { code: 'UNAUTHENTICATED' } })

    const untrusted = await postForm({ code: 'c', state: 's' }, { from: '203.0.113.9' })
    expect(untrusted.status).toBe(403)
    expect(await untrusted.json()).toMatchObject({ error: { code: 'UNTRUSTED_PROXY' } })
  })

  it('ne répond qu’au POST : GET donne 404', async () => {
    const { app } = createTestClient(db)
    const res = await app.request(CALLBACK, { headers: ssoHeaders('alice') }, socketFrom(PROXY_IP))
    expect(res.status).toBe(404)
    expect(await res.json()).toMatchObject({ error: { code: 'NOT_FOUND' } })
  })
})
