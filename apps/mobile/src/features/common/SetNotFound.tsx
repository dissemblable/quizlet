import { useRouter } from 'expo-router'
import { routes } from '@/lib/routes'
import { Button, EmptyState } from '@/ui'

/** Set absent, supprimé ou non public (404 de l'API). Mêmes textes que le web. */
export function SetNotFound() {
  const router = useRouter()
  return (
    <EmptyState
      icon="compass"
      title="Set introuvable"
      description="Ce set n'existe pas, a été supprimé, ou n'est pas public."
      action={
        <Button label="Retour à la bibliothèque" onPress={() => router.dismissTo(routes.home)} />
      }
    />
  )
}
