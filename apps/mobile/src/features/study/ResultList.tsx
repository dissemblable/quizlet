import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import { type Colors, radius, spacing, useThemedStyles } from '@/ui'

/** Liste encadrée d'un récapitulatif (erreurs, cartes à revoir). */
export function ResultList({ children }: { children: ReactNode }) {
  const styles = useThemedStyles(makeStyles)
  return <View style={styles.list}>{children}</View>
}

/** Une ligne de `ResultList` ; `first` : pas de filet au-dessus. */
export function ResultRow({ first, children }: { first: boolean; children: ReactNode }) {
  const styles = useThemedStyles(makeStyles)
  return <View style={[styles.row, !first && styles.separator]}>{children}</View>
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    list: { borderWidth: 1, borderColor: c.border, borderRadius: radius.lg, overflow: 'hidden' },
    row: { gap: spacing.xs, padding: spacing.md },
    separator: { borderTopWidth: 1, borderTopColor: c.border },
  })
