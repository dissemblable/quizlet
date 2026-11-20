import type { StyleProp, ViewStyle } from 'react-native'

export interface ProgressBarProps {
  /** De 0 à 100 (borné par le composant). */
  value: number
  /** Libellé d'accessibilité (« Progression : 3 sur 10 »). Lu avec la valeur. */
  label: string
  style?: StyleProp<ViewStyle>
}

/** CONTRAT : barre de progression (`accessibilityRole="progressbar"`, `accessibilityValue`). */
export function ProgressBar(_props: ProgressBarProps) {
  return null
}
