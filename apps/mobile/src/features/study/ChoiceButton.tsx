import { Pressable, StyleSheet, View } from 'react-native'
import {
  type Colors,
  Icon,
  type IconName,
  radius,
  spacing,
  Text,
  type TextTone,
  useTheme,
  useThemedStyles,
} from '@/ui'
import { type ChoiceStatus, choiceAccessibilityLabel } from './choice-status'

const TONES: Record<ChoiceStatus, TextTone> = {
  idle: 'default',
  correct: 'success',
  wrong: 'destructive',
  dimmed: 'default',
}

const ICONS: Partial<Record<ChoiceStatus, IconName>> = { correct: 'check', wrong: 'x' }

/** Un choix de quiz : numéroté, verrouillé après la réponse (idle / correct / wrong / dimmed). */
export function ChoiceButton({
  index,
  label,
  status,
  onSelect,
}: {
  index: number
  label: string
  status: ChoiceStatus
  onSelect: () => void
}) {
  const { colors } = useTheme()
  const styles = useThemedStyles(makeStyles)
  const locked = status !== 'idle'
  const icon = ICONS[status]
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={choiceAccessibilityLabel(index, label, status)}
      accessibilityState={{ disabled: locked }}
      disabled={locked}
      onPress={onSelect}
      style={({ pressed }) => [
        styles.base,
        status === 'correct' && styles.correct,
        status === 'wrong' && styles.wrong,
        status === 'dimmed' && styles.dimmed,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.index}>
        <Text variant="caption" tone="muted" weight="medium">
          {index + 1}
        </Text>
      </View>
      <Text style={styles.label} tone={TONES[status]}>
        {label}
      </Text>
      {icon && (
        <Icon
          name={icon}
          size={20}
          color={status === 'correct' ? colors.success : colors.destructive}
        />
      )}
    </Pressable>
  )
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    base: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      minHeight: 56,
      padding: spacing.lg,
      borderWidth: 1,
      borderRadius: radius.xl,
      borderColor: c.border,
      backgroundColor: c.card,
    },
    correct: { borderColor: c.success, backgroundColor: c.successSurface },
    wrong: { borderColor: c.destructive, backgroundColor: c.destructiveSurface },
    dimmed: { opacity: 0.6 },
    pressed: { backgroundColor: c.accent },
    index: {
      width: 28,
      height: 28,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.md,
    },
    label: { flex: 1 },
  })
