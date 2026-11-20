import { errorMessage } from '@quizlet/shared'
import { StyleSheet } from 'react-native'
import { type FolderSummary, type SetSummary, useMoveSet } from '@/lib/queries'
import { useOnlineGuard } from '@/offline'
import { ListItem, Sheet, spacing, Text, toast } from '@/ui'
import { moveMessage } from './messages'

interface MoveSetSheetProps {
  /** Set à déplacer ; `null` = feuille fermée. */
  set: SetSummary | null
  folders: FolderSummary[] | undefined
  onClose: () => void
}

/** « Déplacer vers… » : « Sans dossier » et mes dossiers, le dossier courant est coché. */
export function MoveSetSheet({ set, folders, onClose }: MoveSetSheetProps) {
  const guard = useOnlineGuard()
  const move = useMoveSet()

  async function moveTo(folder: FolderSummary | null) {
    if (!set || move.isPending) return
    const folderId = folder?.id ?? null
    if (folderId === set.folderId) {
      onClose()
      return
    }
    if (!guard()) return
    try {
      await move.mutateAsync({ setId: set.id, folderId })
      toast.success(moveMessage(set.title, folder?.name))
      onClose()
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  return (
    <Sheet visible={set !== null} onClose={onClose} title="Déplacer vers…">
      {set ? (
        <Text variant="label" tone="muted" numberOfLines={2} style={styles.subject}>
          « {set.title} »
        </Text>
      ) : null}
      <ListItem
        title="Sans dossier"
        selected={set?.folderId === null}
        disabled={move.isPending}
        showChevron={false}
        onPress={() => void moveTo(null)}
      />
      {folders?.map((folder) => (
        <ListItem
          key={folder.id}
          title={folder.name}
          icon="folder"
          selected={set?.folderId === folder.id}
          disabled={move.isPending}
          showChevron={false}
          onPress={() => void moveTo(folder)}
        />
      ))}
    </Sheet>
  )
}

const styles = StyleSheet.create({
  subject: { marginBottom: spacing.sm },
})
