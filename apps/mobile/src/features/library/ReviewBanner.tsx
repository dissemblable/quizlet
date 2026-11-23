import { StyleSheet, View } from 'react-native'
import type { ReviewSummary } from '@/lib/queries'
import { Button, Card, spacing, Text } from '@/ui'
import { hasReviewWork, reviewSummaryText } from './messages'

interface ReviewBannerProps {
  /** `undefined` tant que les compteurs ne sont pas chargés : rien n'est affiché. */
  summary: ReviewSummary | undefined
  onReview: () => void
}

/** Accueil : cartes de la révision du jour et accès direct à la séance. */
export function ReviewBanner({ summary, onReview }: ReviewBannerProps) {
  if (!summary) return null
  const { due, new: fresh } = summary

  return (
    <Card>
      <View style={styles.row}>
        <View style={styles.text}>
          <Text variant="heading" weight="semibold" accessibilityRole="header">
            Révision du jour
          </Text>
          <Text variant="label" tone="muted">
            {reviewSummaryText(due, fresh)}
          </Text>
        </View>
        {hasReviewWork(due, fresh) ? (
          <Button label="Réviser" icon="layers" onPress={onReview} />
        ) : null}
      </View>
    </Card>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  text: { flexShrink: 1, gap: spacing.xs },
})
