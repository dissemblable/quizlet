import { EmptyState, Screen } from '@/ui'
import { BackToSetButton } from './BackToSetButton'

/** Set sans carte : rien à étudier (flashcards et mode écrit). */
export function NoCards({ setId }: { setId: string }) {
  return (
    <Screen padded>
      <EmptyState
        title="Ce set ne contient aucune carte"
        description="Ajoutez des cartes au set pour pouvoir l'étudier."
        action={<BackToSetButton setId={setId} variant="primary" />}
      />
    </Screen>
  )
}
