import { errorMessage, type LibraryFilters, pluralize } from '@quizlet/shared'
import { useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { type FolderSummary, type TagSummary, useDeleteFolder } from '@/lib/queries'
import { useOnlineGuard } from '@/offline'
import { Button, Chip, confirm, spacing, Text, toast } from '@/ui'
import { FolderSheet } from './FolderSheet'
import { removeTag, toggleTag } from './filters'
import { deleteFolderConfirm, folderDeletedMessage } from './messages'
import { TagsSheet } from './TagsSheet'

interface FilterBarProps {
  filters: LibraryFilters
  folders: FolderSummary[] | undefined
  tags: TagSummary[] | undefined
  onChange: (patch: Partial<LibraryFilters>) => void
}

/** Filtres de la bibliothèque : dossier (un seul) et tags (le set doit tous les porter). */
export function FilterBar({ filters, folders, tags, onChange }: FilterBarProps) {
  const guard = useOnlineGuard()
  const deleteFolder = useDeleteFolder()
  const [folderSheetOpen, setFolderSheetOpen] = useState(false)
  // Gardé à la fermeture : le titre de la feuille ne change pas pendant son animation.
  const [renaming, setRenaming] = useState<FolderSummary | undefined>()
  const [tagsOpen, setTagsOpen] = useState(false)
  const activeFolder = folders?.find((folder) => folder.id === filters.folder)

  function openFolderSheet(folder: FolderSummary | undefined) {
    setRenaming(folder)
    setFolderSheetOpen(true)
  }

  async function removeFolder(folder: FolderSummary) {
    if (!guard()) return
    const { title, message } = deleteFolderConfirm(folder.name)
    const confirmed = await confirm({
      title,
      message,
      confirmLabel: 'Supprimer le dossier',
      destructive: true,
    })
    if (!confirmed) return
    try {
      await deleteFolder.mutateAsync(folder.id)
      toast.success(folderDeletedMessage(folder.name))
      onChange({ folder: undefined })
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  return (
    <View style={styles.root}>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text variant="label" weight="medium" tone="muted" accessibilityRole="header">
            Dossiers
          </Text>
          <Button
            label="Nouveau dossier"
            icon="folder-plus"
            variant="ghost"
            size="sm"
            onPress={() => openFolderSheet(undefined)}
          />
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.chips}
        >
          <Chip
            label="Tous"
            selected={!filters.folder}
            onPress={() => onChange({ folder: undefined })}
          />
          <Chip
            label="Sans dossier"
            selected={filters.folder === 'none'}
            onPress={() => onChange({ folder: 'none' })}
          />
          {folders?.map((folder) => (
            <Chip
              key={folder.id}
              label={folder.name}
              icon="folder"
              count={folder.setCount}
              accessibilityLabel={`${folder.name}, ${pluralize(folder.setCount, 'set')}`}
              selected={folder.id === filters.folder}
              onPress={() => onChange({ folder: folder.id })}
            />
          ))}
        </ScrollView>
        {activeFolder ? (
          <View style={styles.actions}>
            <Button
              label="Renommer"
              icon="edit-2"
              variant="outline"
              size="sm"
              onPress={() => openFolderSheet(activeFolder)}
            />
            <Button
              label="Supprimer le dossier"
              icon="trash-2"
              variant="outline"
              size="sm"
              loading={deleteFolder.isPending}
              onPress={() => void removeFolder(activeFolder)}
            />
          </View>
        ) : null}
      </View>

      {tags && tags.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text variant="label" weight="medium" tone="muted" accessibilityRole="header">
              Tags
            </Text>
            <Button
              label="Gérer les tags"
              icon="settings"
              variant="ghost"
              size="sm"
              onPress={() => setTagsOpen(true)}
            />
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.chips}
          >
            {tags.map((tag) => (
              <Chip
                key={tag.id}
                label={`#${tag.name}`}
                selected={filters.tags.includes(tag.id)}
                onPress={() => onChange({ tags: toggleTag(filters.tags, tag.id) })}
              />
            ))}
          </ScrollView>
        </View>
      ) : null}

      <FolderSheet
        visible={folderSheetOpen}
        folder={renaming}
        onClose={() => setFolderSheetOpen(false)}
      />
      <TagsSheet
        visible={tagsOpen}
        tags={tags ?? []}
        onClose={() => setTagsOpen(false)}
        onDeleted={(id) => onChange({ tags: removeTag(filters.tags, id) })}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { gap: spacing.md },
  section: { gap: spacing.xs },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chips: { gap: spacing.sm, paddingRight: spacing.lg },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
})
