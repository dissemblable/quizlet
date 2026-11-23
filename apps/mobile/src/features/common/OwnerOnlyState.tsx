import { useRouter } from 'expo-router'
import { routes } from '@/lib/routes'
import { Button, EmptyState } from '@/ui'

const DEFAULT_TITLE = "Modification réservée à l'auteur"
const DEFAULT_DESCRIPTION =
  'Dupliquez ce set pour en obtenir une copie modifiable dans votre bibliothèque.'

/**
 * Action réservée à l'auteur du set (éditeur : « Modification réservée à l'auteur » ; import :
 * « Import réservé à l'auteur »). « Voir le set » revient à l'écran du set sans en empiler un second.
 */
export function OwnerOnlyState({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  setId,
}: {
  title?: string
  description?: string
  setId: string
}) {
  const router = useRouter()
  return (
    <EmptyState
      icon="lock"
      title={title}
      description={description}
      action={<Button label="Voir le set" onPress={() => router.dismissTo(routes.set(setId))} />}
    />
  )
}
