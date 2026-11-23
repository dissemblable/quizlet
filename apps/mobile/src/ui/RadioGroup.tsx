import { Pressable, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native'
import { Icon, type IconName } from './Icon'
import { Text } from './Text'
import { useTheme } from './theme'
import { spacing } from './tokens'

export interface RadioOption<T extends string> {
  value: T
  label: string
  /** Texte secondaire sous le libellé (visibilité du set : « Visible par vous seul. »). */
  description?: string
  icon?: IconName
  disabled?: boolean
}

export interface RadioGroupProps<T extends string> {
  /** Légende du groupe, affichée au-dessus des options et lue par TalkBack. */
  label?: string
  value: T
  onValueChange: (value: T) => void
  options: ReadonlyArray<RadioOption<T>>
  /** `row` : options côte à côte, à la ligne si besoin (séparateurs d'import). Défaut : `column`. */
  direction?: 'column' | 'row'
  style?: StyleProp<ViewStyle>
  testID?: string
}

/** CONTRAT : groupe de boutons radio (rôle `radio`, état `selected`), une option = une ligne pressable. */
export function RadioGroup<T extends string>({
  label,
  value,
  onValueChange,
  options,
  direction = 'column',
  style,
  testID,
}: RadioGroupProps<T>) {
  const { colors } = useTheme()
  return (
    <View accessibilityRole="radiogroup" testID={testID} style={[styles.group, style]}>
      {label !== undefined ? <Text variant="label">{label}</Text> : null}
      <View style={direction === 'row' ? styles.row : styles.column}>
        {options.map((option) => {
          const selected = option.value === value
          const disabled = option.disabled === true
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityLabel={option.label}
              accessibilityHint={option.description}
              // TalkBack annonce les boutons radio par `checked` ; `selected` suit le contrat.
              accessibilityState={{ checked: selected, selected, disabled }}
              disabled={disabled}
              onPress={() => onValueChange(option.value)}
              style={({ pressed }) => [
                styles.option,
                pressed && styles.pressed,
                disabled && styles.disabled,
              ]}
            >
              <View
                style={[styles.circle, { borderColor: selected ? colors.primary : colors.outline }]}
              >
                {selected ? (
                  <View style={[styles.dot, { backgroundColor: colors.primary }]} />
                ) : null}
              </View>
              {option.icon !== undefined ? (
                <Icon name={option.icon} size={18} color={colors.mutedForeground} />
              ) : null}
              <View style={styles.texts}>
                <Text>{option.label}</Text>
                {option.description !== undefined ? (
                  <Text variant="caption" tone="muted">
                    {option.description}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  group: { gap: spacing.xs },
  column: {},
  row: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.lg },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 44,
    paddingVertical: spacing.xs,
  },
  circle: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderRadius: 12,
  },
  dot: { width: 12, height: 12, borderRadius: 6 },
  texts: { flexShrink: 1 },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.5 },
})
