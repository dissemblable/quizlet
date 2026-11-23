import { describe, expect, it } from 'vitest'
import { buildAuthorizationUrl, PAR_REJECTED_MESSAGE, pushAuthorizationRequest } from './par'
import { ENDPOINTS, fakeFetch, formOf, jsonResponse, TEST_CONFIG } from './test-kit'

const input = {
  clientId: TEST_CONFIG.clientId,
  scope: TEST_CONFIG.scope,
  audience: TEST_CONFIG.apiUrl,
  resource: TEST_CONFIG.resource,
  redirectUri: TEST_CONFIG.redirectUri,
  codeChallenge: 'challenge',
  state: 'state',
}

describe('pushAuthorizationRequest', () => {
  it('POST form-urlencoded avec tous les champs, renvoie le request_uri', async () => {
    const net = fakeFetch(() =>
      jsonResponse(201, { request_uri: 'urn:ietf:params:oauth:request_uri:x', expires_in: 90 }),
    )
    const requestUri = await pushAuthorizationRequest(
      { fetch: net.fetch, endpoint: ENDPOINTS.parEndpoint },
      input,
    )
    expect(requestUri).toBe('urn:ietf:params:oauth:request_uri:x')
    const call = net.calls[0]
    expect(call?.url).toBe(ENDPOINTS.parEndpoint)
    expect(call?.init?.method).toBe('POST')
    expect(call?.init?.headers).toMatchObject({
      'Content-Type': 'application/x-www-form-urlencoded',
    })
    expect(formOf(call?.init)).toEqual({
      client_id: 'quizlet-mobile',
      response_type: 'code',
      response_mode: 'form_post',
      redirect_uri: 'https://quizlet.example.com/api/mobile/callback',
      scope: 'authelia.bearer.authz offline_access',
      audience: 'https://quizlet.example.com',
      resource: 'https://quizlet.example.com/api',
      code_challenge: 'challenge',
      code_challenge_method: 'S256',
      state: 'state',
    })
  })

  it('refus du serveur ou réponse sans request_uri : message clair', async () => {
    for (const response of [
      jsonResponse(400, { error: 'invalid_request' }),
      jsonResponse(201, {}),
      new Response('<html>', { status: 200 }),
    ]) {
      const net = fakeFetch(() => response)
      await expect(
        pushAuthorizationRequest({ fetch: net.fetch, endpoint: ENDPOINTS.parEndpoint }, input),
      ).rejects.toMatchObject({ message: PAR_REJECTED_MESSAGE })
    }
  })
})

describe('buildAuthorizationUrl', () => {
  it('encode client_id et request_uri', () => {
    expect(
      buildAuthorizationUrl(
        ENDPOINTS.authorizationEndpoint,
        'quizlet-mobile',
        'urn:ietf:params:x y',
      ),
    ).toBe(
      `${ENDPOINTS.authorizationEndpoint}?client_id=quizlet-mobile&request_uri=urn%3Aietf%3Aparams%3Ax%20y`,
    )
    expect(buildAuthorizationUrl('https://a.test/auth?x=1', 'c', 'r')).toBe(
      'https://a.test/auth?x=1&client_id=c&request_uri=r',
    )
  })
})
