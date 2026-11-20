import type { StyleProp, ViewStyle } from 'react-native'

export interface FlipCardProps {
  term: string
  definition: string
  /** Face visible : `false` = terme, `true` = définition. */
  flipped: boolean
  /** Appui sur la carte. */
  onFlip: () => void
  style?: StyleProp<ViewStyle>
  testID?: string
}

/**
 * CONTRAT : carte retournable (flashcards, révision). Retournement avec `Animated` (rotation), ou
 * fondu si « réduire les animations » est actif (`AccessibilityInfo.isReduceMotionEnabled`). Rôle
 * `button` ; TalkBack lit la face visible, le changement de face est annoncé.
 */
export function FlipCard(_props: FlipCardProps) {
  return null
}
