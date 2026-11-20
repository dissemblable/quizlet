import { type ReactNode, type Ref, useState } from 'react'
import {
  type StyleProp,
  StyleSheet,
  TextInput,
  type TextInputInstance,
  type TextInputProps,
  type TextStyle,
  View,
  type ViewStyle,
} from 'react-native'
import { Icon, type IconName } from './Icon'
import { counterText } from './logic'
import { Text } from './Text'
import { useTheme } from './theme'
import { fontSize, radius, spacing } from './tokens'

export interface TextFieldProps
  extends Omit<
    TextInputProps,
    | 'style'
    | 'value'
    | 'onChangeText'
    | 'multiline'
    | 'maxLength'
    | 'numberOfLines'
    | 'placeholderTextColor'
    | 'selectionColor'
  > {
  /** Libellé affiché au-dessus du champ ET lu par TalkBack. */
  label: string
  /** Remplace `label` pour TalkBack (« Terme, carte 3 ») ; le libellé visible reste `label`. */
  accessibilityLabel?: string
  /** Libellé lu par TalkBack mais non affiché (champs de recherche, réponse du mode écrit). */
  labelHidden?: boolean
  value: string
  onChangeText: (text: string) => void
  /** Message d'erreur (rouge, annoncé) ; le champ passe en erreur. */
  error?: string
  /** Aide sous le champ (masquée tant qu'il y a une erreur). */
  helper?: string
  multiline?: boolean
  /** Hauteur minimale en lignes (champ multiligne). */
  minLines?: number
  maxLength?: number
  /** Compteur « 12 / 200 » sous le champ (nécessite `maxLength`). */
  showCounter?: boolean
  /** Ref du `TextInput` (focus programmatique). `onBlur` et `onFocus` sont ceux de `TextInputProps` (RHF `Controller`). */
  inputRef?: Ref<TextInputInstance>
  /** Icône Feather à gauche (loupe de recherche). */
  icon?: IconName
  /** Élément à droite dans le champ (bouton « effacer »). */
  right?: ReactNode
  /** Police à chasse fixe (séparateurs). */
  monospace?: boolean
  /** Style du conteneur (libellé + champ + messages). */
  style?: StyleProp<ViewStyle>
  /** Style du `TextInput` seul. */
  inputStyle?: StyleProp<TextStyle>
}

const LINE_HEIGHT = 22
const PADDING_V = spacing.md

/**
 * CONTRAT : champ de saisie thémé (libellé, aide, erreur, compteur). Toutes les props de
 * `TextInput` passent (`placeholder`, `keyboardType`, `autoCapitalize`, `autoFocus`,
 * `returnKeyType`, `onSubmitEditing`, `editable`, `onBlur`…).
 */
export function TextField({
  label,
  labelHidden = false,
  value,
  onChangeText,
  error,
  helper,
  multiline = false,
  minLines = 3,
  maxLength,
  showCounter = false,
  inputRef,
  icon,
  right,
  monospace = false,
  style,
  inputStyle,
  onFocus,
  onBlur,
  editable = true,
  accessibilityLabel,
  accessibilityHint,
  ...inputProps
}: TextFieldProps) {
  const { colors } = useTheme()
  const [focused, setFocused] = useState(false)
  const hasError = error !== undefined && error !== ''
  const message = hasError ? error : helper
  const borderColor = hasError ? colors.destructive : focused ? colors.ring : colors.outline
  // Bordure de 2 dp au focus : le padding perd 1 dp pour que le champ ne bouge pas.
  const borderWidth = focused || hasError ? 2 : 1

  return (
    <View style={[styles.root, style]}>
      {labelHidden ? null : (
        <Text variant="label" importantForAccessibility="no">
          {label}
        </Text>
      )}
      <View
        style={[
          styles.box,
          {
            backgroundColor: colors.card,
            borderColor,
            borderWidth,
            paddingHorizontal: spacing.md - (borderWidth - 1),
            alignItems: multiline ? 'flex-start' : 'center',
          },
          !editable && styles.disabled,
        ]}
      >
        {icon !== undefined ? (
          <Icon
            name={icon}
            size={18}
            color={colors.mutedForeground}
            style={multiline ? styles.multilineIcon : undefined}
          />
        ) : null}
        <TextInput
          {...inputProps}
          ref={inputRef}
          value={value}
          onChangeText={onChangeText}
          multiline={multiline}
          maxLength={maxLength}
          editable={editable}
          accessibilityLabel={accessibilityLabel ?? label}
          accessibilityHint={accessibilityHint ?? message}
          placeholderTextColor={colors.mutedForeground}
          selectionColor={colors.primary}
          cursorColor={colors.primary}
          underlineColorAndroid="transparent"
          onFocus={(event) => {
            setFocused(true)
            onFocus?.(event)
          }}
          onBlur={(event) => {
            setFocused(false)
            onBlur?.(event)
          }}
          style={[
            styles.input,
            { color: colors.foreground },
            multiline && {
              minHeight: minLines * LINE_HEIGHT + 2 * PADDING_V,
              textAlignVertical: 'top',
            },
            monospace && { fontFamily: 'monospace' },
            inputStyle,
          ]}
        />
        {right}
      </View>
      {message !== undefined || (showCounter && maxLength !== undefined) ? (
        <View style={styles.footer}>
          {message !== undefined ? (
            <Text
              variant="caption"
              tone={hasError ? 'destructive' : 'muted'}
              accessibilityLiveRegion={hasError ? 'polite' : 'none'}
              style={styles.message}
            >
              {message}
            </Text>
          ) : null}
          {showCounter && maxLength !== undefined ? (
            <Text variant="caption" tone="muted" importantForAccessibility="no">
              {counterText(value.length, maxLength)}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { gap: spacing.xs },
  box: {
    flexDirection: 'row',
    gap: spacing.sm,
    borderRadius: radius.md,
  },
  input: {
    flex: 1,
    paddingVertical: PADDING_V,
    fontSize: fontSize.base,
    lineHeight: LINE_HEIGHT,
  },
  multilineIcon: { marginTop: PADDING_V + 2 },
  disabled: { opacity: 0.6 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  message: { flex: 1 },
})
