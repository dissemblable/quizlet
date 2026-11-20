import { ApiError } from '@quizlet/shared'
import { describe, expect, it, vi } from 'vitest'
import type { AuthStatus } from '@/auth/types'
import type { KeyValueStorage } from './file-storage'
import { GradeAbortedError, isRetryable, OwnerCheckError } from './grade-policy'
import { createOwnerStore } from './owner-store'
import { createSendGate } from './send-gate'

function memoryStorage(initial: Record<string, string> = {}): KeyValueStorage {
  const data = new Map(Object.entries(initial))
  return {
    getItem: async (key) => data.get(key) ?? null,
    setItem: async (key, value) => void data.set(key, value),
    removeItem: async (key) => void data.delete(key),
  }
}

function fakeAuth(initial: AuthStatus) {
  let status = initial
  const listeners = new Set<(status: AuthStatus) => void>()
  return {
    set(next: AuthStatus) {
      status = next
      for (const listener of [...listeners]) listener(next)
    },
    whenAuthenticated(): Promise<void> {
      if (status === 'signedIn') return Promise.resolve()
      return new Promise((resolve) => {
        const listener = (next: AuthStatus) => {
          if (next !== 'signedIn') return
          listeners.delete(listener)
          resolve()
        }
        listeners.add(listener)
      })
    },
    subscribeStatus(listener: (status: AuthStatus) => void) {
      listeners.add(listener)
      return () => void listeners.delete(listener)
    },
  }
}

function setup({
  status = 'signedIn',
  owner = 'alice',
  userId = 'alice',
}: {
  status?: AuthStatus
  owner?: string | null
  userId?: string | (() => Promise<string>)
} = {}) {
  const auth = fakeAuth(status)
  const store = createOwnerStore(
    memoryStorage(owner === null ? {} : { 'quizlet.offline.owner.v1': owner }),
  )
  const fetchUserId = vi.fn(typeof userId === 'function' ? userId : async () => userId)
  const purge = vi.fn(async () => {
    await store.clear()
  })
  const gate = createSendGate({ ...auth, fetchUserId, owner: store, purge })
  return { auth, store, fetchUserId, purge, gate }
}

describe('createSendGate', () => {
  it('laisse passer quand la session est ouverte et le propriétaire correspond', async () => {
    const { gate, purge } = setup()
    await expect(gate.whenReadyToSend()).resolves.toBeUndefined()
    expect(purge).not.toHaveBeenCalled()
  })

  it("attend la session : ni `/api/me` ni envoi tant qu'elle n'est pas `signedIn`", async () => {
    const { gate, auth, fetchUserId } = setup({ status: 'expired' })
    let ready = false
    const waiting = gate.whenReadyToSend().then(() => {
      ready = true
    })
    await Promise.resolve()
    await Promise.resolve()
    expect(ready).toBe(false)
    expect(fetchUserId).not.toHaveBeenCalled()
    auth.set('signedIn')
    await waiting
    expect(fetchUserId).toHaveBeenCalledTimes(1)
  })

  it("vérifie `/api/me` une seule fois par session, puis de nouveau après un changement d'état", async () => {
    const { gate, auth, fetchUserId } = setup()
    await gate.whenReadyToSend()
    await gate.whenReadyToSend()
    expect(fetchUserId).toHaveBeenCalledTimes(1)
    auth.set('expired')
    auth.set('signedIn')
    await gate.whenReadyToSend()
    expect(fetchUserId).toHaveBeenCalledTimes(2)
  })

  it("autre utilisateur : purge puis `GradeAbortedError`, jamais d'envoi", async () => {
    const { gate, purge, store } = setup({ owner: 'alice', userId: 'bob' })
    await expect(gate.whenReadyToSend()).rejects.toBeInstanceOf(GradeAbortedError)
    expect(purge).toHaveBeenCalledTimes(1)
    expect(await store.get()).toBeNull()
  })

  it('un second utilisateur qui se connecte après expiration est détecté', async () => {
    let current = 'alice'
    const { gate, auth, purge } = setup({ userId: async () => current })
    await gate.whenReadyToSend()
    auth.set('expired')
    current = 'bob'
    auth.set('signedIn')
    await expect(gate.whenReadyToSend()).rejects.toBeInstanceOf(GradeAbortedError)
    expect(purge).toHaveBeenCalledTimes(1)
  })

  it("sans propriétaire mémorisé, adopte l'utilisateur courant", async () => {
    const { gate, store, purge } = setup({ owner: null, userId: 'carol' })
    await gate.whenReadyToSend()
    expect(await store.get()).toBe('carol')
    expect(purge).not.toHaveBeenCalled()
  })

  it("propage l'erreur de `/api/me` (la note la réessaiera) sans valider la session", async () => {
    let fail = true
    const { gate, fetchUserId } = setup({
      userId: async () => {
        if (fail) throw new Error('réseau')
        return 'alice'
      },
    })
    await expect(gate.whenReadyToSend()).rejects.toThrow('réseau')
    fail = false
    await gate.whenReadyToSend()
    expect(fetchUserId).toHaveBeenCalledTimes(2)
  })

  it("refait la vérification si l'état change pendant la requête `/api/me`", async () => {
    let release: (id: string) => void = () => {}
    let first = true
    const { gate, auth, fetchUserId } = setup({
      userId: () => {
        if (!first) return Promise.resolve('alice')
        first = false
        return new Promise<string>((resolve) => {
          release = resolve
        })
      },
    })
    const ready = gate.whenReadyToSend()
    await Promise.resolve()
    auth.set('expired')
    auth.set('signedIn')
    release('alice')
    await ready
    expect(fetchUserId).toHaveBeenCalledTimes(2)
  })

  it('dispose se désabonne', async () => {
    const { gate, auth, fetchUserId } = setup()
    gate.dispose()
    await gate.whenReadyToSend()
    auth.set('expired')
    auth.set('signedIn')
    await gate.whenReadyToSend()
    expect(fetchUserId).toHaveBeenCalledTimes(1)
  })
})

