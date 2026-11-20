import { Stack, useRouter } from 'expo-router'
import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import type { SetDetail } from '@/lib/queries'
import { Button, Screen, spacing, Text } from '@/ui'
import { reviewTarget } from './session'

interface ReviewShellProps {
  /** Absent : révision du jour (tous les sets). */
  set?: SetDetail
  /** Barre collée en bas (afficher la réponse, notes). */
  footer?: ReactNode
  /** Ligne d'info sous le titre (file déduite hors ligne). */
  notice?: string
  children: ReactNode
}

/**
 * Cadre commun des états de l'écran : titre, retour. Les notes en attente sont déjà montrées par le
 * bandeau global `OfflineBanner`.
 */
export function ReviewShell({ set, footer, notice, children }: ReviewShellProps) {
  const router = useRouter()
  const target = reviewTarget(set)

  return (
    <>
      {/* L'onglet garde son titre « Révision » ; seule la pile (révision d'un set) le remplace. */}
      {set ? <Stack.Screen options={{ title: target.title }} /> : null}
      <Screen scroll padded footer={footer}>
        <View style={styles.content}>
          {set ? (
            <Button
              variant="ghost"
              size="sm"
              icon="chevron-left"
              label={target.backLabel}
              accessibilityLabel={`Retour au set ${set.title}`}
              onPress={() => router.dismissTo(target.route)}
              style={styles.back}
            />
          ) : (
            <Text variant="heading" accessibilityRole="header">
              {target.title}
            </Text>
          )}
          {notice ? (
            <Text variant="label" tone="muted">
              {notice}
            </Text>
          ) : null}
          {children}
        </View>
      </Screen>
    </>
  )
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: 640, alignSelf: 'center', gap: spacing.lg },
  back: { alignSelf: 'flex-start', maxWidth: '100%' },
})
