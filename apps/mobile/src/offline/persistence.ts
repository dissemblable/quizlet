import type { PersistQueryClientOptions } from '@tanstack/react-query-persist-client'
import { createThrottledPersister, dehydrateOptions, flushCache, PERSIST_BUSTER } from './persist'
import { getQueryClient } from './query-client'
import { createRestoreHandlers, type RestoreHandlers } from './restore'
import { cacheStorage } from './storage-adapter'

/**
 * Options STABLES (le fournisseur ne relit pas un changement d'identité après la restauration).
 * `maxAge: Infinity` : sinon `removeClient()` effacerait aussi la file de notes après 24 h.
 */
export const persistOptions: Omit<PersistQueryClientOptions, 'queryClient'> = {
  persister: createThrottledPersister(cacheStorage),
  maxAge: Number.POSITIVE_INFINITY,
  buster: PERSIST_BUSTER,
  dehydrateOptions,
}

let handlers: RestoreHandlers | undefined

export function getRestoreHandlers(): RestoreHandlers {
  handlers ??= createRestoreHandlers(getQueryClient())
  return handlers
}

/**
 * Écriture immédiate du cache (enqueue d'une note, passage en arrière-plan). Sans effet avant la
 * fin de la restauration : on écraserait le cache qu'elle n'a pas encore relu. Ne rejette jamais.
 */
export async function flushPersistedCache(): Promise<void> {
  if (!getRestoreHandlers().isRestored()) return
  try {
    await flushCache(getQueryClient(), cacheStorage)
  } catch (error) {
    console.warn('[offline] écriture du cache impossible', error)
  }
}
