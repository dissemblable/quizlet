import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native'
import { clampPercent } from './logic'
import { useTheme } from './theme'
import { radius } from './tokens'

export interface ProgressBarProps {
  /** De 0 à 100 (borné par le composant). */
  value: number
  /** Libellé d'accessibilité (« Progression : 3 sur 10 »). Lu avec la valeur. */
  label: string
  style?: StyleProp<ViewStyle>
}

/** CONTRAT : barre de progression (`accessibilityRole="progressbar"`, `accessibilityValue`). */
export function ProgressBar({ value, label, style }: ProgressBarProps) {
  const { colors } = useTheme()
  const percent = clampPercent(value)
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(percent) }}
      style={[styles.track, { backgroundColor: colors.muted }, style]}
    >
      <View style={[styles.fill, { width: `${percent}%`, backgroundColor: colors.primary }]} />
    </View>
  )
}

const styles = StyleSheet.create({
  track: { height: 8, borderRadius: radius.full, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.full },
})
