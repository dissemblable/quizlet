import { LIMITS } from '@quizlet/shared'
import { Loader2Icon } from 'lucide-react'
import { type FormEvent, type ReactNode, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { errorMessage } from '@/lib/http'
import { useCreateFolder, useRenameFolder } from '@/lib/queries'

/** Création d'un dossier, ou renommage de `folder`. */
export function FolderDialog({
  folder,
  trigger,
}: {
  folder?: { id: string; name: string }
  trigger: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const create = useCreateFolder()
  const rename = useRenameFolder()
  const pending = create.isPending || rename.isPending

  function onOpenChange(next: boolean) {
    if (next) setName(folder?.name ?? '')
    setOpen(next)
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    const trimmed = name.trim()
    try {
      if (folder) await rename.mutateAsync({ id: folder.id, name: trimmed })
      else await create.mutateAsync(trimmed)
      toast.success(folder ? 'Dossier renommé.' : `Dossier « ${trimmed} » créé.`)
      setOpen(false)
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent aria-describedby={undefined}>
        <form onSubmit={submit} className="grid gap-6">
          <DialogHeader>
            <DialogTitle>{folder ? 'Renommer le dossier' : 'Nouveau dossier'}</DialogTitle>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="folder-name">Nom du dossier</FieldLabel>
            <Input
              id="folder-name"
              value={name}
              maxLength={LIMITS.folderName}
              autoComplete="off"
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Annuler
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending || name.trim() === ''}>
              {pending && <Loader2Icon className="animate-spin" />}
              {folder ? 'Renommer' : 'Créer le dossier'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
