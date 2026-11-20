import type { ReactNode } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'

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

/** CONTRAT : surface `colors.card` bordée, arrondie ; pressable si `onPress`. Peut contenir des boutons. */
export function Card(_props: CardProps) {
  return null
}
