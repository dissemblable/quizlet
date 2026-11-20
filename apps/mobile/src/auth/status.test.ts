import { describe, expect, it, vi } from 'vitest'
import { createStatusStore } from './status'

describe('machine d’états', () => {
  it('démarre en `loading` ; `settle` pose l’état lu au démarrage une seule fois', () => {
    const store = createStatusStore()
    expect(store.get()).toBe('loading')
    store.settle('signedOut')
    expect(store.get()).toBe('signedOut')
    store.settle('signedIn')
    expect(store.get()).toBe('signedOut')
  })

  it('une connexion terminée avant la lecture du stockage n’est pas écrasée', () => {
    const store = createStatusStore()
    store.markSignedIn()
    store.settle('signedOut')
    expect(store.get()).toBe('signedIn')
  })

  it('`expired` seulement depuis `signedIn`', () => {
    for (const from of ['loading', 'signedOut', 'expired'] as const) {
      const store = createStatusStore(from)
      store.markExpired()
      expect(store.get()).toBe(from)
    }
    const store = createStatusStore('signedIn')
    store.markExpired()
    expect(store.get()).toBe('expired')
    store.markSignedIn()
    expect(store.get()).toBe('signedIn')
    store.markSignedOut()
    expect(store.get()).toBe('signedOut')
  })

  it('notifie à chaque changement (pas à l’abonnement), se désabonne', () => {
    const store = createStatusStore('signedIn')
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)
    expect(listener).not.toHaveBeenCalled()
    store.markSignedIn()
    expect(listener).not.toHaveBeenCalled()
    store.markExpired()
    expect(listener).toHaveBeenCalledWith('expired')
    unsubscribe()
    store.markSignedIn()
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('`whenSignedIn` : immédiat si connecté, sinon attend `signedIn` (pas `expired`)', async () => {
    const connected = createStatusStore('signedIn')
    await expect(connected.whenSignedIn()).resolves.toBeUndefined()

    const store = createStatusStore('signedOut')
    let resolved = false
    const waiting = store.whenSignedIn().then(() => {
      resolved = true
    })
    await Promise.resolve()
    expect(resolved).toBe(false)
    store.markSignedIn()
    await waiting
    expect(resolved).toBe(true)

    const expired = createStatusStore('expired')
    let expiredResolved = false
    void expired.whenSignedIn().then(() => {
      expiredResolved = true
    })
    await Promise.resolve()
    expect(expiredResolved).toBe(false)
  })
})
