import { countFilledCards, LIMITS, pluralize, type Visibility } from '@quizlet/shared'
import { type RefObject, useMemo } from 'react'
import { Controller, useFormState, useWatch } from 'react-hook-form'
import { StyleSheet, View } from 'react-native'
import { useTags } from '@/lib/queries'
import { Button, RadioGroup, type RadioOption, spacing, Text, TextField } from '@/ui'
import type { EditorControl } from './editor-values'
import { TagInput } from './TagInput'

const VISIBILITY_OPTIONS: ReadonlyArray<RadioOption<Visibility>> = [
  { value: 'private', label: 'Privé', description: 'Visible par vous seul.', icon: 'lock' },
  {
    value: 'public',
    label: 'Public',
    description:
      'Consultable et étudiable via son lien par tout utilisateur connecté. Vous seul pouvez le modifier.',
    icon: 'globe',
  },
]

interface EditorHeaderProps {
  control: EditorControl
  /** Quitte l'éditeur pour la page d'import (la garde « modifications non enregistrées » s'applique). */
  onImport: () => void
  /** Reçoit l'ajout de la saisie de tag en cours (voir `TagInput`). */
  flushTagsRef: RefObject<(() => void) | null>
}

/**
 * Tête de la liste de cartes : lien d'import, champs du set, tags, titre de la section « Cartes ».
 * Chaque champ lit sa propre valeur et sa propre erreur (`Controller`) : aucune frappe ne
 * re-rend l'éditeur entier.
 */
export function EditorHeader({ control, onImport, flushTagsRef }: EditorHeaderProps) {
  const tags = useTags().data
  const tagNames = useMemo(() => tags?.map((tag) => tag.name) ?? [], [tags])

  return (
    <View style={styles.root}>
      <View style={styles.import}>
        <Button
          variant="outline"
          size="sm"
          icon="upload"
          label="Importer des cartes"
          onPress={onImport}
        />
      </View>

      <Controller
        control={control}
        name="title"
        render={({ field, fieldState }) => (
          <TextField
            label="Titre"
            placeholder="Ex. : Capitales européennes"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            inputRef={field.ref}
            error={fieldState.error?.message}
          />
        )}
      />

      <Controller
        control={control}
        name="description"
        render={({ field, fieldState }) => (
          <TextField
            label="Description (facultative)"
            multiline
            minLines={3}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            inputRef={field.ref}
            error={fieldState.error?.message}
          />
        )}
      />

      <Controller
        control={control}
        name="visibility"
        render={({ field }) => (
          <RadioGroup
            label="Visibilité"
            value={field.value}
            onValueChange={field.onChange}
            options={VISIBILITY_OPTIONS}
          />
        )}
      />

      <Controller
        control={control}
        name="tags"
        render={({ field }) => (
          <TagInput
            label={`Tags (facultatifs, ${LIMITS.tagsPerSet} au plus)`}
            value={field.value}
            onChange={field.onChange}
            suggestions={tagNames}
            flushRef={flushTagsRef}
            helper="Entrée ou virgule pour ajouter un tag."
          />
        )}
      />

      <View style={styles.cardsTitle}>
        <Text variant="heading" weight="semibold" accessibilityRole="header">
          Cartes
        </Text>
        <FilledCount control={control} />
      </View>
      <CardsError control={control} />
    </View>
  )
}

/** Cartes remplies : seul composant qui suit toutes les cartes, donc le seul rendu à chaque frappe. */
function FilledCount({ control }: { control: EditorControl }) {
  const cards = useWatch({ control, name: 'cards' })
  return (
    <Text variant="label" tone="muted">
      {pluralize(countFilledCards(cards ?? []), 'carte')}
    </Text>
  )
}

/** Erreur portant sur la liste entière (« Un set ne peut pas contenir plus de 2000 cartes »). */
function CardsError({ control }: { control: EditorControl }) {
  const { errors } = useFormState({ control, name: 'cards' })
  const message = errors.cards?.root?.message ?? errors.cards?.message
  if (!message) return null
  return (
    <Text variant="label" tone="destructive" accessibilityRole="alert">
      {message}
    </Text>
  )
}

const styles = StyleSheet.create({
  root: { gap: spacing.lg, paddingBottom: spacing.md },
  import: { alignItems: 'flex-end' },
  cardsTitle: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
})
