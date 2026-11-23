import { CLAUDE_PROMPT } from '@quizlet/shared'
import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { copyText } from '@/lib/device'
import {
  Button,
  Card,
  type Colors,
  Icon,
  radius,
  spacing,
  Text,
  toast,
  useThemedStyles,
} from '@/ui'

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    summary: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    body: { gap: spacing.md, paddingTop: spacing.sm },
    copy: { alignSelf: 'flex-start' },
    prompt: {
      maxHeight: 320,
      borderRadius: radius.md,
      backgroundColor: colors.muted,
      padding: spacing.md,
    },
  })

/** Prompt à copier dans Claude : sa réponse se colle ensuite dans le champ d'import. */
export function ClaudePrompt() {
  const styles = useThemedStyles(makeStyles)
  const [open, setOpen] = useState(false)

  async function copy() {
    if (await copyText(CLAUDE_PROMPT)) toast.success('Prompt copié.')
    else toast.error('Copie impossible : sélectionnez le texte à la main.')
  }

  return (
    <Card>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((value) => !value)}
        style={styles.summary}
      >
        <Text weight="medium" style={{ flex: 1 }}>
          Générer les cartes avec Claude
        </Text>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} />
      </Pressable>
      {open && (
        <View style={styles.body}>
          <Text variant="label" tone="muted">
            Copiez ce prompt, collez-le dans Claude après avoir remplacé les repères entre crochets
            (ajoutez votre cours dans la même conversation si besoin), puis collez ci-dessous le
            bloc de code de sa réponse (la ligne « Titre : … » sert pour le titre du set).
          </Text>
          <ScrollView nestedScrollEnabled style={styles.prompt}>
            <Text variant="caption" monospace selectable>
              {CLAUDE_PROMPT}
            </Text>
          </ScrollView>
          <Button
            label="Copier le prompt"
            variant="outline"
            icon="copy"
            style={styles.copy}
            onPress={() => void copy()}
          />
        </View>
      )}
    </Card>
  )
}
