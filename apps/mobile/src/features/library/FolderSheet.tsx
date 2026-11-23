import { errorMessage, LIMITS } from '@quizlet/shared'
import { useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useCreateFolder, useRenameFolder } from '@/lib/queries'
import { useOnlineGuard } from '@/offline'
import { Button, Sheet, spacing, TextField, toast } from '@/ui'
import { folderSavedMessage } from './messages'

interface FolderSheetProps {
  visible: boolean
  /** Dossier à renommer ; absent = création. */
  folder?: { id: string; name: string }
  onClose: () => void
}

/** Création d'un dossier, ou renommage de `folder`. */
export function FolderSheet({ visible, folder, onClose }: FolderSheetProps) {
  const guard = useOnlineGuard()
  const create = useCreateFolder()
  const rename = useRenameFolder()
  const [name, setName] = useState('')
  const pending = create.isPending || rename.isPending
  const trimmed = name.trim()
  const initialName = folder?.name ?? ''

  // Repart du nom courant à chaque ouverture.
  useEffect(() => {
    if (visible) setName(initialName)
  }, [visible, initialName])

  async function submit() {
    if (trimmed === '' || pending || !guard()) return
    try {
      if (folder) await rename.mutateAsync({ id: folder.id, name: trimmed })
      else await create.mutateAsync(trimmed)
      toast.success(folderSavedMessage(trimmed, folder !== undefined))
      onClose()
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={folder ? 'Renommer le dossier' : 'Nouveau dossier'}
      footer={
        <View style={styles.footer}>
          <Button
            label="Annuler"
            variant="outline"
            disabled={pending}
            onPress={onClose}
            style={styles.action}
          />
          <Button
            label={folder ? 'Renommer' : 'Créer le dossier'}
            disabled={trimmed === ''}
            loading={pending}
            onPress={() => void submit()}
            style={styles.action}
          />
        </View>
      }
    >
      <TextField
        label="Nom du dossier"
        value={name}
        onChangeText={setName}
        maxLength={LIMITS.folderName}
        autoFocus
        autoComplete="off"
        returnKeyType="done"
        onSubmitEditing={() => void submit()}
      />
    </Sheet>
  )
}

const styles = StyleSheet.create({
  footer: { flexDirection: 'row', gap: spacing.md },
  action: { flex: 1 },
})
