import type { KeyValueStorage } from './file-storage'

/** AsyncStorage : propriétaire du cache hors ligne (identifiant de l'utilisateur). */
export const OWNER_KEY = 'quizlet.offline.owner.v1'

export interface OwnerStore {
  /** `null` : aucun propriétaire mémorisé. Une erreur de lecture est propagée (jamais prise pour « aucun »). */
  get(): Promise<string | null>
  set(userId: string): Promise<void>
  clear(): Promise<void>
}

/** Écriture à travers un cache mémoire : un `get()` juste après `set()` voit déjà la nouvelle valeur. */
export function createOwnerStore(storage: KeyValueStorage, key = OWNER_KEY): OwnerStore {
  let cached: string | null | undefined

  return {
    async get() {
      if (cached === undefined) cached = await storage.getItem(key)
      return cached
    },
    async set(userId) {
      cached = userId
      await storage.setItem(key, userId)
    },
    async clear() {
      cached = null
      await storage.removeItem(key)
    },
  }
}
