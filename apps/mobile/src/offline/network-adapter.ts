import NetInfo from '@react-native-community/netinfo'
import { focusManager, onlineManager } from '@tanstack/react-query'
import { AppState, type AppStateStatus } from 'react-native'

let installed = false

/**
 * Branche le réseau (NetInfo → `onlineManager`) et le premier plan (AppState → `focusManager`) de
 * TanStack. `isConnected` seul : `isInternetReachable` vaut `null` (inconnu) trop souvent et ferait
 * passer l'app hors ligne à tort. Idempotent.
 */
export function installNetworkManagers(): void {
  if (installed) return
  installed = true
  onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((state) => setOnline(state.isConnected !== false)),
  )
  focusManager.setEventListener((handleFocus) => {
    const subscription = AppState.addEventListener('change', (state) =>
      handleFocus(state === 'active'),
    )
    return () => subscription.remove()
  })
}

/** Changements d'état de l'app (`active`, `background`…). Renvoie le désabonnement. */
export function onAppStateChange(listener: (state: AppStateStatus) => void): () => void {
  const subscription = AppState.addEventListener('change', listener)
  return () => subscription.remove()
}
