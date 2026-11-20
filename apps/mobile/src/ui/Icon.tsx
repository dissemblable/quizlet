import type Feather from '@expo/vector-icons/Feather'
import type { ComponentProps } from 'react'
import type { ColorValue, StyleProp, TextStyle } from 'react-native'

/** Nom d'une icône Feather (vérifié par le compilateur). */
export type IconName = ComponentProps<typeof Feather>['name']

export interface IconProps {
  name: IconName
  /** Défaut : 20. */
  size?: number
  /** Défaut : `colors.foreground`. Accepte le `color` de `tabBarIcon` (`ColorValue`). */
  color?: ColorValue
  style?: StyleProp<TextStyle>
}

/**
 * CONTRAT : icône Feather (`@expo/vector-icons/Feather`), DÉCORATIVE : masquée à TalkBack
 * (`importantForAccessibility="no"`). Le libellé vient du bouton ou de la ligne qui la contient.
 */
export function Icon(_props: IconProps) {
  return null
}
