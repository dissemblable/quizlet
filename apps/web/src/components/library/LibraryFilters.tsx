import { FolderIcon, FolderPlusIcon, PencilIcon } from 'lucide-react'
import type { ComponentProps } from 'react'
import { Button } from '@/components/ui/button'
import { type LibraryFilters as Filters, useFolders, useTags } from '@/lib/queries'
import { DeleteFolderDialog } from './DeleteFolderDialog'
import { FolderDialog } from './FolderDialog'
import { TagsDialog } from './TagsDialog'

function FilterChip({ pressed, ...props }: { pressed: boolean } & ComponentProps<typeof Button>) {
  return (
    <Button
      size="sm"
      variant={pressed ? 'secondary' : 'ghost'}
      aria-pressed={pressed}
      className="rounded-full"
      {...props}
    />
  )
}

/** Filtres de la bibliothèque : dossier (un seul) et tags (le set doit tous les porter). */
export function LibraryFilters({
  filters,
  onChange,
}: {
  filters: Filters
  onChange: (patch: Partial<Filters>) => void
}) {
  const folders = useFolders()
  const tags = useTags()
  const activeFolder = folders.data?.find((folder) => folder.id === filters.folder)

  function toggleTag(id: string) {
    const selected = filters.tags.includes(id)
    onChange({ tags: selected ? filters.tags.filter((tag) => tag !== id) : [...filters.tags, id] })
  }

  return (
    <div className="mb-6 space-y-2">
      <fieldset className="flex flex-wrap items-center gap-1">
        <legend className="sr-only">Dossiers</legend>
        <FilterChip pressed={!filters.folder} onClick={() => onChange({ folder: undefined })}>
          Tous
        </FilterChip>
        <FilterChip
          pressed={filters.folder === 'none'}
          onClick={() => onChange({ folder: 'none' })}
        >
          Sans dossier
        </FilterChip>
        {folders.data?.map((folder) => (
          <FilterChip
            key={folder.id}
            pressed={folder.id === filters.folder}
            onClick={() => onChange({ folder: folder.id })}
          >
            <FolderIcon aria-hidden="true" />
            {folder.name}
            <span className="text-muted-foreground">{folder.setCount}</span>
          </FilterChip>
        ))}
        <FolderDialog
          trigger={
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              <FolderPlusIcon />
              Nouveau dossier
            </Button>
          }
        />
      </fieldset>

      {activeFolder && (
        <div className="flex flex-wrap gap-2">
          <FolderDialog
            folder={activeFolder}
            trigger={
              <Button variant="outline" size="sm">
                <PencilIcon />
                Renommer
              </Button>
            }
          />
          <DeleteFolderDialog
            folder={activeFolder}
            onDeleted={() => onChange({ folder: undefined })}
          />
        </div>
      )}

      {tags.data && tags.data.length > 0 && (
        <fieldset className="flex flex-wrap items-center gap-1">
          <legend className="sr-only">Tags</legend>
          {tags.data.map((tag) => (
            <FilterChip
              key={tag.id}
              pressed={filters.tags.includes(tag.id)}
              onClick={() => toggleTag(tag.id)}
            >
              #{tag.name}
            </FilterChip>
          ))}
          <TagsDialog
            tags={tags.data}
            onDeleted={(id) => onChange({ tags: filters.tags.filter((tag) => tag !== id) })}
          />
        </fieldset>
      )}
    </div>
  )
}
