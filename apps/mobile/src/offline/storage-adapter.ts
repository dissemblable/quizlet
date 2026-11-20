import AsyncStorage from '@react-native-async-storage/async-storage'
import type { QueryClient } from '@tanstack/react-query'
import { createExpoFsPort } from './file-adapter'
import { createFallbackStorage, createFileStorage, type KeyValueStorage } from './file-storage'
import { createOwnerStore } from './owner-store'
import { CACHE_FILE_NAME, PERSIST_KEY } from './persist'
import { purgeUserDataWith } from './purge-data'

const asyncStorage: KeyValueStorage = AsyncStorage
const fileStorage = createFileStorage(createExpoFsPort(), CACHE_FILE_NAME)

/**
 * Cache persisté : un fichier (`Paths.document/offline/query-cache.v1.json`), AsyncStorage si l'API
 * fichier échoue.
 */
export const cacheStorage: KeyValueStorage = createFallbackStorage(
  fileStorage,
  asyncStorage,
  (error) => console.warn('[offline] stockage fichier indisponible, repli sur AsyncStorage', error),
)

/** Propriétaire du cache (`quizlet.offline.owner.v1`, AsyncStorage). */
export const ownerStore = createOwnerStore(asyncStorage)

/** Efface les deux emplacements possibles du cache : un repli passé ne doit pas laisser de fichier. */
async function removeCache(): Promise<void> {
  await Promise.allSettled([
    fileStorage.removeItem(PERSIST_KEY),
    asyncStorage.removeItem(PERSIST_KEY),
  ])
}

export function purgeStoredData(
  client: QueryClient,
  options?: { refetch?: boolean },
): Promise<void> {
  return purgeUserDataWith({ client, removeCache, owner: ownerStore }, options)
}
