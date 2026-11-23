import { StyleSheet, View } from 'react-native'
import { Card, Icon, type IconName, radius, spacing, Text, useTheme } from '@/ui'

interface StudyModeTileProps {
  icon: IconName
  title: string
  description: string
  /** Présent : mode indisponible. La raison remplace la description, la tuile est désactivée. */
  unavailableReason?: string
  onPress: () => void
}

/**
 * Tuile d'un mode d'étude : un seul élément pressable pour TalkBack. Indisponible, elle est
 * `disabled` (état annoncé) et lue avec sa raison plutôt qu'avec sa description.
 */
export function StudyModeTile({
  icon,
  title,
  description,
  unavailableReason,
  onPress,
}: StudyModeTileProps) {
  const { colors } = useTheme()
  const text = unavailableReason ?? description
  return (
    <Card
      onPress={onPress}
      disabled={unavailableReason !== undefined}
      accessibilityLabel={`${title}. ${text}`}
    >
      <View style={styles.row}>
        <View style={[styles.icon, { backgroundColor: colors.secondary }]}>
          <Icon name={icon} size={22} color={colors.primary} />
        </View>
        <View style={styles.text}>
          <Text weight="semibold">{title}</Text>
          <Text variant="label" weight="regular" tone="muted">
            {text}
          </Text>
        </View>
      </View>
    </Card>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  icon: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: 2 },
})
