import type { StyleProp, ViewStyle } from 'react-native'
import type { IconName } from './Icon'

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

/**
 * CONTRAT : bouton textuel (`Pressable`, rôle `button`, état désactivé / occupé annoncé à TalkBack,
 * retour visuel à l'appui, cible tactile ≥ 44 dp). `onPress` peut être asynchrone.
 */
export function Button(_props: ButtonProps) {
  return null
}
