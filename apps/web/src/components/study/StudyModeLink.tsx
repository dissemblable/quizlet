import type { ReactNode } from 'react'
import { Link } from 'react-router'

interface StudyModeLinkProps {
  to: string
  icon: ReactNode
  title: string
  description: string
  /** Raison affichée quand le mode n'est pas disponible (le lien est alors désactivé). */
  unavailableReason?: string
}

export function StudyModeLink({
  to,
  icon,
  title,
  description,
  unavailableReason,
}: StudyModeLinkProps) {
  const content = (
    <>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary [&_svg]:size-5">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block font-semibold">{title}</span>
        <span className="block text-sm text-muted-foreground">
          {unavailableReason ?? description}
        </span>
      </span>
    </>
  )
  const base = 'flex items-center gap-4 rounded-xl border bg-card p-4'

  if (unavailableReason) {
    return (
      <div aria-disabled="true" className={`${base} opacity-60`}>
        {content}
      </div>
    )
  }
  return (
    <Link
      to={to}
      className={`${base} outline-none transition-colors hover:border-primary/40 hover:bg-accent/40 focus-visible:ring-3 focus-visible:ring-ring/50`}
    >
      {content}
    </Link>
  )
}
