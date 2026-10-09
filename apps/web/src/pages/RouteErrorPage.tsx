import { TriangleAlertIcon } from 'lucide-react'
import { useRouteError } from 'react-router'
import { EmptyState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { pageTitle } from '@/config'

/** Filet de sécurité pour une erreur de rendu inattendue. */
export function RouteErrorPage() {
  const error = useRouteError()
  console.error(error)

  return (
    <main className="mx-auto max-w-5xl px-4 py-16">
      <title>{pageTitle('Erreur')}</title>
      <EmptyState
        icon={<TriangleAlertIcon />}
        title="Quelque chose s'est mal passé"
        description="Une erreur inattendue a interrompu l'affichage de la page."
        action={<Button onClick={() => window.location.assign('/')}>Revenir à l'accueil</Button>}
      />
    </main>
  )
}
