import { Loader2Icon, Trash2Icon } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
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
import { useDeleteSet } from '@/lib/queries'

export function DeleteSetDialog({ setId, title }: { setId: string; title: string }) {
  const [open, setOpen] = useState(false)
  const deleteSet = useDeleteSet()
  const navigate = useNavigate()

  async function confirm() {
    try {
      await deleteSet.mutateAsync(setId)
      setOpen(false)
      toast.success(`« ${title} » a été supprimé.`)
      navigate('/')
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive">
          <Trash2Icon />
          Supprimer
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer ce set ?</AlertDialogTitle>
          <AlertDialogDescription>
            « {title} » et toutes ses cartes seront supprimés définitivement.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteSet.isPending}>Annuler</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={deleteSet.isPending}
            onClick={(event) => {
              event.preventDefault() // garder la fenêtre ouverte pendant la requête
              void confirm()
            }}
          >
            {deleteSet.isPending && <Loader2Icon className="animate-spin" />}
            Supprimer définitivement
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
