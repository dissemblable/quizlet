import type { ReactNode } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'

export type ScreenEdge = 'top' | 'bottom' | 'left' | 'right'

export interface ScreenProps {
  children?: ReactNode
  /** Contenu dans un `ScrollView` (`keyboardShouldPersistTaps="handled"`). Sinon une `View` flex. */
  scroll?: boolean
  /** `KeyboardAvoidingView behavior="padding"` (formulaires). */
  keyboardAvoiding?: boolean
  /** Marges de page (`spacing.lg`) autour du contenu. */
  padded?: boolean
  /** Tirer pour rafraîchir (avec `scroll`) : fournir les deux. */
  refreshing?: boolean
  onRefresh?: () => void
  /**
   * Bords protégés par les marges système (edge-to-edge). Défaut : `['bottom', 'left', 'right']`
   * (l'en-tête de navigation gère le haut). Écrans SANS en-tête (connexion, erreur) : ajouter `'top'`.
   */
  edges?: readonly ScreenEdge[]
  /** Barre collée en bas, au-dessus du clavier (boutons de note, enregistrer). */
  footer?: ReactNode
  contentContainerStyle?: StyleProp<ViewStyle>
  style?: StyleProp<ViewStyle>
  testID?: string
}

/**
 * CONTRAT : conteneur d'écran (fond `colors.background`, marges système, défilement, clavier,
 * pied collé). Pour une liste, `FlatList` dans un `Screen` sans `scroll` (elle défile seule).
 */
export function Screen(_props: ScreenProps) {
  return null
}
