import { memo, type RefObject, useEffect, useState } from 'react'
import { useController } from 'react-hook-form'
import { StyleSheet, View } from 'react-native'
import { Card, IconButton, spacing, Text, TextField } from '@/ui'
import type { EditorControl } from './editor-values'

interface CardFieldsRowProps {
  control: EditorControl
  index: number
  isLast: boolean
  onMove: (from: number, to: number) => void
  onRemove: (index: number) => void
  /** Index de la carte qui doit prendre le focus à son montage (« Ajouter une carte »). */
  pendingFocus: RefObject<number | null>
}

/**
 * Une carte du formulaire. Les deux champs s'abonnent à leur propre valeur : une frappe ne rend
 * que cette ligne (la liste est virtualisée, jusqu'à 2000 cartes). `memo` : seules les lignes dont
 * l'index change (déplacement) se re-rendent.
 */
export const CardFieldsRow = memo(function CardFieldsRow({
  control,
  index,
  isLast,
  onMove,
  onRemove,
  pendingFocus,
}: CardFieldsRowProps) {
  const number = index + 1
  const term = useController({ control, name: `cards.${index}.term` })
  const definition = useController({ control, name: `cards.${index}.definition` })
  // `autoFocus` n'agit qu'au montage : on lit la demande de focus une seule fois, sans l'effacer
  // pendant le rendu.
  const [autoFocus] = useState(() => pendingFocus.current === index)

  useEffect(() => {
    if (autoFocus) pendingFocus.current = null
  }, [autoFocus, pendingFocus])

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Text variant="label" tone="muted">
          Carte {number}
        </Text>
        <View style={styles.actions}>
          <IconButton
            icon="arrow-up"
            label={`Monter la carte ${number}`}
            disabled={index === 0}
            onPress={() => onMove(index, index - 1)}
          />
          <IconButton
            icon="arrow-down"
            label={`Descendre la carte ${number}`}
            disabled={isLast}
            onPress={() => onMove(index, index + 1)}
          />
          <IconButton
            icon="trash-2"
            label={`Supprimer la carte ${number}`}
            onPress={() => onRemove(index)}
          />
        </View>
      </View>
      <TextField
        label="Terme"
        accessibilityLabel={`Terme, carte ${number}`}
        multiline
        minLines={2}
        value={term.field.value}
        onChangeText={term.field.onChange}
        onBlur={term.field.onBlur}
        inputRef={term.field.ref}
        error={term.fieldState.error?.message}
        autoFocus={autoFocus}
      />
      <TextField
        label="Définition"
        accessibilityLabel={`Définition, carte ${number}`}
        multiline
        minLines={2}
        value={definition.field.value}
        onChangeText={definition.field.onChange}
        onBlur={definition.field.onBlur}
        inputRef={definition.field.ref}
        error={definition.fieldState.error?.message}
      />
    </Card>
  )
})

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md, gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  actions: { flexDirection: 'row', alignItems: 'center' },
})
