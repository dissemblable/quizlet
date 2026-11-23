import { describe, expect, it } from 'vitest'
import { createAuthStore, PENDING_TTL_MS, STORE_KEYS } from './store'
import { memoryKv } from './test-kit'

const pending = { state: 'abcd', verifier: 'v'.repeat(64), createdAt: 1_000_000 }
const tokens = { accessToken: 'at', refreshToken: 'rt', expiresAt: 5_000_000 }

describe('clés', () => {
  it('versionnées, valides pour SecureStore', () => {
    expect(STORE_KEYS).toEqual({
      tokens: 'quizlet.auth.tokens.v1',
      pending: 'quizlet.auth.pending.v1',
      revoke: 'quizlet.auth.revoke.v1',
    })
    for (const key of Object.values(STORE_KEYS)) expect(key).toMatch(/^[\w.-]+$/)
  })
})

describe('jetons', () => {
  it('écrit et relit', async () => {
    const { kv, data } = memoryKv()
    const store = createAuthStore(kv)
    expect(await store.readTokens()).toBeNull()
    await store.writeTokens(tokens)
    expect(data.has(STORE_KEYS.tokens)).toBe(true)
    expect(await store.readTokens()).toEqual(tokens)
    await store.clearTokens()
    expect(await store.readTokens()).toBeNull()
  })

  it('entrée corrompue : null, et elle est supprimée', async () => {
    const { kv, data } = memoryKv({ [STORE_KEYS.tokens]: '{"accessToken":' })
    expect(await createAuthStore(kv).readTokens()).toBeNull()
    expect(data.has(STORE_KEYS.tokens)).toBe(false)
  })

  it('lecture qui lève (clé Keystore invalidée) : null, sans rejet', async () => {
    const store = createAuthStore({
      get: async () => {
        throw new Error('Could not decrypt')
      },
      set: async () => {},
      remove: async () => {},
    })
    expect(await store.readTokens()).toBeNull()
    expect(await store.readPending(0)).toBeNull()
    expect(await store.readRevoke()).toBeNull()
  })
})

describe('pending', () => {
  it('écrit et relit dans le TTL', async () => {
    const store = createAuthStore(memoryKv().kv)
    await store.writePending(pending)
    expect(await store.readPending(pending.createdAt + 1000)).toEqual(pending)
    expect(await store.readPending(pending.createdAt + PENDING_TTL_MS)).toEqual(pending)
  })

  it('TTL de 15 min : au-delà, null et supprimé', async () => {
    const { kv, data } = memoryKv()
    const store = createAuthStore(kv)
    await store.writePending(pending)
    expect(await store.readPending(pending.createdAt + PENDING_TTL_MS + 1)).toBeNull()
    expect(data.has(STORE_KEYS.pending)).toBe(false)
  })

  it('corrompu : null', async () => {
    const { kv } = memoryKv({ [STORE_KEYS.pending]: JSON.stringify({ state: 'x' }) })
    expect(await createAuthStore(kv).readPending(0)).toBeNull()
  })
})

describe('révocation en attente', () => {
  it('écrit, relit, efface', async () => {
    const store = createAuthStore(memoryKv().kv)
    expect(await store.readRevoke()).toBeNull()
    await store.writeRevoke('rt-à-révoquer')
    expect(await store.readRevoke()).toBe('rt-à-révoquer')
    await store.clearRevoke()
    expect(await store.readRevoke()).toBeNull()
  })
})
