import { Pressable, StyleSheet } from 'react-native'
import { Icon, type IconName, radius, spacing, Text, useTheme } from '@/ui'

/**
 * Bouton contouré teinté (« À revoir » en ton `warning`, « Je sais » en ton `success`), propre aux
 * flashcards : `Button` de `@/ui` n'a pas de ton, ce bouton coloré reste donc local.
 */
export function ToneButton({
  label,
  icon,
  tone,
  onPress,
}: {
  label: string
  icon: IconName
  tone: 'warning' | 'success'
  onPress: () => void
}) {
  const { colors } = useTheme()
  const color = colors[tone]
  const surface = tone === 'warning' ? colors.warningSurface : colors.successSurface
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { borderColor: `${color}66`, backgroundColor: pressed ? surface : 'transparent' },
      ]}
    >
      <Icon name={icon} size={18} color={color} />
      <Text weight="medium" tone={tone}>
        {label}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
  },
})
