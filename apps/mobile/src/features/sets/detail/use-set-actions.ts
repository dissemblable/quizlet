import { errorMessage } from '@quizlet/shared'
import { useRouter } from 'expo-router'
import { config } from '@/config'
import { copyText } from '@/lib/device'
import { type SetDetail, useDeleteSet, useDuplicateSet } from '@/lib/queries'
import { routes } from '@/lib/routes'
import { useOnlineGuard } from '@/offline'
import { confirm, toast } from '@/ui'
import { setWebUrl } from './set-meta'

/** Actions du détail d'un set. Les écritures sont gardées hors ligne (`useOnlineGuard`). */
export function useSetActions(set: SetDetail) {
  const router = useRouter()
  const guard = useOnlineGuard()
  const duplicate = useDuplicateSet()
  const deleteSet = useDeleteSet()

  async function duplicateSet() {
    if (!guard()) return
    try {
      const copy = await duplicate.mutateAsync(set.id)
      toast.success('Set dupliqué dans votre bibliothèque.')
      router.push(routes.set(copy.id))
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  async function copyLink() {
    // `copyText` ne rejette jamais : il renvoie `false` en cas d'échec.
    const copied = await copyText(setWebUrl(config.webUrl, set.id))
    if (copied) toast.success('Lien copié dans le presse-papiers.')
    else toast.error('Impossible de copier le lien automatiquement.')
  }

  async function removeSet() {
    if (!guard()) return
    const confirmed = await confirm({
      title: 'Supprimer ce set ?',
      message: `« ${set.title} » et toutes ses cartes seront supprimés définitivement.`,
      confirmLabel: 'Supprimer définitivement',
      destructive: true,
    })
    if (!confirmed) return
    try {
      await deleteSet.mutateAsync(set.id)
      toast.success(`« ${set.title} » a été supprimé.`)
      router.dismissTo(routes.home)
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  return {
    duplicateSet,
    copyLink,
    removeSet,
    duplicating: duplicate.isPending,
    deleting: deleteSet.isPending,
  }
}
