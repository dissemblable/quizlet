import { getQueryClient } from './query-client'

/**
 * CONTRAT : efface TOUTES les données de l'utilisateur sur l'appareil : cache en mémoire, cache
 * persisté, file de notes en attente, propriétaire mémorisé. Appelée à la déconnexion (`onSignedOut`
 * du layout racine) et quand le propriétaire change. Ne rejette jamais. Provisoire : vide le cache
 * en mémoire.
 */
export async function purgeUserData(): Promise<void> {
  getQueryClient().clear()
}
