import { LIMITS } from '@quizlet/shared'
import { type RefObject, useEffect, useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { announce, Button, Chip, spacing, TextField } from '@/ui'
import { addTags, refusalMessage, splitDraft, tagSuggestions } from './tag-rules'

interface TagInputProps {
  label: string
  value: string[]
  onChange: (tags: string[]) => void
  /** Mes tags existants, proposés sous le champ (sans ceux déjà choisis). */
  suggestions: readonly string[]
  helper?: string
  /** Reçoit une fonction qui ajoute la saisie en cours (appelée avant l'enregistrement du formulaire). */
  flushRef?: RefObject<(() => void) | null>
}

/**
 * Tags d'un set : « Ajouter », validation du clavier, virgule ou sortie du champ ajoutent le tag
 * saisi. Les règles (doublons, 10 tags, 30 caractères) sont dans `tag-rules.ts`.
 */
export function TagInput({ label, value, onChange, suggestions, helper, flushRef }: TagInputProps) {
  const [draft, setDraft] = useState('')
  const [problem, setProblem] = useState<string | undefined>()
  const full = value.length >= LIMITS.tagsPerSet
  const proposals = useMemo(
    () => (full ? [] : tagSuggestions(suggestions, value, draft)),
    [full, suggestions, value, draft],
  )

  function commit(names: string[]) {
    const { tags, refused } = addTags(value, names)
    const first = refused[0]
    // Le message d'erreur du champ est annoncé par TalkBack ; sans refus, on annonce l'ajout.
    setProblem(first ? refusalMessage(first.reason, first.name) : undefined)
    if (tags === value) return
    onChange(tags)
    const added = tags.slice(value.length)
    if (!first) {
      announce(added.length === 1 ? `Tag « ${added[0]} » ajouté.` : `${added.length} tags ajoutés.`)
    }
  }

  function addDraft() {
    if (draft.trim() === '') return
    commit([draft])
    setDraft('')
  }

  // Toucher « Enregistrer » ne fait pas perdre le focus au champ : sans cela, la saisie en cours
  // (jamais validée) serait ignorée, alors que le web l'ajoute à la sortie du champ.
  useEffect(() => {
    if (!flushRef) return
    flushRef.current = addDraft
    return () => {
      flushRef.current = null
    }
  })

  function changeDraft(text: string) {
    setProblem(undefined)
    if (!text.includes(',')) {
      setDraft(text)
      return
    }
    const { names, rest } = splitDraft(text)
    setDraft(rest)
    commit(names)
  }

  function removeTag(tag: string) {
    onChange(value.filter((item) => item !== tag))
    announce(`Tag « ${tag} » retiré.`)
  }

  return (
    <View style={styles.root}>
      {value.length > 0 ? (
        <View style={styles.chips}>
          {value.map((tag) => (
            <Chip
              key={tag}
              label={`#${tag}`}
              icon="x"
              accessibilityLabel={`Retirer le tag ${tag}`}
              onPress={() => removeTag(tag)}
            />
          ))}
        </View>
      ) : null}
      <TextField
        label={label}
        value={draft}
        onChangeText={changeDraft}
        error={problem}
        helper={helper}
        editable={!full}
        maxLength={LIMITS.tagName}
        placeholder={full ? `${LIMITS.tagsPerSet} tags au maximum` : 'Ex. : vocabulaire'}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="done"
        submitBehavior="submit"
        onSubmitEditing={addDraft}
        onBlur={addDraft}
        right={
          <Button
            size="sm"
            variant="ghost"
            label="Ajouter"
            accessibilityLabel="Ajouter le tag"
            disabled={full || draft.trim() === ''}
            onPress={addDraft}
          />
        }
      />
      {proposals.length > 0 ? (
        <View style={styles.chips}>
          {proposals.map((name) => (
            <Chip
              key={name}
              label={`#${name}`}
              accessibilityLabel={`Ajouter le tag ${name}`}
              onPress={() => {
                commit([name])
                setDraft('')
              }}
            />
          ))}
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
})
