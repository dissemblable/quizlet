import type { ReactNode } from 'react'

/**
 * CONTRAT : enveloppe de `(app)/_layout.tsx`. Bloque l'affichage sur `useMe()` (chargement, erreur +
 * « Réessayer » ; une erreur de session est déjà gérée par la bannière), détecte le fuseau (si
 * `settings.timezone === null` : `getDeviceTimeZone()` puis `useSaveSettings`), appelle
 * `useTrackUser(me.id)` et `usePrefetchReviewData()`. Provisoire : rend `children`.
 */
export function AppGate({ children }: { children: ReactNode }) {
  return <>{children}</>
}
