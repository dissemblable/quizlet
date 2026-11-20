import type { Rating } from '@quizlet/shared'
import { RATING_LABELS } from '@quizlet/shared'
import { Pressable, StyleSheet } from 'react-native'
import { radius, ratingColor, spacing, Text, useTheme } from '@/ui'
import { ratingAccessibilityLabel } from './session'

interface RatingButtonProps {
  rating: Rating
  /** Intervalle prévu (« 10 min », « 3 j »), ou `null` s'il est périmé. */
  interval: string | null
  disabled: boolean
  onPress: () => void
}

// Local : `Button` de `@/ui` n'a ni couleur par note ni second libellé (besoin signalé au lot C).
export function RatingButton({ rating, interval, disabled, onPress }: RatingButtonProps) {
  const { colors } = useTheme()
  const tint = ratingColor(colors, rating)
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={ratingAccessibilityLabel(rating, interval)}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          borderColor: `${tint}66`,
          backgroundColor: pressed ? `${tint}1a` : colors.card,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      <Text variant="label" weight="semibold" align="center" style={{ color: tint }}>
        {RATING_LABELS[rating]}
      </Text>
      {interval === null ? null : (
        <Text variant="caption" tone="muted" align="center">
          {interval}
        </Text>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: {
    flexBasis: '47%',
    flexGrow: 1,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
})
