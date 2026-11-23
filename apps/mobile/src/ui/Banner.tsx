import type { ReactNode } from 'react'
import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native'
import { Icon, type IconName } from './Icon'
import { statusColors } from './palette'
import { Text } from './Text'
import { useTheme } from './theme'
import { radius, spacing } from './tokens'

export type BannerTone = 'info' | 'warning' | 'success' | 'destructive'

export interface BannerProps {
  tone: BannerTone
  title: string
  description?: string
  /** Icône Feather ; défaut selon le ton. */
  icon?: IconName
  /** Bouton d'action (un `<Button size="sm" variant="outline" …/>`). */
  action?: ReactNode
  style?: StyleProp<ViewStyle>
  testID?: string
}

const DEFAULT_ICONS: Record<BannerTone, IconName> = {
  info: 'info',
  warning: 'alert-triangle',
  success: 'check-circle',
  destructive: 'alert-circle',
}

/**
 * CONTRAT : bandeau d'information (fond = ton à 10 %, bordure du ton). `accessibilityRole="alert"`
 * et `accessibilityLiveRegion="polite"` : son apparition est annoncée.
 */
export function Banner({ tone, title, description, icon, action, style, testID }: BannerProps) {
  const { colors } = useTheme()
  const { background, foreground, border } = statusColors(colors, tone)
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      testID={testID}
      style={[styles.root, { backgroundColor: background, borderColor: border }, style]}
    >
      <View style={styles.icon}>
        <Icon name={icon ?? DEFAULT_ICONS[tone]} size={20} color={foreground} />
      </View>
      <View style={styles.texts}>
        <Text weight="semibold" style={{ color: foreground }}>
          {title}
        </Text>
        {description !== undefined ? (
          <Text variant="label" weight="regular">
            {description}
          </Text>
        ) : null}
        {action !== undefined ? <View style={styles.action}>{action}</View> : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  icon: { paddingTop: 2 },
  texts: { flex: 1, gap: spacing.xs },
  action: { marginTop: spacing.xs, alignItems: 'flex-start' },
})
