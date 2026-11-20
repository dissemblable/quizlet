import type { LibraryFilters } from '@quizlet/shared'
import { Button, EmptyState, type IconName } from '@/ui'
import { type EmptyVariant, emptyVariant } from './filters'
import { emptyCopy } from './messages'

interface LibraryEmptyProps {
  filters: LibraryFilters
  onClearSearch: () => void
  onResetFilters: () => void
  onCreate: () => void
}

const ICONS: Record<EmptyVariant, IconName> = {
  search: 'search',
  filters: 'folder',
  library: 'book-open',
}

/** Les trois états vides : recherche sans résultat, filtres trop stricts, bibliothèque vide. */
export function LibraryEmpty({
  filters,
  onClearSearch,
  onResetFilters,
  onCreate,
}: LibraryEmptyProps) {
  const variant = emptyVariant(filters)
  const { title, description, actionLabel } = emptyCopy(variant, filters.q)
  const handlers: Record<EmptyVariant, () => void> = {
    search: onClearSearch,
    filters: onResetFilters,
    library: onCreate,
  }

  return (
    <EmptyState
      icon={ICONS[variant]}
      title={title}
      description={description}
      action={
        <Button
          label={actionLabel}
          icon={variant === 'library' ? 'plus' : undefined}
          variant={variant === 'library' ? 'primary' : 'outline'}
          onPress={handlers[variant]}
        />
      }
    />
  )
}
