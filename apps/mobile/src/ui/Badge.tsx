import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native'
import { Icon, type IconName } from './Icon'
import { badgeColors } from './palette'
import { Text } from './Text'
import { useTheme } from './theme'
import { radius, spacing } from './tokens'

/** `secondary` : fond neutre ; `outline` : contour seul ; les autres : teinte à 10 %. */
export type BadgeTone =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'success'
  | 'warning'
  | 'info'
  | 'destructive'

export interface BadgeProps {
  label: string
  /** Défaut : `secondary`. */
  tone?: BadgeTone
  icon?: IconName
  style?: StyleProp<ViewStyle>
}

/** CONTRAT : pastille d'état (visibilité, compteur). Texte lu tel quel, icône décorative. */
export function Badge({ label, tone = 'secondary', icon, style }: BadgeProps) {
  const { colors } = useTheme()
  const { background, foreground, border } = badgeColors(colors, tone)
  return (
    <View
      style={[styles.base, { backgroundColor: background, borderColor: border }, style]}
      accessible
      accessibilityLabel={label}
    >
      {icon !== undefined ? <Icon name={icon} size={12} color={foreground} /> : null}
      <Text variant="caption" weight="medium" style={{ color: foreground }}>
        {label}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
})
