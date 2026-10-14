import { BrainIcon } from 'lucide-react'
import { NavLink } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useReviewSummary } from '@/lib/queries'

/** Lien « Révision » de l'en-tête, avec le nombre de cartes à réviser aujourd'hui. */
export function ReviewLink() {
  const summary = useReviewSummary()
  const count = summary.data ? summary.data.due + summary.data.new : 0

  return (
    <Button asChild variant="ghost" size="sm">
      <NavLink to="/review" end>
        <BrainIcon />
        <span className="sr-only sm:not-sr-only">Révision</span>{' '}
        {count > 0 && (
          <Badge className="tabular-nums">
            {count} <span className="sr-only">à réviser</span>
          </Badge>
        )}
      </NavLink>
    </Button>
  )
}
