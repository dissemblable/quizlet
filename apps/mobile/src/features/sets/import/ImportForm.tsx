import { detectSeparators, errorMessage, LIMITS, utf8Size } from '@quizlet/shared'
import { Stack, useRouter } from 'expo-router'
import { useDeferredValue, useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { pickTextFile } from '@/lib/device'
import { readImportFile } from '@/lib/import-file'
import { type SetDetail, useImportCards } from '@/lib/queries'
import { routes } from '@/lib/routes'
import { useOnlineGuard } from '@/offline'
import { Button, RadioGroup, Screen, spacing, Text, TextField, toast } from '@/ui'
import { ClaudePrompt } from './ClaudePrompt'
import { pasteText } from './clipboard-adapter'
import { ImportPreview } from './ImportPreview'
import {
  appendPasted,
  buildPreview,
  CARD_OPTIONS,
  canImport,
  INITIAL_CHOICES,
  importButtonLabel,
  importHeading,
  importProblem,
  importSuccessMessage,
  resolveSeparators,
  type SeparatorChoices,
  separatorError,
  termOptions,
} from './import-form'

const INTRO = `Collez des cartes copiées depuis Excel, Google Sheets ou Quizlet (une carte par ligne), ou choisissez un fichier .csv ou .txt en UTF-8. ${LIMITS.cards} cartes et 1 Mo au maximum.`

const styles = StyleSheet.create({
  stack: { gap: spacing.lg },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  footer: { gap: spacing.sm, padding: spacing.md },
  footerActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },
})

/** Formulaire d'import : dans `set` s'il est fourni (ses cartes sont conservées), sinon dans un nouveau set. */
export function ImportForm({ set }: { set?: SetDetail }) {
  const router = useRouter()
  const guard = useOnlineGuard()
  const importCards = useImportCards(set?.id)
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [fileError, setFileError] = useState<string | null>(null)
  const [readingFile, setReadingFile] = useState(false)
  const [choices, setChoices] = useState<SeparatorChoices>(INITIAL_CHOICES)

  // L'aperçu suit la saisie sans bloquer la frappe, même sur un gros collage.
  const source = useDeferredValue(text)
  const detectedTerm = useMemo(() => detectSeparators(source).term, [source])
  const size = useMemo(() => utf8Size(source), [source])
  const separators = useMemo(
    () => resolveSeparators(choices, detectedTerm),
    [choices, detectedTerm],
  )
  const preview = useMemo(() => buildPreview(source, separators), [source, separators])
  const count = preview?.count ?? 0
  const existing = set?.cards.length ?? 0
  const problem = importProblem({ size, separators, count, existing })
  const ready = canImport({
    pending: importCards.isPending,
    count,
    problem,
    isNewSet: !set,
    title,
  })

  function choose(patch: Partial<SeparatorChoices>) {
    setChoices((current) => ({ ...current, ...patch }))
  }

  async function paste() {
    const pasted = await pasteText()
    if (pasted === null) toast.error('Collage impossible : collez le texte à la main.')
    else if (pasted === '') toast.info('Le presse-papiers est vide.')
    else setText((current) => appendPasted(current, pasted))
  }

  async function chooseFile() {
    setFileError(null)
    setReadingFile(true)
    try {
      const file = await pickTextFile()
      if (!file) return
      const result = await readImportFile(file)
      if (result.ok) setText(result.text)
      else setFileError(result.error)
    } finally {
      setReadingFile(false)
    }
  }

  async function submit() {
    if (!guard()) return
    try {
      const result = await importCards.mutateAsync({
        title,
        text,
        separators,
      })
      toast.success(importSuccessMessage(result.imported, result.skipped))
      // Set existant : on revient à son écran déjà dans la pile (pas de doublon) ; nouveau set : il remplace l'import.
      if (set) router.dismissTo(routes.set(result.set.id))
      else router.replace(routes.set(result.set.id))
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  function cancel() {
    if (router.canGoBack()) router.back()
    else router.replace(set ? routes.set(set.id) : routes.newSet)
  }

  return (
    <Screen
      scroll
      keyboardAvoiding
      padded
      footer={
        <View style={styles.footer}>
          {problem && (
            <Text
              variant="label"
              tone="destructive"
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
            >
              {problem}
            </Text>
          )}
          <View style={styles.footerActions}>
            <Button label="Annuler" variant="ghost" onPress={cancel} />
            <Button
              label={importButtonLabel(count)}
              icon="upload"
              loading={importCards.isPending}
              disabled={!ready}
              onPress={() => void submit()}
            />
          </View>
        </View>
      }
    >
      <Stack.Screen options={{ title: importHeading(set?.title) }} />
      <View style={styles.stack}>
        <Text tone="muted">
          {set ? `${INTRO} Les cartes sont ajoutées à la fin du set.` : INTRO}
        </Text>

        <ClaudePrompt />

        {!set && (
          <TextField
            label="Titre du nouveau set"
            value={title}
            onChangeText={setTitle}
            maxLength={LIMITS.title}
            placeholder="Ex. : Vocabulaire anglais"
            helper="Le set est créé en privé ; vous pourrez le modifier ensuite."
          />
        )}

        <TextField
          label="Cartes à importer"
          value={text}
          onChangeText={setText}
          multiline
          minLines={8}
          monospace
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          placeholder={'chat\tcat\nchien\tdog'}
        />
        <View style={styles.actions}>
          <Button label="Coller" variant="outline" icon="clipboard" onPress={() => void paste()} />
          <Button
            label="Choisir un fichier .csv / .txt"
            variant="outline"
            icon="upload"
            loading={readingFile}
            onPress={() => void chooseFile()}
          />
        </View>
        {fileError && (
          <Text
            variant="label"
            tone="destructive"
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
          >
            {fileError}
          </Text>
        )}

        <RadioGroup
          label="Entre le terme et la définition"
          direction="row"
          value={choices.term}
          onValueChange={(term) => choose({ term })}
          options={termOptions(detectedTerm)}
        />
        {choices.term === 'custom' && (
          <CustomSeparator
            value={choices.customTerm}
            onChangeText={(customTerm) => choose({ customTerm })}
          />
        )}

        <RadioGroup
          label="Entre deux cartes"
          direction="row"
          value={choices.card}
          onValueChange={(card) => choose({ card })}
          options={CARD_OPTIONS}
        />
        {choices.card === 'custom' && (
          <CustomSeparator
            value={choices.customCard}
            onChangeText={(customCard) => choose({ customCard })}
          />
        )}

        <ImportPreview
          preview={preview}
          summary={preview?.summary ?? separatorError(separators) ?? ''}
        />
      </View>
    </Screen>
  )
}

function CustomSeparator({
  value,
  onChangeText,
}: {
  value: string
  onChangeText: (value: string) => void
}) {
  return (
    <TextField
      label="Séparateur personnalisé"
      value={value}
      onChangeText={onChangeText}
      maxLength={10}
      monospace
      autoCapitalize="none"
      autoCorrect={false}
      spellCheck={false}
      helper={'\\n : retour à la ligne, \\t : tabulation.'}
    />
  )
}
