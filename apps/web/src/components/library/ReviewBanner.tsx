import { BrainIcon } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { pluralize } from '@/lib/format'
import { useReviewSummary } from '@/lib/queries'

/** Accueil : nombre de cartes de la révision du jour, et accès direct à la séance. */
export function ReviewBanner() {
  const summary = useReviewSummary()
  if (!summary.data) return null

  const { due, new: fresh } = summary.data
  return (
    <section
      aria-labelledby="review-banner-title"
      className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4"
    >
      <div>
        <h2 id="review-banner-title" className="font-semibold">
          Révision du jour
        </h2>
        <p className="text-sm text-muted-foreground">
          {due + fresh === 0
            ? 'Rien à réviser pour le moment.'
            : `${pluralize(due, 'carte due', 'cartes dues')} · ${pluralize(fresh, 'nouvelle carte', 'nouvelles cartes')}`}
        </p>
      </div>
      {due + fresh > 0 && (
        <Button asChild>
          <Link to="/review">
            <BrainIcon />
            Réviser
          </Link>
        </Button>
      )}
    </section>
  )
}
