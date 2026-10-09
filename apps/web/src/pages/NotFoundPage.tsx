import { CompassIcon } from 'lucide-react'
import { Link } from 'react-router'
import { EmptyState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { pageTitle } from '@/config'

export function NotFoundPage({
  title = 'Page introuvable',
  description = "Cette page n'existe pas ou a été déplacée.",
}: {
  title?: string
  description?: string
}) {
  return (
    <>
      <title>{pageTitle(title)}</title>
      <EmptyState
        icon={<CompassIcon />}
        title={title}
        description={description}
        action={
          <Button asChild>
            <Link to="/">Retour à la bibliothèque</Link>
          </Button>
        }
      />
    </>
  )
}
