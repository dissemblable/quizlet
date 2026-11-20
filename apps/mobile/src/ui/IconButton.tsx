import type { StyleProp, ViewStyle } from 'react-native'
import type { ButtonVariant } from './Button'
import type { IconName } from './Icon'

export interface IconButtonProps {
  icon: IconName
  /** Libellé d'accessibilité OBLIGATOIRE (le bouton n'a pas de texte visible). */
  label: string
  onPress: () => void
  /** Défaut : `ghost`. */
  variant?: ButtonVariant
  /** Défaut : `md` (cible tactile 44 dp). */
  size?: 'sm' | 'md'
  disabled?: boolean
  accessibilityHint?: string
  style?: StyleProp<ViewStyle>
  testID?: string
}

/** CONTRAT : bouton icône seul (`headerRight`, menus). Cible tactile ≥ 44 dp même en `sm` (`hitSlop`). */
export function IconButton(_props: IconButtonProps) {
  return null
}
