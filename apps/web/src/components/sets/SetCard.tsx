import { Link } from 'react-router'
import { MoveSetMenu } from '@/components/library/MoveSetMenu'
import { formatDate, pluralize } from '@/lib/format'
import type { SetSummary } from '@/lib/queries'
import { VisibilityBadge } from './VisibilityBadge'

export function SetCard({ set }: { set: SetSummary }) {
  return (
    <li className="relative">
      <Link
        to={`/sets/${set.id}`}
        className="flex h-full flex-col rounded-xl border bg-card p-5 pr-12 outline-none transition-colors hover:border-primary/40 hover:bg-accent/40 focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <h2 className="line-clamp-2 font-semibold leading-snug wrap-break-word">{set.title}</h2>
        {set.description && (
          <p className="mt-1 line-clamp-2 text-sm wrap-break-word text-muted-foreground">
            {set.description}
          </p>
        )}
        {set.tags.length > 0 && (
          <p className="mt-2 flex flex-wrap gap-x-2 text-xs text-muted-foreground">
            <span className="sr-only">Tags : </span>
            {set.tags.map((tag) => (
              <span key={tag.id}>#{tag.name}</span>
            ))}
          </p>
        )}
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-4 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{pluralize(set.cardCount, 'carte')}</span>
          <VisibilityBadge visibility={set.visibility} />
          <span className="ml-auto">
            <span className="sr-only">Modifié le </span>
            {formatDate(set.updatedAt)}
          </span>
        </div>
      </Link>
      <MoveSetMenu set={set} className="absolute top-3 right-3" />
    </li>
  )
}
