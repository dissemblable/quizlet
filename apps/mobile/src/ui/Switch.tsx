import type { StyleProp, ViewStyle } from 'react-native'

export interface SwitchProps {
  label: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  /** Texte secondaire sous le libellé. */
  description?: string
  disabled?: boolean
  style?: StyleProp<ViewStyle>
  testID?: string
}

/**
 * CONTRAT : interrupteur (rôle `switch`) avec libellé, thémé. Ajout de S0-3 (absent du plan) pour
 * la bascule du rappel quotidien et les réglages.
 */
export function Switch(_props: SwitchProps) {
  return null
}
