import { useRouter } from 'expo-router'
import { routes } from '@/lib/routes'
import { Button, EmptyState, Screen } from '@/ui'

/** Route inconnue (`+not-found`) : hors de la pile `(app)`, donc sans en-tête de navigation. */
export function NotFoundScreen() {
  const router = useRouter()
  return (
    <Screen padded edges={['top', 'bottom', 'left', 'right']}>
      <EmptyState
        icon="compass"
        title="Page introuvable"
        description="Cette page n'existe pas ou a été déplacée."
        action={
          <Button label="Retour à la bibliothèque" onPress={() => router.replace(routes.home)} />
        }
      />
    </Screen>
  )
}
