import type { OfflineStatus } from './types'

/** CONTRAT : l'appareil a du réseau (NetInfo `isConnected !== false`). Provisoire : toujours vrai. */
export function useIsOnline(): boolean {
  return true
}

/**
 * CONTRAT : garde des écritures. Renvoie une fonction : `true` si en ligne (l'action peut partir),
 * sinon affiche le toast `OFFLINE_WRITE_MESSAGE` et renvoie `false`.
 * `if (!guard()) return` en tête de chaque action d'écriture.
 */
export function useOnlineGuard(): () => boolean {
  return () => true
}

/** CONTRAT : état hors ligne pour l'UI (bannière, boutons désactivés). */
export function useOfflineStatus(): OfflineStatus {
  return { online: true, pendingGrades: 0, restoring: false }
}
