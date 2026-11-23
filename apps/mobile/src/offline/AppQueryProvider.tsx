import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { type ReactNode, useEffect } from 'react'
import { getAuthStatus, subscribeAuthStatus } from '@/auth/status'
import { onAppStateChange } from './network-adapter'
import { flushPersistedCache, getRestoreHandlers, persistOptions } from './persistence'
import { getQueryClient } from './query-client'
import { watchReconnection } from './restore'

/**
 * CONTRAT : fournit le `QueryClient` (`getQueryClient()`) avec persistance (stockage fichier),
 * suivi du réseau (NetInfo → `onlineManager`) et du premier plan (AppState → `focusManager`), et
 * reprise des notes en attente. Les valeurs par défaut de la mutation de note existent dès la
 * création du client, donc avant la restauration. Restauration : `onSuccess` relance les notes
 * SANS renvoyer de promesse (le fournisseur l'attendrait).
 */
export function AppQueryProvider({ children }: { children: ReactNode }) {
  const client = getQueryClient()
  const restore = getRestoreHandlers()

  useEffect(() => {
    // Reconnexion (depuis `expired`, `signedOut`, `loading`) : requêtes en échec et notes repartent.
    const unsubscribeAuth = watchReconnection(client, {
      get: getAuthStatus,
      subscribe: subscribeAuthStatus,
    })
    // L'app peut être tuée en arrière-plan : le cache est écrit tout de suite, sans attendre le délai.
    const unsubscribeApp = onAppStateChange((state) => {
      if (state !== 'active') void flushPersistedCache()
    })
    return () => {
      unsubscribeAuth()
      unsubscribeApp()
    }
  }, [client])

  return (
    <PersistQueryClientProvider
      client={client}
      persistOptions={persistOptions}
      onSuccess={restore.onSuccess}
      onError={restore.onError}
    >
      {children}
    </PersistQueryClientProvider>
  )
}
