import { errorMessage } from '@quizlet/shared'
import { useQueryClient } from '@tanstack/react-query'
import { useIsFocused, useRouter } from 'expo-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { SetGate } from '@/features/common'
import { type QueueCard, queryKeys, type SetDetail, useReviewQueue } from '@/lib/queries'
import { routes } from '@/lib/routes'
import { useIdParam } from '@/lib/use-id-param'
import { useEffectiveCards, useOfflineStatus } from '@/offline'
import { Button, EmptyState, ErrorState, LoadingState, spacing, toast } from '@/ui'
import { ReviewSession } from './ReviewSession'
import { ReviewShell } from './ReviewShell'
import { DERIVED_QUEUE_NOTICE, deriveSetQueue, reviewQueueView } from './session'
import { useLeaveReview } from './use-leave-review'

/**
 * Révision FSRS. Sans `id` (onglet `/review`) : tous les sets ; avec `id` (`/sets/[id]/review`) :
 * un seul set, derrière `SetGate`.
 */
export function ReviewScreen() {
  const id = useIdParam() || undefined
  if (id) return <SetGate id={id}>{(set) => <ReviewLoader set={set} />}</SetGate>
  return <ReviewLoader />
}

function ReviewLoader({ set }: { set?: SetDetail }) {
  const router = useRouter()
  const leave = useLeaveReview(set)
  const queryClient = useQueryClient()
  const { online, restoring } = useOfflineStatus()
  const queue = useReviewQueue(set?.id)
  // Hors ligne, sans file du set en cache : on la déduit de l'instantané « tous les sets ».
  const snapshot =
    set && queue.data === undefined && !online
      ? queryClient.getQueryData<{ cards: QueueCard[] }>(queryKeys.reviewQueue())
      : undefined
  const derived = useMemo(() => set && deriveSetQueue(snapshot, set.id), [snapshot, set])
  const cards = queue.data?.cards ?? derived
  // Retire les cartes dont la note est déjà en attente d'envoi.
  const effective = useEffectiveCards(cards)
  // La file figée vient-elle de l'instantané ? (pour la ligne d'info)
  const fromSnapshot = useRef(false)
  const [attempt, setAttempt] = useState(0)
  const [restarting, setRestarting] = useState(false)
  // File de la séance, copiée une fois prête : ni un rafraîchissement, ni une note ne la modifient.
  const frozen = useRef<QueueCard[] | null>(null)
  const focused = useIsFocused()
  const blurred = useRef(false)
  const { refetch } = queue

  // L'onglet reste monté : un « Rien à réviser » figé (ou le retour de « Modifier mes limites »)
  // ne se rouvrirait jamais. Une séance en cours, elle, survit au changement d'onglet.
  useEffect(() => {
    if (!focused) {
      blurred.current = true
      return
    }
    if (!blurred.current) return
    blurred.current = false
    if (frozen.current?.length !== 0) return
    frozen.current = null
    setAttempt((value) => value + 1)
    void refetch()
  }, [focused, refetch])

  const view = reviewQueueView({
    hasData: cards !== undefined,
    isPending: queue.isPending,
    isError: queue.isError,
    fetchStatus: queue.fetchStatus,
  })
  if (frozen.current === null && view === 'ready' && effective !== undefined) {
    frozen.current = effective
    fromSnapshot.current = queue.data === undefined
  }

  async function restart() {
    setRestarting(true)
    try {
      const result = await queue.refetch()
      if (result.isError) {
        toast.error(errorMessage(result.error))
        return
      }
      // Nouvelle séance : la file fraîche est copiée au prochain rendu, avec une nouvelle `key`.
      frozen.current = null
      setAttempt((value) => value + 1)
    } finally {
      setRestarting(false)
    }
  }

  const notice = fromSnapshot.current ? DERIVED_QUEUE_NOTICE : undefined

  if (frozen.current !== null) {
    if (frozen.current.length > 0) {
      return (
        <ReviewSession
          key={attempt}
          cards={frozen.current}
          set={set}
          online={online}
          restoring={restoring}
          notice={notice}
          restarting={restarting}
          onRestart={() => void restart()}
        />
      )
    }
    return (
      <ReviewShell set={set} notice={notice}>
        <EmptyState
          icon="calendar"
          title="Rien à réviser pour le moment"
          description="Les cartes dues et les nouvelles cartes du jour (selon vos limites quotidiennes) ont toutes été vues. Revenez plus tard."
          action={
            <View style={styles.actions}>
              <Button variant="outline" label="Retour" onPress={leave} />
              <Button
                variant="ghost"
                label="Modifier mes limites"
                onPress={() => router.push(routes.settings)}
              />
            </View>
          }
        />
      </ReviewShell>
    )
  }

  return (
    <ReviewShell set={set}>
      {view === 'offline' ? (
        <EmptyState
          icon="wifi-off"
          title="Données indisponibles hors ligne"
          description="Ce contenu n'a pas encore été chargé sur cet appareil."
        />
      ) : view === 'error' ? (
        <ErrorState error={queue.error} onRetry={() => void queue.refetch()} />
      ) : (
        <LoadingState label="Préparation de la révision…" rows={2} />
      )}
    </ReviewShell>
  )
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm },
})
