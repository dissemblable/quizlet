import { type FlashcardsState, progressOf, reviewIds } from '@quizlet/shared'
import { StyleSheet, View } from 'react-native'
import type { SetDetail } from '@/lib/queries'
import { Button, Card, radius, spacing, Text, useTheme } from '@/ui'
import { BackToSetButton } from './BackToSetButton'
import { pickCards, recapSubtitle, reviewAgainLabel } from './flashcards-view'
import { ResultList, ResultRow } from './ResultList'

/** Récapitulatif de fin de session : compteurs, cartes à revoir, relance. */
export function FlashcardsRecap({
  state,
  cards,
  setId,
  onRestart,
}: {
  state: FlashcardsState
  cards: SetDetail['cards']
  setId: string
  /** `onlyReview` : repartir des seules cartes marquées « À revoir ». */
  onRestart: (onlyReview: boolean) => void
}) {
  const { colors } = useTheme()
  const { known, review, unmarked, total } = progressOf(state)
  // shortcut: liste dépliée dans le ScrollView, sans virtualisation ; une FlatList si des
  // centaines de cartes « à revoir » deviennent courantes.
  const toReview = pickCards(reviewIds(state), cards)

  return (
    <Card>
      <View style={styles.root}>
        <View>
          <Text variant="heading" weight="semibold" accessibilityRole="header">
            Session terminée
          </Text>
          <Text variant="label" tone="muted">
            {recapSubtitle(total)}
          </Text>
        </View>

        <View style={styles.stats}>
          <Stat label="Je sais" value={known} background={colors.successSurface} tone="success" />
          <Stat label="À revoir" value={review} background={colors.warningSurface} tone="warning" />
          <Stat label="Non marquées" value={unmarked} background={colors.muted} tone="default" />
        </View>

        {toReview.length > 0 && (
          <View style={styles.toReview}>
            <Text variant="label" weight="medium" accessibilityRole="header">
              Cartes à revoir
            </Text>
            <ResultList>
              {toReview.map((card, index) => (
                <ResultRow key={card.id} first={index === 0}>
                  <Text variant="label" weight="medium">
                    {card.term}
                  </Text>
                  <Text variant="label" tone="muted">
                    {card.definition}
                  </Text>
                </ResultRow>
              ))}
            </ResultList>
          </View>
        )}

        <View style={styles.actions}>
          {review > 0 && (
            <Button
              label={reviewAgainLabel(review)}
              icon="corner-up-left"
              fullWidth
              onPress={() => onRestart(true)}
            />
          )}
          <Button
            label="Recommencer"
            variant="outline"
            icon="rotate-ccw"
            fullWidth
            onPress={() => onRestart(false)}
          />
          <BackToSetButton setId={setId} />
        </View>
      </View>
    </Card>
  )
}

function Stat({
  label,
  value,
  background,
  tone,
}: {
  label: string
  value: number
  background: string
  tone: 'success' | 'warning' | 'default'
}) {
  return (
    <View
      accessible
      accessibilityLabel={`${label} : ${value}`}
      style={[styles.stat, { backgroundColor: background }]}
    >
      <Text variant="caption" tone="muted" align="center">
        {label}
      </Text>
      <Text variant="title" weight="semibold" tone={tone} align="center">
        {String(value)}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { gap: spacing.lg },
  stats: { flexDirection: 'row', gap: spacing.md },
  stat: { flex: 1, padding: spacing.md, borderRadius: radius.lg },
  toReview: { gap: spacing.sm },
  actions: { gap: spacing.sm },
})
