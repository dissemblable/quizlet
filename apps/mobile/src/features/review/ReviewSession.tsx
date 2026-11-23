import {
  errorMessage,
  initReviewSession,
  RATINGS,
  type Rating,
  reviewReducer,
} from '@quizlet/shared'
import { useIsFocused } from 'expo-router'
import { useEffect, useReducer, useRef } from 'react'
import { StyleSheet, View } from 'react-native'
import type { QueueCard, SetDetail } from '@/lib/queries'
import { useGrade } from '@/offline'
import { announce, Button, FlipCard, ProgressBar, spacing, Text, toast } from '@/ui'
import { RatingButton } from './RatingButton'
import { ReviewRecap } from './ReviewRecap'
import { ReviewShell } from './ReviewShell'
import {
  applyGradeOutcome,
  cardAnnouncement,
  gradeAnnouncement,
  intervalLabel,
  progressPercent,
  RESTORING_HELP,
  reviewedCount,
  reviewedLabel,
  reviewTarget,
  sessionStatus,
} from './session'
import { useLeaveReview } from './use-leave-review'

interface ReviewSessionProps {
  /** Copiée dans le reducer au montage : une nouvelle file exige une nouvelle `key`. */
  cards: QueueCard[]
  set?: SetDetail
  online: boolean
  /** Restauration du cache en cours : notation suspendue. */
  restoring: boolean
  restarting: boolean
  onRestart: () => void
  /** Ligne d'info du cadre (file déduite hors ligne). */
  notice?: string
}

export function ReviewSession({
  cards,
  set,
  online,
  restoring,
  restarting,
  onRestart,
  notice,
}: ReviewSessionProps) {
  const leave = useLeaveReview(set)
  const [state, dispatch] = useReducer(
    reviewReducer<QueueCard>,
    cards,
    initReviewSession<QueueCard>,
  )
  const { grade, pending } = useGrade()
  // `pending` ne bascule qu'au rendu suivant : le verrou couvre un double appui immédiat.
  const inFlight = useRef(false)
  const current = state.queue[0]
  const reviewed = reviewedCount(state.ratings)
  const target = reviewTarget(set)
  const now = new Date()
  const announcement = current ? cardAnnouncement(current, state.flipped) : null
  const focused = useIsFocused()
  const blurred = useRef(false)
  const done = current === undefined

  // L'onglet reste monté : une séance terminée doit relire la file au retour (le web remonte la
  // page). Une séance en cours survit au changement d'onglet. Hors ligne, le récap reste affiché.
  useEffect(() => {
    if (!focused) {
      blurred.current = true
      return
    }
    if (!blurred.current) return
    blurred.current = false
    if (done && online) onRestart()
  }, [focused, done, online, onRestart])

  useEffect(() => {
    if (announcement) announce(announcement)
  }, [announcement])

  async function rate(rating: Rating) {
    if (!current || !state.flipped || pending || restoring || inFlight.current) return
    inFlight.current = true
    try {
      const outcome = await grade(current, rating)
      dispatch(applyGradeOutcome(rating, outcome))
      announce(gradeAnnouncement(rating))
    } catch (error) {
      // Refus définitif de l'API : la carte reste, on peut la renoter.
      toast.error(errorMessage(error))
    } finally {
      inFlight.current = false
    }
  }

  const footer = !current ? undefined : state.flipped ? (
    <View style={styles.rating}>
      <Text variant="caption" tone="muted" align="center" accessibilityLiveRegion="polite">
        {restoring ? RESTORING_HELP : 'Notez votre réponse'}
      </Text>
      <View style={styles.ratingButtons}>
        {RATINGS.map((rating) => (
          <RatingButton
            key={rating}
            rating={rating}
            interval={intervalLabel(state, current, rating, now)}
            disabled={pending || restoring}
            onPress={() => void rate(rating)}
          />
        ))}
      </View>
    </View>
  ) : (
    <Button
      label="Afficher la réponse"
      size="lg"
      fullWidth
      onPress={() => dispatch({ type: 'flip' })}
    />
  )

  return (
    <ReviewShell set={set} footer={footer} notice={notice}>
      <View style={styles.stats}>
        <Text variant="label" tone="muted">
          {sessionStatus(state.queue.length)}
        </Text>
        <Text variant="label" tone="muted">
          {reviewedLabel(reviewed)}
        </Text>
      </View>
      <ProgressBar
        value={progressPercent(reviewed, state.queue.length)}
        label="Progression de la séance"
      />
      {current ? (
        <FlipCard
          term={current.term}
          definition={current.definition}
          flipped={state.flipped}
          onFlip={() => dispatch({ type: 'flip' })}
        />
      ) : (
        <ReviewRecap
          ratings={state.ratings}
          recapBackLabel={target.recapBackLabel}
          online={online}
          restarting={restarting}
          onRestart={onRestart}
          onBack={leave}
        />
      )}
    </ReviewShell>
  )
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.lg },
  rating: { gap: spacing.sm },
  ratingButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
})
