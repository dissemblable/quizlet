import { useCallback, useEffect, useSyncExternalStore } from 'react'
import type { ReminderPrefs } from './prefs'
import { loadPrefs, savePrefs } from './reminder-adapter'
import { prefsStore } from './reminder-store'

let hydrationStarted = false

/** Préférences partagées (store en mémoire, lu une fois depuis AsyncStorage). */
export function useReminderPrefs() {
  const { prefs, loaded } = useSyncExternalStore(prefsStore.subscribe, prefsStore.getState)

  useEffect(() => {
    if (hydrationStarted) return
    hydrationStarted = true
    void loadPrefs().then((stored) => prefsStore.hydrate(stored))
  }, [])

  /** Fusionne `patch` dans les préférences COURANTES (pas celles du rendu) puis les enregistre. */
  const update = useCallback((patch: Partial<ReminderPrefs>) => {
    const next = { ...prefsStore.getState().prefs, ...patch }
    prefsStore.set(next)
    void savePrefs(next)
  }, [])

  return { prefs, loaded, update }
}
