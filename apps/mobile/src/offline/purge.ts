import { getQueryClient } from './query-client'
import { purgeStoredData } from './storage-adapter'

/**
 * CONTRAT : efface TOUTES les données de l'utilisateur sur l'appareil : cache en mémoire, cache
 * persisté, file de notes en attente, propriétaire mémorisé. Appelée à la déconnexion (`onSignedOut`
 * du layout racine) et quand le propriétaire change. Ne rejette jamais.
 */
export async function purgeUserData(): Promise<void> {
  await purgeStoredData(getQueryClient())
}
