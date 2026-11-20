import type { QueryClient } from '@tanstack/react-query'
import { createOfflineClient } from './client-factory'
import { installNetworkManagers } from './network-adapter'
import { createRuntimeDeps } from './runtime-deps'

let client: QueryClient | undefined

/**
 * CONTRAT : le `QueryClient` unique de l'app (singleton de module), utilisable hors React
 * (`purgeUserData`, file de notes). Créé avec les valeurs par défaut de la mutation de note : elles
 * doivent exister avant la restauration du cache (`PersistQueryClientProvider` restaure dans un
 * effet), pas dans un `useEffect` de `AppQueryProvider`.
 */
export function getQueryClient(): QueryClient {
  if (!client) {
    installNetworkManagers()
    client = createOfflineClient(createRuntimeDeps(getQueryClient))
  }
  return client
}
