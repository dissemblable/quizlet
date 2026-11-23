import { currentCardId, flashcardsReducer, initFlashcards, progressOf } from '@quizlet/shared'
import { Stack } from 'expo-router'
import { useMemo, useReducer } from 'react'
import { StyleSheet, View } from 'react-native'
import { SetGate } from '@/features/common'
import type { SetDetail } from '@/lib/queries'
import { useIdParam } from '@/lib/use-id-param'
import { Badge, Button, Chip, FlipCard, Screen, spacing } from '@/ui'
import { FlashcardsRecap } from './FlashcardsRecap'
import {
  countsLabel,
  faceAnnouncement,
  markLabel,
  positionLabel,
  recapAnnouncement,
} from './flashcards-view'
import { NoCards } from './NoCards'
import { SessionProgress } from './SessionProgress'
import { ToneButton } from './ToneButton'
import { useAnnounce } from './use-announce'

/** Flashcards d'un set : fonctionne hors ligne depuis le détail de set en cache. */
export function FlashcardsScreen() {
  const id = useIdParam()
  return (
    <SetGate id={id}>
      {(set) =>
        set.cards.length === 0 ? (
          <NoCards setId={set.id} />
        ) : (
          <FlashcardsSession key={set.id} set={set} />
        )
      }
    </SetGate>
  )
}

function FlashcardsSession({ set }: { set: SetDetail }) {
  const [state, dispatch] = useReducer(
    flashcardsReducer,
    set.cards.map((card) => card.id),
    initFlashcards,
  )
  const cardsById = useMemo(() => new Map(set.cards.map((card) => [card.id, card])), [set.cards])
  const progress = progressOf(state)
  const currentId = currentCardId(state)
  const current = currentId ? cardsById.get(currentId) : undefined
  const currentMark = currentId ? state.marks[currentId] : undefined

  // Face visible à chaque changement de carte ou retournement ; rien au montage.
  useAnnounce(
    state.finished
      ? recapAnnouncement(progress.total)
      : current
        ? faceAnnouncement(current, state.flipped)
        : null,
    true,
  )

  return (
    <Screen scroll padded>
      <Stack.Screen options={{ title: `Flashcards · ${set.title}` }} />
      <View style={styles.page}>
        <View style={styles.toolbar}>
          <Chip
            label="Mélanger"
            icon="shuffle"
            selected={state.shuffled}
            onPress={() => dispatch({ type: 'toggleShuffle' })}
          />
        </View>

        <SessionProgress
          left={positionLabel(progress, state.finished)}
          right={countsLabel(progress)}
          percent={progress.percent}
          label="Progression de la session"
        />

        {state.finished || !current ? (
          <FlashcardsRecap
            state={state}
            cards={set.cards}
            setId={set.id}
            onRestart={(onlyReview) => dispatch({ type: 'restart', onlyReview })}
          />
        ) : (
          <>
            <FlipCard
              term={current.term}
              definition={current.definition}
              flipped={state.flipped}
              onFlip={() => dispatch({ type: 'flip' })}
            />
            <View style={styles.markRow}>
              {currentMark && (
                <Badge
                  label={markLabel(currentMark)}
                  tone={currentMark === 'known' ? 'secondary' : 'outline'}
                />
              )}
            </View>

            <View style={styles.navRow}>
              <Button
                label="Précédente"
                variant="outline"
                icon="arrow-left"
                disabled={state.index === 0}
                style={styles.navButton}
                onPress={() => dispatch({ type: 'previous' })}
              />
              <Button
                label="Retourner"
                variant="outline"
                icon="refresh-cw"
                style={styles.navButton}
                onPress={() => dispatch({ type: 'flip' })}
              />
              <Button
                label="Suivante"
                variant="outline"
                icon="arrow-right"
                style={styles.navButton}
                onPress={() => dispatch({ type: 'next' })}
              />
            </View>
            <View style={styles.markButtons}>
              <ToneButton
                label="À revoir"
                icon="corner-up-left"
                tone="warning"
                onPress={() => dispatch({ type: 'mark', mark: 'review' })}
              />
              <ToneButton
                label="Je sais"
                icon="check"
                tone="success"
                onPress={() => dispatch({ type: 'mark', mark: 'known' })}
              />
            </View>
          </>
        )}
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  page: { gap: spacing.lg },
  toolbar: { flexDirection: 'row', justifyContent: 'flex-end' },
  markRow: { minHeight: 28, alignItems: 'center', justifyContent: 'center' },
  // Les trois boutons passent à la ligne si l'écran (ou la taille de police) est trop étroit.
  navRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  navButton: { flexGrow: 1, flexBasis: 96 },
  markButtons: { flexDirection: 'row', gap: spacing.sm },
})
