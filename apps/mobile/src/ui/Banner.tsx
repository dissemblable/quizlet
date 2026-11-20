import type { ReactNode } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import type { IconName } from './Icon'

export type BannerTone = 'info' | 'warning' | 'success' | 'destructive'

export interface BannerProps {
  tone: BannerTone
  title: string
  description?: string
  /** Icône Feather ; défaut selon le ton. */
  icon?: IconName
  /** Bouton d'action (un `<Button size="sm" variant="outline" …/>`). */
  action?: ReactNode
  style?: StyleProp<ViewStyle>
  testID?: string
}

/**
 * CONTRAT : bandeau d'information (fond = ton à 10 %, bordure du ton). `accessibilityRole="alert"`
 * et `accessibilityLiveRegion="polite"` : son apparition est annoncée.
 */
export function Banner(_props: BannerProps) {
  return null
}
