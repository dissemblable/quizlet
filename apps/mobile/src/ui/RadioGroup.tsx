import type { StyleProp, ViewStyle } from 'react-native'
import type { IconName } from './Icon'

export interface RadioOption<T extends string> {
  value: T
  label: string
  /** Texte secondaire sous le libellé (visibilité du set : « Visible par vous seul. »). */
  description?: string
  icon?: IconName
  disabled?: boolean
}

export interface RadioGroupProps<T extends string> {
  /** Légende du groupe, affichée au-dessus des options et lue par TalkBack. */
  label?: string
  value: T
  onValueChange: (value: T) => void
  options: ReadonlyArray<RadioOption<T>>
  /** `row` : options côte à côte, à la ligne si besoin (séparateurs d'import). Défaut : `column`. */
  direction?: 'column' | 'row'
  style?: StyleProp<ViewStyle>
  testID?: string
}

/** CONTRAT : groupe de boutons radio (rôle `radio`, état `selected`), une option = une ligne pressable. */
export function RadioGroup<T extends string>(_props: RadioGroupProps<T>) {
  return null
}
