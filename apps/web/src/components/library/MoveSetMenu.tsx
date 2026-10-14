import { FolderInputIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { errorMessage } from '@/lib/http'
import { type SetSummary, useFolders, useMoveSet } from '@/lib/queries'

/** Menu « Déplacer vers… » d'une carte de la bibliothèque. */
export function MoveSetMenu({ set, className }: { set: SetSummary; className?: string }) {
  const folders = useFolders()
  const move = useMoveSet()

  async function moveTo(value: string) {
    const folderId = value === 'none' ? null : value
    if (folderId === set.folderId) return
    try {
      await move.mutateAsync({ setId: set.id, folderId })
      const folder = folders.data?.find((item) => item.id === folderId)
      toast.success(
        folder
          ? `« ${set.title} » rangé dans « ${folder.name} ».`
          : `« ${set.title} » est maintenant sans dossier.`,
      )
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className={className}
          aria-label={`Déplacer « ${set.title} » vers un dossier`}
        >
          <FolderInputIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Déplacer vers…</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={set.folderId ?? 'none'} onValueChange={moveTo}>
          <DropdownMenuRadioItem value="none">Sans dossier</DropdownMenuRadioItem>
          {folders.data?.map((folder) => (
            <DropdownMenuRadioItem key={folder.id} value={folder.id}>
              <span className="truncate">{folder.name}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
