import type { StyleProp, ViewStyle } from 'react-native'

export interface DividerProps {
  style?: StyleProp<ViewStyle>
}

/** CONTRAT : filet horizontal `colors.border` (1 px), ignoré par TalkBack. */
export function Divider(_props: DividerProps) {
  return null
}
