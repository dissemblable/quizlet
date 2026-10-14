import { Loader2Icon, Trash2Icon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { errorMessage } from '@/lib/http'
import { type FolderSummary, useDeleteFolder } from '@/lib/queries'

export function DeleteFolderDialog({
  folder,
  onDeleted,
}: {
  folder: FolderSummary
  onDeleted: () => void
}) {
  const [open, setOpen] = useState(false)
  const deleteFolder = useDeleteFolder()

  async function confirm() {
    try {
      await deleteFolder.mutateAsync(folder.id)
      setOpen(false)
      toast.success(`Dossier « ${folder.name} » supprimé.`)
      onDeleted()
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Trash2Icon />
          Supprimer le dossier
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer le dossier « {folder.name} » ?</AlertDialogTitle>
          <AlertDialogDescription>
            Ses sets ne sont pas supprimés : ils repassent dans « Sans dossier ».
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteFolder.isPending}>Annuler</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={deleteFolder.isPending}
            onClick={(event) => {
              event.preventDefault() // garder la fenêtre ouverte pendant la requête
              void confirm()
            }}
          >
            {deleteFolder.isPending && <Loader2Icon className="animate-spin" />}
            Supprimer le dossier
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
