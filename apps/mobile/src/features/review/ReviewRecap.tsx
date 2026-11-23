import type { Rating } from '@quizlet/shared'
import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import { announce, Button, radius, spacing, Text, useTheme } from '@/ui'
import { recapAnnouncement, recapCounters, reviewedCount, reviewedLabel } from './session'

interface ReviewRecapProps {
  ratings: Record<Rating, number>
  recapBackLabel: string
  /** Hors ligne : impossible de chercher d'autres cartes. */
  online: boolean
  restarting: boolean
  onRestart: () => void
  onBack: () => void
}

export function ReviewRecap({
  ratings,
  recapBackLabel,
  online,
  restarting,
  onRestart,
  onBack,
}: ReviewRecapProps) {
  const { colors } = useTheme()
  const reviewed = reviewedCount(ratings)

  // Les boutons de note ont disparu : pas de focus DOM sur mobile, on annonce le récapitulatif.
  useEffect(() => {
    announce(recapAnnouncement(reviewed))
  }, [reviewed])

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.block}>
        <Text variant="title" accessibilityRole="header">
          Séance terminée
        </Text>
        <Text tone="muted">{reviewedLabel(reviewed)}. Chaque carte reviendra au bon moment.</Text>
      </View>
      <View style={styles.counters}>
        {recapCounters(ratings).map(({ rating, label, count }) => (
          <View
            key={rating}
            accessible
            accessibilityLabel={`${label} : ${count}`}
            style={[styles.counter, { backgroundColor: colors.muted }]}
          >
            <Text variant="caption" tone="muted" align="center">
              {label}
            </Text>
            <Text variant="title" weight="semibold" align="center">
              {String(count)}
            </Text>
          </View>
        ))}
      </View>
      <View style={styles.block}>
        <Button
          label="Chercher d'autres cartes"
          icon="rotate-ccw"
          loading={restarting}
          disabled={!online}
          fullWidth
          onPress={onRestart}
        />
        {online ? null : (
          <Text variant="caption" tone="muted" align="center">
            Hors ligne : impossible de chercher d'autres cartes.
          </Text>
        )}
        <Button variant="ghost" label={recapBackLabel} fullWidth onPress={onBack} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.xl,
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing.xl,
  },
  block: { gap: spacing.sm },
  counters: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  counter: {
    flexBasis: '47%',
    flexGrow: 1,
    gap: 2,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
})
