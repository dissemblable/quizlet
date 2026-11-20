import {
  Text as RNText,
  type TextProps as RNTextProps,
  type StyleProp,
  type TextStyle,
} from 'react-native'
import { textColor } from './palette'
import { useTheme } from './theme'
import { fontSize } from './tokens'

/** display 30 · title 24 · heading 18 · body 16 · label 14 (moyen) · caption 12. */
export type TextVariant = 'display' | 'title' | 'heading' | 'body' | 'label' | 'caption'
/** `inverse` : couleur de texte sur fond `primary`. */
export type TextTone =
  | 'default'
  | 'muted'
  | 'primary'
  | 'destructive'
  | 'success'
  | 'warning'
  | 'info'
  | 'inverse'
export type TextWeight = 'regular' | 'medium' | 'semibold' | 'bold'

export interface TextProps extends Omit<RNTextProps, 'style'> {
  /** Défaut : `body`. */
  variant?: TextVariant
  /** Défaut : `default`. */
  tone?: TextTone
  /** Défaut : celui de la variante. */
  weight?: TextWeight
  align?: 'left' | 'center' | 'right'
  /** Police à chasse fixe (séparateurs, identifiants). */
  monospace?: boolean
  style?: StyleProp<TextStyle>
}

const VARIANTS: Record<TextVariant, { size: number; lineHeight: number; weight: TextWeight }> = {
  display: { size: fontSize['3xl'], lineHeight: 38, weight: 'bold' },
  title: { size: fontSize['2xl'], lineHeight: 32, weight: 'semibold' },
  heading: { size: fontSize.lg, lineHeight: 26, weight: 'semibold' },
  body: { size: fontSize.base, lineHeight: 24, weight: 'regular' },
  label: { size: fontSize.sm, lineHeight: 20, weight: 'medium' },
  caption: { size: fontSize.xs, lineHeight: 16, weight: 'regular' },
}

const WEIGHTS: Record<TextWeight, TextStyle['fontWeight']> = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
}

/**
 * CONTRAT : texte thémé (`react-native` `Text` + couleurs de `useTheme`). Accepte toutes les props
 * de `Text` (`numberOfLines`, `selectable`, `onPress`, `accessibilityRole="header"`…). Respecte la
 * taille de police du système (`allowFontScaling`).
 */
export function Text({
  variant = 'body',
  tone = 'default',
  weight,
  align,
  monospace = false,
  style,
  ...props
}: TextProps) {
  const { colors } = useTheme()
  const spec = VARIANTS[variant]
  return (
    <RNText
      {...props}
      style={[
        {
          color: textColor(colors, tone),
          fontSize: spec.size,
          lineHeight: spec.lineHeight,
          fontWeight: WEIGHTS[weight ?? spec.weight],
        },
        align !== undefined && { textAlign: align },
        monospace && { fontFamily: 'monospace' },
        style,
      ]}
    />
  )
}
