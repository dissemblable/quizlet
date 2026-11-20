import type { QueryClient } from '@tanstack/react-query'
import type { OwnerStore } from './owner-store'

export interface PurgeDeps {
  client: QueryClient
  /** Supprime le fichier (ou la clé AsyncStorage) du cache persisté. */
  removeCache(): Promise<void>
  owner: Pick<OwnerStore, 'clear'>
}

/**
 * Efface TOUTES les données de l'utilisateur de l'appareil : cache, file de notes, cache persisté,
 * propriétaire. Ne rejette jamais.
 * - défaut (déconnexion) : `client.clear()` ;
 * - `refetch` (changement de propriétaire, écrans encore montés) : `resetQueries()`, qui garde les
 *   requêtes actives et les recharge, au lieu de laisser les écrans afficher l'ancien compte.
 */
export async function purgeUserDataWith(
  { client, removeCache, owner }: PurgeDeps,
  { refetch = false }: { refetch?: boolean } = {},
): Promise<void> {
  try {
    client.getMutationCache().clear()
    if (refetch) await client.resetQueries()
    else client.clear()
  } catch {
    // Rien à faire de plus : les fichiers sont tout de même supprimés.
  }
  await Promise.allSettled([removeCache(), owner.clear()])
}

/**
 * Mémorise le propriétaire du cache. Un utilisateur différent du propriétaire mémorisé purge d'abord
 * le cache et la file de notes de l'ancien.
 */
export async function trackOwner(
  userId: string,
  { owner, purge }: { owner: OwnerStore; purge(): Promise<void> },
): Promise<void> {
  const stored = await owner.get()
  if (stored === userId) return
  if (stored !== null) await purge()
  await owner.set(userId)
}
