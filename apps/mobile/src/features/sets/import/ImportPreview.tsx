import { StyleSheet, View } from 'react-native'
import { type Colors, radius, spacing, Text, useThemedStyles } from '@/ui'
import type { PreviewModel } from './import-form'

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    section: { gap: spacing.sm },
    table: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg,
      overflow: 'hidden',
    },
    head: { backgroundColor: colors.muted },
    row: {
      flexDirection: 'row',
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    ruled: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
    line: { width: 40 },
    cell: { flex: 1 },
    more: { padding: spacing.md },
    invalid: {
      gap: spacing.xs,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.warning,
      backgroundColor: colors.warningSurface,
      borderRadius: radius.lg,
    },
  })

/**
 * Aperçu de l'import (sous les champs). La phrase de synthèse est une zone vivante toujours montée :
 * TalkBack annonce chaque changement. Le tableau est borné à `PREVIEW_ROWS` lignes par `buildPreview`.
 */
export function ImportPreview({
  preview,
  summary,
}: {
  preview: PreviewModel | null
  /** Phrase de synthèse, ou erreur de séparateur quand il n'y a pas d'aperçu. */
  summary: string
}) {
  const styles = useThemedStyles(makeStyles)
  return (
    <View style={styles.section}>
      <Text variant="heading" accessibilityRole="header">
        Aperçu
      </Text>
      <Text variant="label" tone="muted" accessibilityLiveRegion="polite">
        {summary}
      </Text>

      {preview && preview.cards.length > 0 && (
        <View style={styles.table}>
          {/* Les libellés de colonnes sont lus dans chaque ligne : l'en-tête est décoratif. */}
          <View
            style={[styles.row, styles.head]}
            importantForAccessibility="no-hide-descendants"
            accessibilityElementsHidden
          >
            <Text variant="label" weight="medium" tone="muted" style={styles.line}>
              Ligne
            </Text>
            <Text variant="label" weight="medium" tone="muted" style={styles.cell}>
              Terme
            </Text>
            <Text variant="label" weight="medium" tone="muted" style={styles.cell}>
              Définition
            </Text>
          </View>
          {preview.cards.map((card) => (
            <View
              key={card.line}
              accessible
              accessibilityLabel={`Ligne ${card.line}, terme : ${card.term}, définition : ${card.definition}`}
              style={[styles.row, styles.ruled]}
            >
              <Text variant="label" tone="muted" style={styles.line}>
                {card.line}
              </Text>
              <Text variant="label" style={styles.cell}>
                {card.term}
              </Text>
              <Text variant="label" style={styles.cell}>
                {card.definition}
              </Text>
            </View>
          ))}
          {preview.more && (
            <View style={[styles.more, styles.ruled]}>
              <Text variant="label" tone="muted">
                {preview.more}
              </Text>
            </View>
          )}
        </View>
      )}

      {preview && preview.invalid.length > 0 && (
        <View style={styles.invalid}>
          <Text variant="label" weight="medium" accessibilityRole="header">
            Lignes ignorées à l'import
          </Text>
          {preview.invalid.map((line) => (
            <Text key={line.line} variant="label">
              <Text variant="label" weight="medium">
                Ligne {line.line}
              </Text>{' '}
              ({line.reason}) :{' '}
              <Text variant="label" tone="muted">
                {line.text}
              </Text>
            </Text>
          ))}
        </View>
      )}
    </View>
  )
}
