export type QueryView = 'loading' | 'offline' | 'error' | 'ready'

/**
 * Vue d'une requête TanStack pour l'écran : les trois champs suffisent (`UseQueryResult` convient).
 * - `offline` : jamais chargée ET en pause (hors ligne, sans cache) : « Données indisponibles » ;
 * - `loading` : jamais chargée, en cours (ou requête désactivée) ;
 * - `error` : statut `error` ;
 * - `ready` : le reste (données présentes, même périmées).
 *
 * ATTENTION : en TanStack v5, un rafraîchissement raté après un succès laisse `data` en place mais
 * passe le statut à `error` (`queryView` renvoie alors `'error'`). Pour garder des données
 * affichables à l'écran, tester `query.data !== undefined` AVANT d'appeler `queryView`.
 */
export function queryView(query: {
  isPending: boolean
  isError: boolean
  fetchStatus: 'fetching' | 'paused' | 'idle'
}): QueryView {
  if (query.isPending) return query.fetchStatus === 'paused' ? 'offline' : 'loading'
  if (query.isError) return 'error'
  return 'ready'
}
