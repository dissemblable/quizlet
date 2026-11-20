import type { TextProps as RNTextProps, StyleProp, TextStyle } from 'react-native'

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

/**
 * CONTRAT : texte thémé (`react-native` `Text` + couleurs de `useTheme`). Accepte toutes les props
 * de `Text` (`numberOfLines`, `selectable`, `onPress`, `accessibilityRole="header"`…). Respecte la
 * taille de police du système (`allowFontScaling`).
 */
export function Text(_props: TextProps) {
  return null
}
