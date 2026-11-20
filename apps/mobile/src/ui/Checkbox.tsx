import type { StyleProp, ViewStyle } from 'react-native'

export interface CheckboxProps {
  label: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  /** Texte secondaire sous le libellé. */
  description?: string
  disabled?: boolean
  style?: StyleProp<ViewStyle>
  testID?: string
}

/** CONTRAT : case à cocher (rôle `checkbox`, état `checked` annoncé), toute la ligne est pressable. */
export function Checkbox(_props: CheckboxProps) {
  return null
}
