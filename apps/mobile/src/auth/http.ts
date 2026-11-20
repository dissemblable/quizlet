/** `fetch` injecté (le `fetch` global en production) : URL en chaîne, comme dans tous les appels OIDC. */
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

export const OIDC_TIMEOUT_MS = 20_000

/** Échec attendu d'une étape du parcours, avec un message prêt à afficher. */
export class AuthFlowError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthFlowError'
  }
}

/** Le serveur n'a pas répondu (réseau coupé, DNS, délai dépassé). */
export class NetworkFailure extends Error {
  constructor() {
    super('network')
    this.name = 'NetworkFailure'
  }
}

/**
 * `application/x-www-form-urlencoded` à la main : `URLSearchParams` est incomplet sur Hermes
 * (`toString` absent selon les versions de React Native).
 */
export function formEncode(fields: Record<string, string>): string {
  return Object.entries(fields)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&')
}

/** `fetch` avec délai maximal (`AbortController` + `setTimeout`, pas d'`AbortSignal.timeout`). */
export async function fetchWithTimeout(
  fetchImpl: FetchLike,
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal })
  } catch {
    throw new NetworkFailure()
  } finally {
    clearTimeout(timer)
  }
}

/** POST d'un formulaire (PAR, jetons, révocation). Lève `NetworkFailure` sans réponse. */
export function postForm(
  fetchImpl: FetchLike,
  url: string,
  fields: Record<string, string>,
  timeoutMs: number = OIDC_TIMEOUT_MS,
): Promise<Response> {
  return fetchWithTimeout(
    fetchImpl,
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: formEncode(fields),
    },
    timeoutMs,
  )
}

/** Corps JSON d'une réponse, `null` s'il est absent ou invalide. */
export async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return null
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Origine (`https://hôte[:port]`) d'une URL https, `null` sinon. Regex : `URL` est incomplet sur Hermes. */
export function httpsOrigin(url: string): string | null {
  const match = /^(https:\/\/[^\s/?#]+)(?:[/?#]|$)/i.exec(url)
  return match?.[1] ? match[1].toLowerCase() : null
}

export function stripTrailingSlashes(url: string): string {
  return url.replace(/\/+$/, '')
}
