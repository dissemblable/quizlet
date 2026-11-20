import {
  AuthFlowError,
  type FetchLike,
  fetchWithTimeout,
  httpsOrigin,
  isRecord,
  NetworkFailure,
  readJson,
  stripTrailingSlashes,
} from './http'

export const DISCOVERY_TTL_MS = 60 * 60 * 1000

export const DISCOVERY_NETWORK_MESSAGE =
  "Impossible de joindre le serveur d'authentification. Vérifiez votre connexion."
export const DISCOVERY_INVALID_MESSAGE =
  "Le serveur d'authentification a renvoyé une configuration invalide."

export interface Endpoints {
  issuer: string
  authorizationEndpoint: string
  tokenEndpoint: string
  parEndpoint: string
  /** Facultatif : sans lui, la déconnexion n'est que locale. */
  revocationEndpoint: string | null
}

/**
 * Valide la réponse de découverte. Chaque endpoint doit être en https et sur l'origine du portail
 * (`authUrl`) : un document détourné ne doit pas pouvoir envoyer le code, le verifier ou le refresh
 * token ailleurs. `issuer` doit égaler `authUrl` (c'est aussi la valeur attendue de `iss`, RFC 9207).
 */
export function parseDiscovery(body: unknown, authUrl: string): Endpoints | null {
  if (!isRecord(body)) return null
  const origin = httpsOrigin(authUrl)
  if (origin === null) return null

  const issuer = body.issuer
  if (
    typeof issuer !== 'string' ||
    stripTrailingSlashes(issuer) !== stripTrailingSlashes(authUrl)
  ) {
    return null
  }
  const endpoint = (name: string): string | null => {
    const value = body[name]
    return typeof value === 'string' && httpsOrigin(value) === origin ? value : null
  }
  const authorizationEndpoint = endpoint('authorization_endpoint')
  const tokenEndpoint = endpoint('token_endpoint')
  const parEndpoint = endpoint('pushed_authorization_request_endpoint')
  if (!authorizationEndpoint || !tokenEndpoint || !parEndpoint) return null
  return {
    issuer: stripTrailingSlashes(issuer),
    authorizationEndpoint,
    tokenEndpoint,
    parEndpoint,
    revocationEndpoint: endpoint('revocation_endpoint'),
  }
}

export interface DiscoveryDeps {
  fetch: FetchLike
  authUrl: string
  now: () => number
  ttlMs?: number
  timeoutMs?: number
}

/** Découverte OIDC en cache (TTL 1 h), requêtes simultanées fusionnées, échecs jamais mis en cache. */
export function createDiscovery(deps: DiscoveryDeps): () => Promise<Endpoints> {
  const ttl = deps.ttlMs ?? DISCOVERY_TTL_MS
  let cached: { endpoints: Endpoints; at: number } | null = null
  let inFlight: Promise<Endpoints> | null = null

  async function load(): Promise<Endpoints> {
    const url = `${stripTrailingSlashes(deps.authUrl)}/.well-known/openid-configuration`
    let response: Response
    try {
      response = await fetchWithTimeout(
        deps.fetch,
        url,
        { headers: { Accept: 'application/json' } },
        deps.timeoutMs ?? 20_000,
      )
    } catch (error) {
      if (error instanceof NetworkFailure) throw new AuthFlowError(DISCOVERY_NETWORK_MESSAGE)
      throw error
    }
    if (!response.ok) throw new AuthFlowError(DISCOVERY_INVALID_MESSAGE)
    const endpoints = parseDiscovery(await readJson(response), deps.authUrl)
    if (!endpoints) throw new AuthFlowError(DISCOVERY_INVALID_MESSAGE)
    cached = { endpoints, at: deps.now() }
    return endpoints
  }

  return () => {
    if (cached && deps.now() - cached.at < ttl) return Promise.resolve(cached.endpoints)
    if (!inFlight) {
      inFlight = load().finally(() => {
        inFlight = null
      })
    }
    return inFlight
  }
}
