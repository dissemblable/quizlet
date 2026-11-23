import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import type { QueryClient } from '@tanstack/react-query'
import {
  type PersistedClient,
  type Persister,
  persistQueryClientSave,
} from '@tanstack/react-query-persist-client'
import type { KeyValueStorage } from './file-storage'
import { shouldDehydrateMutation, shouldDehydrateQuery } from './persist-filter'
import { MAX_CACHE_CHARS, trimPersistedClient } from './trim'

/** Clé du cache (AsyncStorage en repli ; le stockage fichier, lui, n'a qu'une valeur). */
export const PERSIST_KEY = 'quizlet.offline.cache.v1'
/** Fichier du cache dans `Paths.document/offline`. */
export const CACHE_FILE_NAME = 'query-cache.v1.json'
/** Changer cette valeur invalide (et efface) tout cache existant, notes en attente comprises. */
export const PERSIST_BUSTER = 'mobile-cache-1'
export const PERSIST_THROTTLE_MS = 2000

/** Mêmes options pour le persister temporisé, le flush explicite et les tests. */
export const dehydrateOptions = { shouldDehydrateQuery, shouldDehydrateMutation }

/** Sérialisation commune aux deux chemins d'écriture : le cache est borné (`trimPersistedClient`). */
export function serializeClient(client: PersistedClient): string {
  const json = JSON.stringify(client)
  return json.length <= MAX_CACHE_CHARS
    ? json
    : JSON.stringify(trimPersistedClient(client, MAX_CACHE_CHARS))
}

/** Persister de `PersistQueryClientProvider` : écritures regroupées (une toutes les ~2 s). */
export function createThrottledPersister(storage: KeyValueStorage): Persister {
  return createAsyncStoragePersister({
    storage,
    key: PERSIST_KEY,
    throttleTime: PERSIST_THROTTLE_MS,
    serialize: serializeClient,
  })
}

/**
 * Persister SANS temporisation, pour le flush explicite : `persistClient` du persister temporisé
 * est toujours limité en débit, il ne peut pas servir à écrire « maintenant ».
 */
export function createDirectPersister(storage: KeyValueStorage): Persister {
  return {
    persistClient: async (client) => storage.setItem(PERSIST_KEY, serializeClient(client)),
    restoreClient: async () => {
      const text = await storage.getItem(PERSIST_KEY)
      return text ? (JSON.parse(text) as PersistedClient) : undefined
    },
    removeClient: () => storage.removeItem(PERSIST_KEY),
  }
}

/** Écrit tout de suite le cache (enqueue d'une note, passage en arrière-plan). */
export function flushCache(client: QueryClient, storage: KeyValueStorage): Promise<void> {
  return persistQueryClientSave({
    queryClient: client,
    persister: createDirectPersister(storage),
    buster: PERSIST_BUSTER,
    dehydrateOptions,
  })
}
