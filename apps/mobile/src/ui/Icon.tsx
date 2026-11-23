import Feather from '@expo/vector-icons/Feather'
import type { ComponentProps } from 'react'
import type { ColorValue, StyleProp, TextStyle } from 'react-native'
import { useTheme } from './theme'

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
 * La police est chargée par le layout racine (`useFonts(Feather.font)`).
 */
export function Icon({ name, size = 20, color, style }: IconProps) {
  const { colors } = useTheme()
  return (
    <Feather
      name={name}
      size={size}
      style={[{ color: color ?? colors.foreground }, style]}
      // Une icône ne doit pas grossir avec la taille de police : elle déborderait de son bouton.
      allowFontScaling={false}
      importantForAccessibility="no"
      accessibilityElementsHidden
    />
  )
}
