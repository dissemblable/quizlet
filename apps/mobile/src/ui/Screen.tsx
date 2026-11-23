import type { ReactNode } from 'react'
import {
  KeyboardAvoidingView,
  RefreshControl,
  ScrollView,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTheme } from './theme'
import { spacing } from './tokens'

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

const DEFAULT_EDGES: readonly ScreenEdge[] = ['bottom', 'left', 'right']

/**
 * CONTRAT : conteneur d'écran (fond `colors.background`, marges système, défilement, clavier,
 * pied collé). Pour une liste, `FlatList` dans un `Screen` sans `scroll` (elle défile seule).
 *
 * Utilisé par l'`ErrorBoundary` racine : il n'exige donc aucun fournisseur (`SafeAreaView` est la
 * vue native, qui n'a pas besoin de `SafeAreaProvider`) et le thème est facultatif. Un `footer`
 * place aussi le contenu dans un `KeyboardAvoidingView` : la barre monte au-dessus du clavier.
 */
export function Screen({
  children,
  scroll = false,
  keyboardAvoiding = false,
  padded = false,
  refreshing = false,
  onRefresh,
  edges = DEFAULT_EDGES,
  footer,
  contentContainerStyle,
  style,
  testID,
}: ScreenProps) {
  const { colors } = useTheme()

  const body = scroll ? (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      style={styles.fill}
      contentContainerStyle={[styles.scrollContent, padded && styles.padded, contentContainerStyle]}
      refreshControl={
        onRefresh === undefined ? undefined : (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            progressBackgroundColor={colors.card}
          />
        )
      }
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.fill, padded && styles.padded, contentContainerStyle]}>{children}</View>
  )

  const content = (
    <>
      {body}
      {footer !== undefined ? (
        <View
          style={[
            styles.footer,
            { backgroundColor: colors.background, borderTopColor: colors.border },
          ]}
        >
          {footer}
        </View>
      ) : null}
    </>
  )

  return (
    <SafeAreaView
      edges={edges}
      testID={testID}
      style={[styles.fill, { backgroundColor: colors.background }, style]}
    >
      {keyboardAvoiding || footer !== undefined ? (
        <KeyboardAvoidingView behavior="padding" style={styles.fill}>
          {content}
        </KeyboardAvoidingView>
      ) : (
        content
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  padded: { padding: spacing.lg },
  footer: { padding: spacing.lg, borderTopWidth: 1 },
})
