import { useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { spacing, Text, useTheme } from '@/ui'
import { bannerText, SYNC_BANNER_DELAY_MS } from './banner-text'
import { useOfflineStatus } from './use-online'

/**
 * CONTRAT : bandeau « Hors ligne · N notes en attente », monté au-dessus du `Stack` racine.
 * Rend `null` quand il n'y a rien à dire. Quand il est visible il se trouve sous la barre d'état :
 * il gère lui-même l'inset du haut (`useSafeAreaInsets().top`).
 *
 * En ligne, des notes en attente n'affichent « Synchronisation · N notes en attente » qu'après 2 s
 * (une note qui part tout de suite ne doit pas faire clignoter le bandeau, ni parler à TalkBack).
 */
export function OfflineBanner() {
  const { online, pendingGrades } = useOfflineStatus()
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const waiting = online && pendingGrades > 0
  const [slow, setSlow] = useState(false)

  useEffect(() => {
    if (!waiting) {
      setSlow(false)
      return
    }
    const timer = setTimeout(() => setSlow(true), SYNC_BANNER_DELAY_MS)
    return () => clearTimeout(timer)
  }, [waiting])

  const text = bannerText({ online, pending: pendingGrades, slow })
  if (text === null) return null

  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[
        styles.banner,
        {
          paddingTop: insets.top + spacing.xs,
          paddingLeft: insets.left + spacing.lg,
          paddingRight: insets.right + spacing.lg,
          backgroundColor: colors.warningSurface,
          borderBottomColor: colors.warning,
        },
      ]}
    >
      <Text variant="label" tone="warning" align="center">
        {text}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  banner: {
    paddingBottom: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
})
