import type { ReactNode } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import type { IconName } from './Icon'

export interface ListItemProps {
  title: string
  subtitle?: string
  /** Icône Feather à gauche. */
  icon?: IconName
  /** Élément à droite (badge, valeur). Remplace le chevron. */
  right?: ReactNode
  /** Ligne choisie (liste de fuseaux, dossier courant) : coche à droite, annoncée « sélectionné ». */
  selected?: boolean
  /** Titre en rouge (suppression, déconnexion). */
  destructive?: boolean
  /** Chevron à droite si la ligne est pressable et sans `right` (défaut : true). */
  showChevron?: boolean
  /** Présent : ligne pressable (rôle `button`). */
  onPress?: () => void
  disabled?: boolean
  accessibilityLabel?: string
  accessibilityHint?: string
  style?: StyleProp<ViewStyle>
  testID?: string
}

/**
 * CONTRAT : ligne de liste (compte, paramètres, « Déplacer vers… », fuseaux). Ajout de S0-3 (absent
 * du plan) : évite que chaque lot réécrive une ligne pressable avec sa propre accessibilité.
 */
export function ListItem(_props: ListItemProps) {
  return null
}
