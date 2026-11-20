import { AuthFlowError, type FetchLike, isRecord, postForm, readJson } from './http'

export const PAR_REJECTED_MESSAGE =
  "Le serveur d'authentification a refusé la demande de connexion."

export interface ParInput {
  clientId: string
  scope: string
  /** Origine de l'API (`config.apiUrl`). */
  audience: string
  /** `<api>/api` : Authelia compare `resource` à l'URL de la requête (voir docs/app-mobile.md). */
  resource: string
  /** URL https du relais de l'API, jamais `quizlet://`. */
  redirectUri: string
  codeChallenge: string
  state: string
}

/** Pushed Authorization Request (RFC 9126) : renvoie le `request_uri` à passer à l'autorisation. */
export async function pushAuthorizationRequest(
  deps: { fetch: FetchLike; endpoint: string; timeoutMs?: number },
  input: ParInput,
): Promise<string> {
  const response = await postForm(
    deps.fetch,
    deps.endpoint,
    {
      client_id: input.clientId,
      response_type: 'code',
      response_mode: 'form_post',
      redirect_uri: input.redirectUri,
      scope: input.scope,
      audience: input.audience,
      resource: input.resource,
      code_challenge: input.codeChallenge,
      code_challenge_method: 'S256',
      state: input.state,
    },
    deps.timeoutMs,
  )
  const body = await readJson(response)
  const requestUri = isRecord(body) ? body.request_uri : undefined
  // Authelia répond 201 ; la RFC n'interdit pas 200.
  if ((response.status !== 201 && response.status !== 200) || typeof requestUri !== 'string') {
    throw new AuthFlowError(PAR_REJECTED_MESSAGE)
  }
  return requestUri
}

/** URL à ouvrir dans le Custom Tab : seuls `client_id` et `request_uri` voyagent dans la barre d'adresse. */
export function buildAuthorizationUrl(
  authorizationEndpoint: string,
  clientId: string,
  requestUri: string,
): string {
  const separator = authorizationEndpoint.includes('?') ? '&' : '?'
  return `${authorizationEndpoint}${separator}client_id=${encodeURIComponent(clientId)}&request_uri=${encodeURIComponent(requestUri)}`
}
