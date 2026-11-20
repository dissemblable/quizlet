import { ApiError } from '@quizlet/shared'
import type { ReactNode } from 'react'
import { type SetDetail, useSet } from '@/lib/queries'
import { queryView } from '@/lib/query-state'
import { EmptyState, ErrorState, LoadingState, Screen } from '@/ui'
import { OwnerOnlyState } from './OwnerOnlyState'
import { SetNotFound } from './SetNotFound'

export interface SetGateProps {
  id: string
  /** Réserve la suite à l'auteur : sinon `OwnerOnlyState`. */
  ownerOnly?: boolean
  /** Défaut : « Modification réservée à l'auteur » (import : « Import réservé à l'auteur »). */
  ownerOnlyTitle?: string
  ownerOnlyDescription?: string
  children: (set: SetDetail) => ReactNode
}

/**
 * Charge le set `id` et gère chargement, hors ligne sans cache, 404, erreur et non-auteur ; sinon
 * appelle `children(set)`. Les états intermédiaires sont rendus dans leur propre `Screen`, `children`
 * fournit le sien. Les données en cache priment sur une erreur de rafraîchissement (comme le web).
 */
export function SetGate({
  id,
  ownerOnly = false,
  ownerOnlyTitle,
  ownerOnlyDescription,
  children,
}: SetGateProps) {
  const query = useSet(id)
  const set = query.data

  if (set === undefined) {
    const view = queryView(query)
    if (view === 'offline') {
      return (
        <Screen padded>
          <EmptyState
            icon="wifi-off"
            title="Données indisponibles hors ligne"
            description="Ce contenu n'a pas encore été chargé sur cet appareil."
          />
        </Screen>
      )
    }
    if (view === 'loading') {
      return (
        <Screen padded>
          <LoadingState label="Chargement du set…" />
        </Screen>
      )
    }
    if (query.error instanceof ApiError && query.error.code === 'NOT_FOUND') {
      return (
        <Screen padded>
          <SetNotFound />
        </Screen>
      )
    }
    return (
      <Screen padded>
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      </Screen>
    )
  }

  if (ownerOnly && !set.isOwner) {
    return (
      <Screen padded>
        <OwnerOnlyState title={ownerOnlyTitle} description={ownerOnlyDescription} setId={set.id} />
      </Screen>
    )
  }

  return <>{children(set)}</>
}
