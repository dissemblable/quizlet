import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { Text } from './Text'
import { useTheme } from './theme'
import { radius, spacing } from './tokens'

export interface LoadingStateProps {
  /** Texte annoncé à TalkBack (et affiché sous l'indicateur). Défaut : « Chargement… ». */
  label?: string
  /** Nombre de lignes de squelette (si le composant en dessine). Défaut : 3. */
  rows?: number
}

const WIDTHS = ['100%', '88%', '72%'] as const

/** CONTRAT : état de chargement d'une page (`accessibilityLiveRegion="polite"`, `aria-busy`). */
export function LoadingState({ label = 'Chargement…', rows = 3 }: LoadingStateProps) {
  const { colors } = useTheme()
  return (
    <View
      accessible
      accessibilityLabel={label}
      accessibilityLiveRegion="polite"
      accessibilityState={{ busy: true }}
      style={styles.root}
    >
      <View style={styles.indicator}>
        <ActivityIndicator color={colors.primary} />
        <Text variant="label" tone="muted">
          {label}
        </Text>
      </View>
      <View style={[styles.bar, styles.title, { backgroundColor: colors.muted }]} />
      {Array.from({ length: rows }, (_, index) => (
        <View
          // biome-ignore lint/suspicious/noArrayIndexKey: squelettes statiques, jamais réordonnés
          key={index}
          style={[
            styles.bar,
            styles.row,
            { backgroundColor: colors.muted, width: WIDTHS[index % 3] },
          ]}
        />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { gap: spacing.lg, padding: spacing.lg },
  indicator: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  bar: { borderRadius: radius.md },
  title: { height: 32, width: '50%' },
  row: { height: 80 },
})
