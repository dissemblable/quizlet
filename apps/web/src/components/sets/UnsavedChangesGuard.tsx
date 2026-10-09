import { type RefObject, useEffect } from 'react'
import { useBlocker } from 'react-router'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

/**
 * Demande confirmation avant de quitter une page dont les modifications ne sont pas enregistrées.
 * `allowLeave` est un ref (lu au moment de la navigation) : on le passe à true juste avant de
 * naviguer après un enregistrement réussi, sans attendre un nouveau rendu.
 */
export function UnsavedChangesGuard({
  when,
  allowLeave,
}: {
  when: boolean
  allowLeave: RefObject<boolean>
}) {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      when && !allowLeave.current && currentLocation.pathname !== nextLocation.pathname,
  )

  useEffect(() => {
    if (!when) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [when])

  return (
    <AlertDialog
      open={blocker.state === 'blocked'}
      onOpenChange={(open) => {
        if (!open && blocker.state === 'blocked') blocker.reset()
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Quitter sans enregistrer ?</AlertDialogTitle>
          <AlertDialogDescription>
            Vos modifications seront perdues si vous quittez cette page.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Continuer l'édition</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={() => blocker.proceed?.()}>
            Quitter sans enregistrer
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
