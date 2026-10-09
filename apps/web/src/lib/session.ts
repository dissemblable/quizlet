import { useSyncExternalStore } from 'react'

// État global minimal : « la session SSO a expiré », déclenché par n'importe quelle requête.
let expired = false
const listeners = new Set<() => void>()

export function markSessionExpired(): void {
  if (expired) return
  expired = true
  for (const listener of listeners) listener()
}

/** Réservé aux tests : remet l'état à zéro entre deux rendus. */
export function resetSessionExpired(): void {
  expired = false
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useSessionExpired(): boolean {
  return useSyncExternalStore(subscribe, () => expired)
}

/** Recharger la page relance le parcours nginx → Authelia → retour sur la page courante. */
export function reconnect(): void {
  window.location.reload()
}
