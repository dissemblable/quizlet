import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import { Card, spacing, Text } from '@/ui'
import { ResultList, ResultRow } from './ResultList'
import { type MistakeRow, percentOf, resultAnnouncement, scoreLine } from './result-text'
import { useAnnounce } from './use-announce'

/**
 * Résultat d'une séance (quiz, mode écrit) : score, verdict, erreurs, puis les actions en
 * `children`. Annoncé à l'affichage (le web y déplace le focus).
 */
export function ScoreResult({
  correct,
  total,
  mistakesTitle,
  mistakes,
  children,
}: {
  correct: number
  total: number
  mistakesTitle: string
  mistakes: readonly MistakeRow[]
  children: ReactNode
}) {
  useAnnounce(resultAnnouncement(correct, total))
  return (
    <Card>
      <View style={styles.root}>
        <Text variant="heading" weight="semibold" accessibilityRole="header">
          Résultat
        </Text>
        <View>
          <Text variant="display" weight="semibold">{`${correct} / ${total}`}</Text>
          <Text tone="muted">{scoreLine(percentOf(correct, total))}</Text>
        </View>

        {mistakes.length > 0 && (
          <View style={styles.mistakes}>
            <Text variant="label" weight="medium" accessibilityRole="header">
              {mistakesTitle}
            </Text>
            <ResultList>
              {mistakes.map((mistake, index) => (
                <ResultRow key={mistake.key} first={index === 0}>
                  <Text variant="label" weight="medium">
                    {mistake.prompt}
                  </Text>
                  <Text variant="label" tone="destructive">
                    {`Votre réponse : ${mistake.given}`}
                  </Text>
                  <Text variant="label" tone="success">
                    {`Bonne réponse : ${mistake.expected}`}
                  </Text>
                </ResultRow>
              ))}
            </ResultList>
          </View>
        )}

        <View style={styles.actions}>{children}</View>
      </View>
    </Card>
  )
}

const styles = StyleSheet.create({
  root: { gap: spacing.lg },
  mistakes: { gap: spacing.sm },
  actions: { gap: spacing.sm },
})
