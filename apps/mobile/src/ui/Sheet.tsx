import type { ReactNode } from 'react'
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { IconButton } from './IconButton'
import { Text } from './Text'
import { useTheme } from './theme'
import { radius, spacing } from './tokens'

export interface SheetProps {
  visible: boolean
  /** Appelé par le fond, la croix et le bouton Retour d'Android (`onRequestClose`). */
  onClose: () => void
  title?: string
  /** Pied collé en bas (boutons Annuler / Enregistrer). */
  footer?: ReactNode
  /** Occupe presque toute la hauteur (liste des fuseaux). Sinon hauteur du contenu. */
  fullHeight?: boolean
  /** Contenu dans un `ScrollView` (défaut : true). Mettre `false` pour y placer une `FlatList`. */
  scroll?: boolean
  children?: ReactNode
}

/**
 * CONTRAT : feuille modale du bas (`Modal` transparent, voile `colors.overlay`, clavier géré).
 * Le focus TalkBack passe dans la feuille à l'ouverture ; Retour la ferme.
 * Avec `scroll={false}`, mettre aussi `fullHeight` : une `FlatList` a besoin d'une hauteur bornée.
 */
export function Sheet({
  visible,
  onClose,
  title,
  footer,
  fullHeight = false,
  scroll = true,
  children,
}: SheetProps) {
  const { colors } = useTheme()
  const body = scroll ? (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      style={styles.scroll}
      contentContainerStyle={styles.content}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={fullHeight ? styles.fill : styles.scroll}>{children}</View>
  )

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      // Edge-to-edge : la fenêtre du modal couvre aussi les barres système (voile complet).
      statusBarTranslucent
      navigationBarTranslucent
    >
      <KeyboardAvoidingView behavior="padding" style={styles.fill}>
        <Pressable
          accessible={false}
          importantForAccessibility="no"
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]}
          onPress={onClose}
        />
        <View style={styles.bottom} pointerEvents="box-none">
          <SafeAreaView
            edges={['bottom', 'left', 'right']}
            style={[
              styles.panel,
              { backgroundColor: colors.card, borderColor: colors.border },
              fullHeight && styles.full,
            ]}
          >
            <View style={styles.header}>
              {title !== undefined ? (
                <Text variant="heading" accessibilityRole="header" style={styles.title}>
                  {title}
                </Text>
              ) : (
                <View style={styles.title} />
              )}
              <IconButton icon="x" label="Fermer" onPress={onClose} />
            </View>
            {body}
            {footer !== undefined ? (
              <View style={[styles.footer, { borderTopColor: colors.border }]}>{footer}</View>
            ) : null}
          </SafeAreaView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  bottom: { flex: 1, justifyContent: 'flex-end' },
  panel: {
    maxHeight: '90%',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderBottomWidth: 0,
  },
  full: { height: '90%' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingLeft: spacing.lg,
    paddingRight: spacing.sm,
    paddingTop: spacing.sm,
  },
  title: { flex: 1 },
  scroll: { flexShrink: 1 },
  content: { padding: spacing.lg, gap: spacing.md },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    padding: spacing.lg,
    borderTopWidth: 1,
  },
})
