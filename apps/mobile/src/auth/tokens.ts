import { isRecord } from './http'

/** Jetons de la session (stockés dans SecureStore, jamais ailleurs, jamais dans les logs). */
export interface Tokens {
  accessToken: string
  refreshToken: string
  /** Instant d'expiration de l'access token (ms depuis l'epoch). */
  expiresAt: number
}

/** Marge avant l'expiration au-delà de laquelle on rafraîchit d'avance. */
export const EXPIRY_MARGIN_MS = 60_000

/** `expires_in` absent (la RFC 6749 ne l'impose pas) : le 302/401 déclenchera de toute façon le refresh. */
const DEFAULT_EXPIRES_IN_S = 3600

export function serializeTokens(tokens: Tokens): string {
  return JSON.stringify({
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: tokens.expiresAt,
  })
}

/** Relit les jetons stockés ; `null` si l'entrée est absente ou corrompue. */
export function parseTokens(raw: string | null): Tokens | null {
  if (raw === null) return null
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return null
  }
  if (!isRecord(value)) return null
  const { accessToken, refreshToken, expiresAt } = value
  if (
    typeof accessToken !== 'string' ||
    accessToken === '' ||
    typeof refreshToken !== 'string' ||
    refreshToken === '' ||
    typeof expiresAt !== 'number' ||
    !Number.isFinite(expiresAt)
  ) {
    return null
  }
  return { accessToken, refreshToken, expiresAt }
}

/** L'access token expire dans moins de `marginMs` (ou a déjà expiré). */
export function isAccessExpired(
  tokens: Tokens,
  now: number,
  marginMs: number = EXPIRY_MARGIN_MS,
): boolean {
  return now >= tokens.expiresAt - marginMs
}

/**
 * Jetons d'une réponse du endpoint token (`expiresAt = now + expires_in × 1000`). Au refresh, un
 * refresh token absent de la réponse laisse l'ancien (`previousRefreshToken`) ; au premier échange,
 * il est obligatoire. `null` si la réponse est inutilisable.
 */
export function tokensFromResponse(
  body: unknown,
  now: number,
  previousRefreshToken?: string,
): Tokens | null {
  if (!isRecord(body)) return null
  const accessToken = body.access_token
  if (typeof accessToken !== 'string' || accessToken === '') return null
  const rotated = body.refresh_token
  const refreshToken =
    typeof rotated === 'string' && rotated !== '' ? rotated : previousRefreshToken
  if (!refreshToken) return null
  const expiresIn = body.expires_in ?? DEFAULT_EXPIRES_IN_S
  if (typeof expiresIn !== 'number' || !Number.isFinite(expiresIn) || expiresIn <= 0) return null
  return { accessToken, refreshToken, expiresAt: now + expiresIn * 1000 }
}
