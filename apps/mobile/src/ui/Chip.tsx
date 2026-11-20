import type { StyleProp, ViewStyle } from 'react-native'
import type { IconName } from './Icon'

export interface ChipProps {
  label: string
  /** Puce active (filtre appliqué) : annoncée « sélectionné » à TalkBack. */
  selected?: boolean
  onPress: () => void
  icon?: IconName
  /** Compteur affiché après le libellé (sets d'un dossier, d'un tag). */
  count?: number
  disabled?: boolean
  /** Défaut : `label` (+ compteur). */
  accessibilityLabel?: string
  style?: StyleProp<ViewStyle>
  testID?: string
}

/** CONTRAT : puce de filtre pressable (dossiers, tags), cible tactile ≥ 44 dp. */
export function Chip(_props: ChipProps) {
  return null
}
