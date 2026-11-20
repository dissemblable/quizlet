import { Pressable, type StyleProp, StyleSheet, type ViewStyle } from 'react-native'
import { Icon, type IconName } from './Icon'
import { Text } from './Text'
import { useTheme } from './theme'
import { radius, spacing } from './tokens'

export interface ChipProps {
  label: string
  /** Puce active (filtre appliqué) : annoncée « sélectionné » à TalkBack. */
  selected?: boolean
  onPress: () => void
  icon?: IconName
  /** Compteur affiché après le libellé (sets d'un dossier, d'un tag). */
  count?: number
  disabled?: boolean
  /** Défaut : `label` (+ compteur). */
  accessibilityLabel?: string
  style?: StyleProp<ViewStyle>
  testID?: string
}

/** CONTRAT : puce de filtre pressable (dossiers, tags), cible tactile ≥ 44 dp. */
export function Chip({
  label,
  selected = false,
  onPress,
  icon,
  count,
  disabled = false,
  accessibilityLabel,
  style,
  testID,
}: ChipProps) {
  const { colors } = useTheme()
  const foreground = selected ? colors.primaryForeground : colors.secondaryForeground
  const countColor = selected ? colors.primaryForeground : colors.mutedForeground

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        accessibilityLabel ?? (count === undefined ? label : `${label}, ${count}`)
      }
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      // 36 dp visibles + 4 dp de marge tactile de chaque côté = 44 dp.
      hitSlop={4}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: selected ? colors.primary : colors.secondary },
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      {icon !== undefined ? <Icon name={icon} size={16} color={foreground} /> : null}
      <Text variant="label" style={{ color: foreground }} numberOfLines={1}>
        {label}
      </Text>
      {count !== undefined ? (
        <Text variant="caption" style={{ color: countColor }}>
          {count}
        </Text>
      ) : null}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
  },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.5 },
})
