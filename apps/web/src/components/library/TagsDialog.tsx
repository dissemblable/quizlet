import { Settings2Icon, Trash2Icon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { pluralize } from '@/lib/format'
import { errorMessage } from '@/lib/http'
import { type TagSummary, useDeleteTag } from '@/lib/queries'

/** Liste de mes tags, avec suppression (les tags se créent dans l'éditeur de set). */
export function TagsDialog({
  tags,
  onDeleted,
}: {
  tags: TagSummary[]
  onDeleted: (id: string) => void
}) {
  const deleteTag = useDeleteTag()

  async function remove(tag: TagSummary) {
    try {
      await deleteTag.mutateAsync(tag.id)
      toast.success(`Tag « ${tag.name} » supprimé.`)
      onDeleted(tag.id)
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Settings2Icon />
          Gérer les tags
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mes tags</DialogTitle>
          <DialogDescription>
            Supprimer un tag le retire de vos sets, sans supprimer les sets.
          </DialogDescription>
        </DialogHeader>
        {tags.length === 0 ? (
          <p className="text-muted-foreground">Aucun tag.</p>
        ) : (
          <ul className="max-h-80 divide-y overflow-y-auto rounded-lg border">
            {tags.map((tag) => (
              <li key={tag.id} className="flex items-center justify-between gap-2 py-1 pr-1 pl-3">
                <span className="min-w-0 truncate">
                  #{tag.name}{' '}
                  <span className="text-muted-foreground">({pluralize(tag.setCount, 'set')})</span>
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Supprimer le tag ${tag.name}`}
                  disabled={deleteTag.isPending}
                  onClick={() => void remove(tag)}
                >
                  <Trash2Icon />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  )
}
