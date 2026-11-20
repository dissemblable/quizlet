import { initials } from '@quizlet/shared'
import { StyleSheet, View } from 'react-native'
import { Text } from './Text'
import { useTheme } from './theme'

export interface AvatarProps {
  /** Nom affiché de l'utilisateur : les initiales viennent de `initials` de `@quizlet/shared`. */
  name: string
  /** Diamètre en dp. Défaut : 40. */
  size?: number
}

/** CONTRAT : pastille d'initiales (compte). Décorative : le nom est lu à côté. */
export function Avatar({ name, size = 40 }: AvatarProps) {
  const { colors } = useTheme()
  return (
    <View
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[
        styles.disc,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.primary },
      ]}
    >
      <Text
        weight="semibold"
        allowFontScaling={false}
        style={{
          color: colors.primaryForeground,
          fontSize: Math.round(size * 0.4),
          lineHeight: size,
        }}
      >
        {initials(name)}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({ disc: { alignItems: 'center', justifyContent: 'center' } })
