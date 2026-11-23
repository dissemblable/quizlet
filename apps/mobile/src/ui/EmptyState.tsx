import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import { Icon, type IconName } from './Icon'
import { Text } from './Text'
import { useTheme } from './theme'
import { spacing } from './tokens'

export interface EmptyStateProps {
  icon?: IconName
  title: string
  description?: string
  /** Bouton d'action (un `<Button …/>`). */
  action?: ReactNode
}

/** CONTRAT : état vide centré (icône dans un disque, titre, description, action). Titre = en-tête TalkBack. */
export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  const { colors } = useTheme()
  return (
    <View style={styles.root}>
      {icon !== undefined ? (
        <View style={[styles.disc, { backgroundColor: colors.muted }]}>
          <Icon name={icon} size={24} color={colors.mutedForeground} />
        </View>
      ) : null}
      <Text variant="heading" accessibilityRole="header" align="center">
        {title}
      </Text>
      {description !== undefined ? (
        <Text variant="label" tone="muted" align="center" style={styles.description}>
          {description}
        </Text>
      ) : null}
      {/* Le bouton épouse son contenu (alignSelf: flex-start) : ce conteneur l'ajuste et le centre. */}
      {action !== undefined ? <View style={styles.action}>{action}</View> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    padding: spacing.xl,
  },
  disc: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    marginBottom: spacing.md,
  },
  description: { maxWidth: 360 },
  action: { alignSelf: 'center', marginTop: spacing.lg },
})
