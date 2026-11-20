import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_REMINDER_PREFS } from './prefs'
import { createPrefsStore } from './reminder-store'

describe('createPrefsStore', () => {
  it('démarre non chargé, avec les défauts', () => {
    const store = createPrefsStore()
    expect(store.getState()).toEqual({ prefs: DEFAULT_REMINDER_PREFS, loaded: false })
  })

  it('hydrate puis notifie', () => {
    const store = createPrefsStore()
    const listener = vi.fn()
    store.subscribe(listener)
    store.hydrate({ enabled: true, hour: 7, minute: 15 })
    expect(store.getState()).toEqual({
      prefs: { enabled: true, hour: 7, minute: 15 },
      loaded: true,
    })
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('ignore la lecture initiale si des préférences ont été écrites entre-temps', () => {
    const store = createPrefsStore()
    store.set({ enabled: false, hour: 18, minute: 0 })
    store.hydrate({ enabled: true, hour: 7, minute: 15 })
    expect(store.getState().prefs.enabled).toBe(false)
  })

  it("garde le même objet d'état tant que rien ne change", () => {
    const store = createPrefsStore()
    expect(store.getState()).toBe(store.getState())
  })

  it('ne notifie plus après désabonnement', () => {
    const store = createPrefsStore()
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)
    unsubscribe()
    store.set({ enabled: true, hour: 9, minute: 0 })
    expect(listener).not.toHaveBeenCalled()
  })
})
