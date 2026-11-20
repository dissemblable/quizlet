import { Pressable, type StyleProp, StyleSheet, type ViewStyle } from 'react-native'
import type { ButtonVariant } from './Button'
import { Icon, type IconName } from './Icon'
import { buttonColors } from './palette'
import { useTheme } from './theme'
import { radius } from './tokens'

export interface IconButtonProps {
  icon: IconName
  /** Libellé d'accessibilité OBLIGATOIRE (le bouton n'a pas de texte visible). */
  label: string
  onPress: () => void
  /** Défaut : `ghost`. */
  variant?: ButtonVariant
  /** Défaut : `md` (cible tactile 44 dp). */
  size?: 'sm' | 'md'
  disabled?: boolean
  accessibilityHint?: string
  style?: StyleProp<ViewStyle>
  testID?: string
}

// `sm` (36 dp) est complété par `hitSlop` pour garder une cible tactile de 44 dp.
const SIZES = {
  sm: { box: 36, icon: 18, hitSlop: 4 },
  md: { box: 44, icon: 22, hitSlop: 0 },
} as const

/** CONTRAT : bouton icône seul (`headerRight`, menus). Cible tactile ≥ 44 dp même en `sm` (`hitSlop`). */
export function IconButton({
  icon,
  label,
  onPress,
  variant = 'ghost',
  size = 'md',
  disabled = false,
  accessibilityHint,
  style,
  testID,
}: IconButtonProps) {
  const { colors } = useTheme()
  const spec = SIZES[size]
  const { background, foreground, border, pressedBackground } = buttonColors(colors, variant)

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={spec.hitSlop}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        {
          width: spec.box,
          height: spec.box,
          backgroundColor: pressed ? pressedBackground : background,
          borderColor: border,
        },
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Icon name={icon} size={spec.icon} color={foreground} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: radius.full,
  },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.5 },
})
