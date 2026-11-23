import { errorMessage, pluralize } from '@quizlet/shared'
import { StyleSheet, View } from 'react-native'
import { type TagSummary, useDeleteTag } from '@/lib/queries'
import { useOnlineGuard } from '@/offline'
import { Divider, IconButton, Sheet, spacing, Text, toast } from '@/ui'
import { tagDeletedMessage } from './messages'

interface TagsSheetProps {
  visible: boolean
  tags: TagSummary[]
  onClose: () => void
  onDeleted: (id: string) => void
}

/** Liste de mes tags, avec suppression (les tags se créent dans l'éditeur de set). */
export function TagsSheet({ visible, tags, onClose, onDeleted }: TagsSheetProps) {
  const guard = useOnlineGuard()
  const deleteTag = useDeleteTag()

  async function remove(tag: TagSummary) {
    if (!guard()) return
    try {
      await deleteTag.mutateAsync(tag.id)
      toast.success(tagDeletedMessage(tag.name))
      onDeleted(tag.id)
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  return (
    <Sheet visible={visible} onClose={onClose} title="Mes tags">
      <Text variant="label" tone="muted">
        Supprimer un tag le retire de vos sets, sans supprimer les sets.
      </Text>
      {tags.length === 0 ? (
        <Text tone="muted" style={styles.empty} accessibilityLiveRegion="polite">
          Aucun tag.
        </Text>
      ) : (
        // shortcut: ScrollView de la feuille sans virtualisation, passer à une FlatList
        // (`scroll={false}` + `fullHeight`) si un compte atteint plusieurs centaines de tags.
        <View style={styles.list}>
          {tags.map((tag, index) => (
            <View key={tag.id}>
              {index > 0 ? <Divider /> : null}
              <View style={styles.row}>
                <Text style={styles.name} numberOfLines={1}>
                  #{tag.name}{' '}
                  <Text tone="muted" variant="label">
                    ({pluralize(tag.setCount, 'set')})
                  </Text>
                </Text>
                <IconButton
                  icon="trash-2"
                  label={`Supprimer le tag ${tag.name}`}
                  disabled={deleteTag.isPending}
                  onPress={() => void remove(tag)}
                />
              </View>
            </View>
          ))}
        </View>
      )}
    </Sheet>
  )
}

const styles = StyleSheet.create({
  empty: { marginTop: spacing.md },
  list: { marginTop: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { flex: 1, flexShrink: 1 },
})
