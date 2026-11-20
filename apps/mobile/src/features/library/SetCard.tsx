import { formatDate, pluralize } from '@quizlet/shared'
import { StyleSheet, View } from 'react-native'
import { VisibilityBadge } from '@/features/common'
import type { SetSummary } from '@/lib/queries'
import { Card, IconButton, spacing, Text } from '@/ui'
import { setCardLabel } from './messages'

interface SetCardProps {
  set: SetSummary
  /** Liste précédente affichée pendant le chargement de la suivante (60 % d'opacité). */
  dimmed: boolean
  onOpen: () => void
  onMove: () => void
}

/**
 * Carte de la bibliothèque. Le bouton « Déplacer » est frère de la carte (pas dedans) : une carte
 * pressable est un seul élément pour TalkBack, un bouton imbriqué y serait inaccessible.
 */
export function SetCard({ set, dimmed, onOpen, onMove }: SetCardProps) {
  return (
    <View style={[styles.wrapper, dimmed && styles.dimmed]}>
      <Card
        onPress={onOpen}
        padded={false}
        accessibilityLabel={setCardLabel(set)}
        accessibilityHint="Ouvre le set"
      >
        <View style={styles.body}>
          <Text variant="heading" weight="semibold" numberOfLines={2}>
            {set.title}
          </Text>
          {set.description ? (
            <Text variant="label" tone="muted" numberOfLines={2}>
              {set.description}
            </Text>
          ) : null}
          {set.tags.length > 0 ? (
            <Text variant="caption" tone="muted">
              {set.tags.map((tag) => `#${tag.name}`).join(' ')}
            </Text>
          ) : null}
          <View style={styles.footer}>
            <Text variant="caption" weight="medium">
              {pluralize(set.cardCount, 'carte')}
            </Text>
            <VisibilityBadge visibility={set.visibility} />
            <Text variant="caption" tone="muted" style={styles.date}>
              Modifié le {formatDate(set.updatedAt)}
            </Text>
          </View>
        </View>
      </Card>
      <IconButton
        icon="folder"
        label={`Déplacer « ${set.title} » vers un dossier`}
        onPress={onMove}
        style={styles.move}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: spacing.md },
  dimmed: { opacity: 0.6 },
  // Marge droite : la place du bouton « Déplacer » (44 dp + marge).
  body: { padding: spacing.lg, paddingRight: 56, gap: spacing.xs },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
  date: { flexShrink: 1 },
  move: { position: 'absolute', top: spacing.sm, right: spacing.sm },
})