describe('createSendGate : compte de la note (ownerId)', () => {
  it('laisse passer une note du compte connecté, ou sans ownerId (ancienne note)', async () => {
    const { gate, purge } = setup()
    await expect(gate.whenReadyToSend('alice')).resolves.toBeUndefined()
    await expect(gate.whenReadyToSend()).resolves.toBeUndefined()
    expect(purge).not.toHaveBeenCalled()
  })

  it('A se déconnecte avec une note en attente, B se connecte : la note de A est abandonnée', async () => {
    // Propriétaire absent (purge incomplète, clé perdue) : B serait adopté sans le contrôle de la note.
    let current = 'alice'
    const { gate, auth, store, purge } = setup({ owner: null, userId: async () => current })
    await gate.whenReadyToSend('alice')
    auth.set('signedOut')
    await store.clear()
    current = 'bob'
    auth.set('signedIn')

    await expect(gate.whenReadyToSend('alice')).rejects.toBeInstanceOf(GradeAbortedError)
    // Pas de purge : le cache est peut-être celui de B, et ses propres notes ne doivent pas partir avec.
    expect(purge).not.toHaveBeenCalled()
    // Une note de B, elle, part.
    await expect(gate.whenReadyToSend('bob')).resolves.toBeUndefined()
  })

  it('contrôle aussi les notes suivantes de la même session (vérification déjà faite)', async () => {
    const { gate, fetchUserId } = setup({ userId: 'bob', owner: 'bob' })
    await gate.whenReadyToSend('bob')
    await expect(gate.whenReadyToSend('alice')).rejects.toBeInstanceOf(GradeAbortedError)
    expect(fetchUserId).toHaveBeenCalledTimes(1)
  })
})

describe('createSendGate : erreur de /api/me', () => {
  const failWith = (error: unknown) => setup({ userId: async () => Promise.reject(error) })

  it('un 4xx (hors session) devient réessayable : ce n’est pas un refus de la note', async () => {
    for (const status of [400, 403, 404]) {
      const { gate } = failWith(new ApiError(status, 'NOT_FOUND', 'non'))
      const error = await gate.whenReadyToSend('alice').catch((e: unknown) => e)
      expect(error).toBeInstanceOf(OwnerCheckError)
      expect(isRetryable(error)).toBe(true)
    }
  })

  it('les autres erreurs sont propagées telles quelles (réseau, 5xx, session)', async () => {
    for (const original of [
      new ApiError(0, 'NETWORK_ERROR', 'réseau'),
      new ApiError(503, 'UNKNOWN', 'indisponible'),
      new ApiError(401, 'SESSION_EXPIRED', 'expirée'),
      new ApiError(429, 'UNKNOWN', 'trop vite'),
      new Error('autre'),
    ]) {
      const { gate } = failWith(original)
      await expect(gate.whenReadyToSend('alice')).rejects.toBe(original)
    }
  })
})
