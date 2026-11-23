import {
  ActivityIndicator,
  Pressable,
  type StyleProp,
  StyleSheet,
  type ViewStyle,
} from 'react-native'
import { Icon, type IconName } from './Icon'
import { buttonColors } from './palette'
import { Text } from './Text'
import { useTheme } from './theme'
import { radius, spacing } from './tokens'

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps {
  label: string
  onPress: () => void
  /** Défaut : `primary`. */
  variant?: ButtonVariant
  /** Défaut : `md` (hauteur ≥ 48 dp en `lg`, ≥ 44 dp en `md`). */
  size?: ButtonSize
  /** Icône Feather avant le libellé. */
  icon?: IconName
  /** Indicateur de chargement : le bouton ignore les appuis. */
  loading?: boolean
  disabled?: boolean
  fullWidth?: boolean
  /** Défaut : `label`. À fournir si le libellé visible est ambigu (« Modifier » → « Modifier le set »). */
  accessibilityLabel?: string
  accessibilityHint?: string
  style?: StyleProp<ViewStyle>
  testID?: string
}

// `sm` (36 dp) est complété par `hitSlop` pour atteindre la cible tactile de 44 dp.
const SIZES = {
  sm: { minHeight: 36, paddingHorizontal: spacing.md, fontSize: 14, icon: 16, hitSlop: 4 },
  md: { minHeight: 44, paddingHorizontal: spacing.lg, fontSize: 16, icon: 18, hitSlop: 0 },
  lg: { minHeight: 52, paddingHorizontal: spacing.xl, fontSize: 16, icon: 20, hitSlop: 0 },
} as const

/**
 * CONTRAT : bouton textuel (`Pressable`, rôle `button`, état désactivé / occupé annoncé à TalkBack,
 * retour visuel à l'appui, cible tactile ≥ 44 dp). `onPress` peut être asynchrone.
 * Sans `fullWidth`, le bouton épouse son contenu (`alignSelf: 'flex-start'`) ; `style` peut
 * surcharger (`alignSelf: 'center'`, `flex: 1` dans une rangée).
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  loading = false,
  disabled = false,
  fullWidth = false,
  accessibilityLabel,
  accessibilityHint,
  style,
  testID,
}: ButtonProps) {
  const { colors } = useTheme()
  const spec = SIZES[size]
  const { background, foreground, border, pressedBackground } = buttonColors(colors, variant)
  const inactive = disabled || loading

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      hitSlop={spec.hitSlop}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        {
          minHeight: spec.minHeight,
          paddingHorizontal: spec.paddingHorizontal,
          backgroundColor: pressed ? pressedBackground : background,
          borderColor: border,
        },
        fullWidth ? styles.fullWidth : styles.hug,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={foreground} />
      ) : icon !== undefined ? (
        <Icon name={icon} size={spec.icon} color={foreground} />
      ) : null}
      <Text
        variant="label"
        weight="semibold"
        style={{ color: foreground, fontSize: spec.fontSize }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.md,
  },
  fullWidth: { alignSelf: 'stretch' },
  hug: { alignSelf: 'flex-start' },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.5 },
})
