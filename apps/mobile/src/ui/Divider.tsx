import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native'
import { useTheme } from './theme'

export interface DividerProps {
  style?: StyleProp<ViewStyle>
}

/** CONTRAT : filet horizontal `colors.border` (1 px), ignoré par TalkBack. */
export function Divider({ style }: DividerProps) {
  const { colors } = useTheme()
  return (
    <View
      importantForAccessibility="no"
      accessibilityElementsHidden
      style={[styles.line, { backgroundColor: colors.border }, style]}
    />
  )
}

const styles = StyleSheet.create({ line: { height: 1, alignSelf: 'stretch' } })
