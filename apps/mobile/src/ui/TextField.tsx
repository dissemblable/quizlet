import type { ReactNode, Ref } from 'react'
import type { StyleProp, TextInput, TextInputProps, TextStyle, ViewStyle } from 'react-native'
import type { IconName } from './Icon'

export interface TextFieldProps
  extends Omit<
    TextInputProps,
    | 'style'
    | 'value'
    | 'onChangeText'
    | 'multiline'
    | 'maxLength'
    | 'numberOfLines'
    | 'placeholderTextColor'
    | 'selectionColor'
  > {
  /** Libellé affiché au-dessus du champ ET lu par TalkBack. */
  label: string
  /** Libellé lu par TalkBack mais non affiché (champs de recherche, réponse du mode écrit). */
  labelHidden?: boolean
  value: string
  onChangeText: (text: string) => void
  /** Message d'erreur (rouge, annoncé) ; le champ passe en erreur. */
  error?: string
  /** Aide sous le champ (masquée tant qu'il y a une erreur). */
  helper?: string
  multiline?: boolean
  /** Hauteur minimale en lignes (champ multiligne). */
  minLines?: number
  maxLength?: number
  /** Compteur « 12 / 200 » sous le champ (nécessite `maxLength`). */
  showCounter?: boolean
  /** Ref du `TextInput` (focus programmatique). `onBlur` et `onFocus` sont ceux de `TextInputProps` (RHF `Controller`). */
  inputRef?: Ref<TextInput>
  /** Icône Feather à gauche (loupe de recherche). */
  icon?: IconName
  /** Élément à droite dans le champ (bouton « effacer »). */
  right?: ReactNode
  /** Police à chasse fixe (séparateurs). */
  monospace?: boolean
  /** Style du conteneur (libellé + champ + messages). */
  style?: StyleProp<ViewStyle>
  /** Style du `TextInput` seul. */
  inputStyle?: StyleProp<TextStyle>
}

/**
 * CONTRAT : champ de saisie thémé (libellé, aide, erreur, compteur). Toutes les props de
 * `TextInput` passent (`placeholder`, `keyboardType`, `autoCapitalize`, `autoFocus`,
 * `returnKeyType`, `onSubmitEditing`, `editable`, `onBlur`…).
 */
export function TextField(_props: TextFieldProps) {
  return null
}
