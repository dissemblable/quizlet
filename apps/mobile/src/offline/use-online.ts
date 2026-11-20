import { onlineManager, useIsMutating, useIsRestoring } from '@tanstack/react-query'
import { useMemo, useSyncExternalStore } from 'react'
import { toast } from '@/ui'
import { OFFLINE_WRITE_MESSAGE } from './constants'
import { GRADE_MUTATION_KEY } from './keys'
import type { OfflineStatus } from './types'

const subscribeOnline = (onChange: () => void) => onlineManager.subscribe(() => onChange())
const getOnline = () => onlineManager.isOnline()

/** CONTRAT : l'appareil a du réseau (NetInfo `isConnected !== false`). */
export function useIsOnline(): boolean {
  return useSyncExternalStore(subscribeOnline, getOnline)
}

function guardOnline(): boolean {
  if (onlineManager.isOnline()) return true
  toast.error(OFFLINE_WRITE_MESSAGE)
  return false
}

/**
 * CONTRAT : garde des écritures. Renvoie une fonction : `true` si en ligne (l'action peut partir),
 * sinon affiche le toast `OFFLINE_WRITE_MESSAGE` et renvoie `false`.
 * `if (!guard()) return` en tête de chaque action d'écriture. Identité stable.
 */
export function useOnlineGuard(): () => boolean {
  return guardOnline
}

/** CONTRAT : état hors ligne pour l'UI (bannière, boutons désactivés). */
export function useOfflineStatus(): OfflineStatus {
  const online = useIsOnline()
  const pendingGrades = useIsMutating({ mutationKey: GRADE_MUTATION_KEY })
  const restoring = useIsRestoring()
  return useMemo(() => ({ online, pendingGrades, restoring }), [online, pendingGrades, restoring])
}
