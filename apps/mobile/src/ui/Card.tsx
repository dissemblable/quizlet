import type { ReactNode } from 'react'
import { Pressable, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native'
import { cardColors } from './palette'
import { useTheme } from './theme'
import { radius, spacing } from './tokens'

export type CardTone = 'default' | 'primary' | 'success' | 'destructive'

export interface CardProps {
  children?: ReactNode
  /** Présent : la carte est pressable (rôle `button`, retour visuel). Absent : simple conteneur. */
  onPress?: () => void
  /** Bordure et fond teintés (réponse juste / fausse d'un quiz, élément sélectionné). */
  tone?: CardTone
  selected?: boolean
  disabled?: boolean
  /** Marges internes (`spacing.lg`). Défaut : true. */
  padded?: boolean
  /** Lu à la place du contenu par TalkBack (si pressable). */
  accessibilityLabel?: string
  accessibilityHint?: string
  style?: StyleProp<ViewStyle>
  testID?: string
}

/**
 * CONTRAT : surface `colors.card` bordée, arrondie ; pressable si `onPress`. Une carte pressable
 * n'imbrique pas de bouton (un seul élément focusable pour TalkBack) : le bouton va en frère, à côté.
 * Sans `onPress`, elle peut contenir des boutons.
 */
export function Card({
  children,
  onPress,
  tone = 'default',
  selected = false,
  disabled = false,
  padded = true,
  accessibilityLabel,
  accessibilityHint,
  style,
  testID,
}: CardProps) {
  const { colors } = useTheme()
  const { background, border, borderWidth } = cardColors(colors, tone, selected)
  const base = [
    styles.card,
    {
      backgroundColor: background,
      borderColor: border,
      borderWidth,
      // La bordure épaisse (2) d'une carte teintée ne doit pas décaler le contenu.
      padding: padded ? spacing.lg - (borderWidth - 1) : 0,
    },
    disabled && styles.disabled,
  ]

  if (onPress === undefined) {
    return (
      <View style={[base, style]} testID={testID}>
        {children}
      </View>
    )
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [base, pressed && styles.pressed, style]}
    >
      {children}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.5 },
})
