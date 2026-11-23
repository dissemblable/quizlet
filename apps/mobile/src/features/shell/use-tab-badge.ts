import { useEffectiveSummary } from '@/offline'

/**
 * Nombre affiché en badge sur l'onglet Révision : cartes dues + nouvelles du jour, notes en attente
 * déduites (0 tant que le résumé est inconnu). Même calcul que `ReviewLink` du web.
 */
export function useTabBadge(): number {
  const { data } = useEffectiveSummary()
  return data ? data.due + data.new : 0
}
