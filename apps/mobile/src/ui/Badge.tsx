import type { StyleProp, ViewStyle } from 'react-native'
import type { IconName } from './Icon'

/** `secondary` : fond neutre ; `outline` : contour seul ; les autres : teinte à 10 %. */
export type BadgeTone =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'success'
  | 'warning'
  | 'info'
  | 'destructive'

export interface BadgeProps {
  label: string
  /** Défaut : `secondary`. */
  tone?: BadgeTone
  icon?: IconName
  style?: StyleProp<ViewStyle>
}

/** CONTRAT : pastille d'état (visibilité, compteur). Texte lu tel quel, icône décorative. */
export function Badge(_props: BadgeProps) {
  return null
}
