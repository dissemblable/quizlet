import { isRecord } from './http'
import { parseTokens, serializeTokens, type Tokens } from './tokens'

/** Clés SecureStore (alphanumériques, `.`, `-`, `_`). Versionnées : un format change = `v2`. */
export const STORE_KEYS = {
  tokens: 'quizlet.auth.tokens.v1',
  pending: 'quizlet.auth.pending.v1',
  revoke: 'quizlet.auth.revoke.v1',
} as const

/** Durée de vie d'une connexion commencée : au-delà, un callback tardif est refusé. */
export const PENDING_TTL_MS = 15 * 60 * 1000

/** Stockage clé/valeur sécurisé (SecureStore en production, `Map` dans les tests). */
export interface SecureKv {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
  remove(key: string): Promise<void>
}

/** Connexion en cours : `state` attendu et verifier PKCE (le secret qui lie le code à cette app). */
export interface Pending {
  state: string
  verifier: string
  createdAt: number
}

export interface AuthStore {
  /** `null` si absent, illisible ou corrompu (l'entrée est alors supprimée). Ne rejette jamais. */
  readTokens(): Promise<Tokens | null>
  writeTokens(tokens: Tokens): Promise<void>
  clearTokens(): Promise<void>
  /** `null` si absent, corrompu ou expiré (TTL 15 min ; l'entrée est alors supprimée). */
  readPending(now: number): Promise<Pending | null>
  writePending(pending: Pending): Promise<void>
  clearPending(): Promise<void>
  readRevoke(): Promise<string | null>
  writeRevoke(refreshToken: string): Promise<void>
  clearRevoke(): Promise<void>
}

function parsePending(raw: string | null): Pending | null {
  if (raw === null) return null
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return null
  }
  if (!isRecord(value)) return null
  const { state, verifier, createdAt } = value
  if (
    typeof state !== 'string' ||
    state === '' ||
    typeof verifier !== 'string' ||
    verifier === '' ||
    typeof createdAt !== 'number' ||
    !Number.isFinite(createdAt)
  ) {
    return null
  }
  return { state, verifier, createdAt }
}

export function createAuthStore(kv: SecureKv): AuthStore {
  // Une lecture qui échoue (clé Keystore invalidée, restauration) vaut « rien de stocké ».
  async function readOrDrop<T>(
    key: string,
    parse: (raw: string | null) => T | null,
  ): Promise<T | null> {
    let raw: string | null
    try {
      raw = await kv.get(key)
    } catch {
      return null
    }
    const value = parse(raw)
    if (value === null && raw !== null) await kv.remove(key).catch(() => {})
    return value
  }

  return {
    readTokens: () => readOrDrop(STORE_KEYS.tokens, parseTokens),
    writeTokens: (tokens) => kv.set(STORE_KEYS.tokens, serializeTokens(tokens)),
    clearTokens: () => kv.remove(STORE_KEYS.tokens),
    async readPending(now) {
      const pending = await readOrDrop(STORE_KEYS.pending, parsePending)
      if (pending && now - pending.createdAt > PENDING_TTL_MS) {
        await kv.remove(STORE_KEYS.pending).catch(() => {})
        return null
      }
      return pending
    },
    writePending: (pending) =>
      kv.set(
        STORE_KEYS.pending,
        JSON.stringify({
          state: pending.state,
          verifier: pending.verifier,
          createdAt: pending.createdAt,
        }),
      ),
    clearPending: () => kv.remove(STORE_KEYS.pending),
    readRevoke: () => readOrDrop(STORE_KEYS.revoke, (raw) => (raw === '' ? null : raw)),
    writeRevoke: (refreshToken) => kv.set(STORE_KEYS.revoke, refreshToken),
    clearRevoke: () => kv.remove(STORE_KEYS.revoke),
  }
}
