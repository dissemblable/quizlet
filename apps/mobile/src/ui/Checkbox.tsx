import { Pressable, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native'
import { Icon } from './Icon'
import { Text } from './Text'
import { useTheme } from './theme'
import { radius, spacing } from './tokens'

export interface CheckboxProps {
  label: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  /** Texte secondaire sous le libellé. */
  description?: string
  disabled?: boolean
  style?: StyleProp<ViewStyle>
  testID?: string
}

/** CONTRAT : case à cocher (rôle `checkbox`, état `checked` annoncé), toute la ligne est pressable. */
export function Checkbox({
  label,
  checked,
  onCheckedChange,
  description,
  disabled = false,
  style,
  testID,
}: CheckboxProps) {
  const { colors } = useTheme()
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityHint={description}
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={() => onCheckedChange(!checked)}
      testID={testID}
      style={({ pressed }) => [
        styles.row,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <View
        style={[
          styles.box,
          {
            borderColor: checked ? colors.primary : colors.outline,
            backgroundColor: checked ? colors.primary : 'transparent',
          },
        ]}
      >
        {checked ? <Icon name="check" size={16} color={colors.primaryForeground} /> : null}
      </View>
      <View style={styles.texts}>
        <Text>{label}</Text>
        {description !== undefined ? (
          <Text variant="caption" tone="muted">
            {description}
          </Text>
        ) : null}
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 44,
    paddingVertical: spacing.xs,
  },
  box: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderRadius: radius.sm,
  },
  texts: { flex: 1 },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.5 },
})
