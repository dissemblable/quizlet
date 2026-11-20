import { DEFAULT_REMINDER_PREFS, type ReminderPrefs } from './prefs'

export interface PrefsState {
  prefs: ReminderPrefs
  /** `false` tant que le stockage n'a pas été lu : on ne touche pas au rappel programmé avant. */
  loaded: boolean
}

/**
 * Petit store en mémoire partagé par `ReminderSection` et `useReminderSync` (compatible
 * `useSyncExternalStore` : `getState` renvoie le même objet tant que rien ne change).
 */
export function createPrefsStore() {
  let state: PrefsState = { prefs: { ...DEFAULT_REMINDER_PREFS }, loaded: false }
  const listeners = new Set<() => void>()

  function emit(next: PrefsState) {
    state = next
    for (const listener of [...listeners]) listener()
  }

  return {
    getState: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    /** Résultat de la lecture initiale ; ignoré si des préférences ont été écrites entre-temps. */
    hydrate(prefs: ReminderPrefs) {
      if (!state.loaded) emit({ prefs, loaded: true })
    },
    set(prefs: ReminderPrefs) {
      emit({ prefs, loaded: true })
    },
  }
}

export const prefsStore = createPrefsStore()
