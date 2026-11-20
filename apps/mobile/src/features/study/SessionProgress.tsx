import { StyleSheet, View } from 'react-native'
import { ProgressBar, spacing, Text } from '@/ui'

/** En-tête d'une séance : position à gauche, compteurs à droite, barre de progression. */
export function SessionProgress({
  left,
  right,
  percent,
  label,
}: {
  left: string
  right: string
  percent: number
  label: string
}) {
  return (
    <View style={styles.root}>
      <View style={styles.row}>
        <Text variant="label" tone="muted">
          {left}
        </Text>
        <Text variant="label" tone="muted">
          {right}
        </Text>
      </View>
      <ProgressBar value={percent} label={label} />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { gap: spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: spacing.md },
})
