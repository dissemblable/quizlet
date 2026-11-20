import { Stack, useRouter } from 'expo-router'
import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import type { SetDetail } from '@/lib/queries'
import { useOfflineStatus } from '@/offline'
import { Banner, Button, Screen, spacing, Text } from '@/ui'
import { pendingNotice, reviewTarget } from './session'

interface ReviewShellProps {
  /** Absent : révision du jour (tous les sets). */
  set?: SetDetail
  /** Barre collée en bas (afficher la réponse, notes). */
  footer?: ReactNode
  children: ReactNode
}

/** Cadre commun des états de l'écran : titre, retour, notes en attente de synchronisation. */
export function ReviewShell({ set, footer, children }: ReviewShellProps) {
  const router = useRouter()
  const { pendingGrades } = useOfflineStatus()
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
          {pendingGrades > 0 ? <Banner tone="info" title={pendingNotice(pendingGrades)} /> : null}
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
