import type { ReactNode } from 'react'
import { Pressable, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native'
import { Icon, type IconName } from './Icon'
import { Text } from './Text'
import { useTheme } from './theme'
import { spacing } from './tokens'

export interface ListItemProps {
  title: string
  subtitle?: string
  /** Icône Feather à gauche. */
  icon?: IconName
  /** Élément à droite (badge, valeur). Remplace le chevron. */
  right?: ReactNode
  /** Ligne choisie (liste de fuseaux, dossier courant) : coche à droite, annoncée « sélectionné ». */
  selected?: boolean
  /** Titre en rouge (suppression, déconnexion). */
  destructive?: boolean
  /** Chevron à droite si la ligne est pressable et sans `right` (défaut : true). */
  showChevron?: boolean
  /** Présent : ligne pressable (rôle `button`). */
  onPress?: () => void
  disabled?: boolean
  accessibilityLabel?: string
  accessibilityHint?: string
  style?: StyleProp<ViewStyle>
  testID?: string
}

/**
 * CONTRAT : ligne de liste (compte, paramètres, « Déplacer vers… », fuseaux). Ajout de S0-3 (absent
 * du plan) : évite que chaque lot réécrive une ligne pressable avec sa propre accessibilité.
 */
export function ListItem({
  title,
  subtitle,
  icon,
  right,
  selected = false,
  destructive = false,
  showChevron = true,
  onPress,
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
  style,
  testID,
}: ListItemProps) {
  const { colors } = useTheme()
  const tone = destructive ? colors.destructive : colors.foreground
  const trailing =
    right ??
    (selected ? (
      <Icon name="check" size={20} color={colors.primary} />
    ) : onPress !== undefined && showChevron ? (
      <Icon name="chevron-right" size={20} color={colors.mutedForeground} />
    ) : null)

  const content = (
    <>
      {icon !== undefined ? (
        <Icon name={icon} size={20} color={destructive ? tone : colors.mutedForeground} />
      ) : null}
      <View style={styles.texts}>
        <Text style={{ color: tone }}>{title}</Text>
        {subtitle !== undefined ? (
          <Text variant="caption" tone="muted">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
    </>
  )

  if (onPress === undefined) {
    return (
      <View style={[styles.row, style]} testID={testID}>
        {content}
      </View>
    )
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.row,
        pressed && { backgroundColor: colors.muted },
        disabled && styles.disabled,
        style,
      ]}
    >
      {content}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 56,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  texts: { flex: 1 },
  disabled: { opacity: 0.5 },
})
