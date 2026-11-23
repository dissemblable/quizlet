import { zodResolver } from '@hookform/resolvers/zod'
import {
  emptyCard,
  errorMessage,
  type SetFormOutput,
  type SetFormValues,
  setFormSchema,
  toSetInput,
} from '@quizlet/shared'
import { usePreventRemove, useRouter } from 'expo-router'
import { useCallback, useRef, useState } from 'react'
import { type FieldArrayWithId, type FieldErrors, useFieldArray, useForm } from 'react-hook-form'
import { FlatList, type ListRenderItemInfo, StyleSheet, View } from 'react-native'
import { type SetDetail, useCreateSet, useUpdateSet } from '@/lib/queries'
import { routes } from '@/lib/routes'
import { useOnlineGuard } from '@/offline'
import { announce, Button, confirm, Screen, spacing, toast } from '@/ui'
import { CardFieldsRow } from './CardFieldsRow'
import { firstErrorTarget, moveAnnouncement, removeAnnouncement } from './card-list'
import { EditorHeader } from './EditorHeader'
import { editorInitialValues } from './editor-values'

type CardField = FieldArrayWithId<SetFormValues, 'cards', 'id'>

const keyExtractor = (field: CardField) => field.id

/**
 * Formulaire de création (`set` absent) et d'édition d'un set. Liste de cartes virtualisée
 * (jusqu'à 2000) : chaque ligne s'abonne à ses propres champs, la racine ne suit que `isDirty` et
 * `isSubmitting`.
 */
export function SetEditor({ set }: { set?: SetDetail }) {
  const router = useRouter()
  const guard = useOnlineGuard()
  const create = useCreateSet()
  const update = useUpdateSet(set?.id ?? '')
  const [initialValues] = useState(() => editorInitialValues(set))
  const form = useForm<SetFormValues, unknown, SetFormOutput>({
    resolver: zodResolver(setFormSchema),
    defaultValues: initialValues,
    // Le focus automatique de RHF viserait une ligne démontée par la virtualisation : voir `onInvalid`.
    shouldFocusError: false,
  })
  const {
    control,
    handleSubmit,
    getValues,
    setFocus,
    formState: { isDirty, isSubmitting },
  } = form
  const { fields, append, remove, move } = useFieldArray({ control, name: 'cards' })

  const listRef = useRef<FlatList<CardField>>(null)
  const pendingFocus = useRef<number | null>(null)
  const confirming = useRef(false)
  const flushTags = useRef<(() => void) | null>(null)
  const [released, setReleased] = useState(false)

  const disablePrevention = usePreventRemove(
    isDirty && !isSubmitting && !released,
    ({ repeat }) => {
      if (confirming.current) return
      confirming.current = true
      void confirm({
        title: 'Quitter sans enregistrer ?',
        message: 'Vos modifications seront perdues si vous quittez cette page.',
        confirmLabel: 'Quitter sans enregistrer',
        cancelLabel: "Continuer l'édition",
        destructive: true,
      }).then((leave) => {
        confirming.current = false
        if (!leave) return
        setReleased(true)
        repeat()
      })
    },
  )

  const moveCard = useCallback(
    (from: number, to: number) => {
      pendingFocus.current = null
      move(from, to)
      announce(moveAnnouncement(from, to))
    },
    [move],
  )

  const removeCard = useCallback(
    (index: number) => {
      pendingFocus.current = null
      remove(index)
      announce(removeAnnouncement(index))
    },
    [remove],
  )

  function addCard() {
    // Le focus est demandé à la ligne elle-même (`CardFieldsRow`) : elle n'existe pas encore.
    pendingFocus.current = getValues('cards').length
    append(emptyCard(), { shouldFocus: false })
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100)
  }

  async function onValid(values: SetFormOutput) {
    try {
      const input = toSetInput(values)
      const saved = set ? await update.mutateAsync(input) : await create.mutateAsync(input)
      // `isSubmitting` repasse à faux avant la navigation (file d'attente d'expo-router) : sans
      // ceci, la garde se réarmerait et demanderait de confirmer la sortie après l'enregistrement.
      setReleased(true)
      disablePrevention()
      toast.success(set ? 'Modifications enregistrées.' : 'Set créé.')
      router.dismissTo(routes.set(saved.id))
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  // La liste est virtualisée : une carte invalide peut ne pas être montée, on y amène l'écran.
  function onInvalid(errors: FieldErrors<SetFormValues>) {
    announce('Le formulaire contient des erreurs.')
    const target = firstErrorTarget(errors)
    if (target?.kind === 'header') {
      listRef.current?.scrollToOffset({ offset: 0, animated: true })
      if (errors.title) setFocus('title')
      else if (errors.description) setFocus('description')
    } else if (target?.kind === 'card') {
      listRef.current?.scrollToIndex({ index: target.index, viewPosition: 0.2, animated: true })
    }
  }

  function submit() {
    if (!guard()) return
    flushTags.current?.()
    void handleSubmit(onValid, onInvalid)()
  }

  function cancel() {
    if (router.canGoBack()) router.back()
    else router.replace(set ? routes.set(set.id) : routes.home)
  }

  // Quitter l'éditeur pour l'import : sans « replace », la liste de cartes serait périmée au retour.
  function importCards() {
    router.replace(set ? routes.importInto(set.id) : routes.importNew)
  }

  const lastIndex = fields.length - 1
  const renderItem = useCallback(
    ({ index }: ListRenderItemInfo<CardField>) => (
      <CardFieldsRow
        control={control}
        index={index}
        isLast={index === lastIndex}
        onMove={moveCard}
        onRemove={removeCard}
        pendingFocus={pendingFocus}
      />
    ),
    [control, lastIndex, moveCard, removeCard],
  )

  return (
    <Screen
      keyboardAvoiding
      footer={
        <View style={styles.footer}>
          <Button variant="ghost" label="Annuler" onPress={cancel} />
          <Button
            label={set ? 'Enregistrer' : 'Créer le set'}
            loading={isSubmitting}
            onPress={submit}
          />
        </View>
      }
    >
      <FlatList
        ref={listRef}
        data={fields}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={
          <EditorHeader control={control} onImport={importCards} flushTagsRef={flushTags} />
        }
        ListFooterComponent={
          <Button
            variant="outline"
            icon="plus"
            label="Ajouter une carte"
            fullWidth
            onPress={addCard}
          />
        }
        // Android découpe par défaut les vues hors écran : un champ multiligne actif y perd le
        // focus et le clavier. La virtualisation (`windowSize`) borne déjà le nombre de lignes.
        removeClippedSubviews={false}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={7}
        onScrollToIndexFailed={({ index, averageItemLength }) =>
          listRef.current?.scrollToOffset({ offset: index * averageItemLength, animated: true })
        }
        contentContainerStyle={styles.content}
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing['2xl'] },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
})
