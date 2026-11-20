import {
  Pressable,
  Switch as RNSwitch,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native'
import { Text } from './Text'
import { useTheme } from './theme'
import { spacing } from './tokens'

export interface SwitchProps {
  label: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  /** Texte secondaire sous le libellé. */
  description?: string
  disabled?: boolean
  style?: StyleProp<ViewStyle>
  testID?: string
}

/**
 * CONTRAT : interrupteur (rôle `switch`) avec libellé, thémé. Ajout de S0-3 (absent du plan) pour
 * la bascule du rappel quotidien et les réglages.
 */
export function Switch({
  label,
  checked,
  onCheckedChange,
  description,
  disabled = false,
  style,
  testID,
}: SwitchProps) {
  const { colors } = useTheme()
  return (
    // La ligne est le seul élément accessible : l'interrupteur natif est masqué à TalkBack et
    // insensible au toucher (sinon deux cibles de focus pour une seule commande).
    <Pressable
      accessibilityRole="switch"
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
      <View style={styles.texts}>
        <Text>{label}</Text>
        {description !== undefined ? (
          <Text variant="caption" tone="muted">
            {description}
          </Text>
        ) : null}
      </View>
      {/* `pointerEvents` n'est respecté que par les vues RN, pas par l'interrupteur natif : on l'enveloppe. */}
      <View pointerEvents="none" importantForAccessibility="no-hide-descendants">
        <RNSwitch
          value={checked}
          disabled={disabled}
          trackColor={{ false: colors.outline, true: colors.primary }}
          thumbColor={checked ? colors.primaryForeground : colors.card}
          accessible={false}
        />
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 48,
    paddingVertical: spacing.xs,
  },
  texts: { flex: 1 },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.5 },
})
