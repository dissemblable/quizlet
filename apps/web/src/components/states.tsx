import { AlertCircleIcon, RotateCwIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { errorMessage } from '@/lib/http'

/** Squelette de page pendant un chargement (annoncé aux lecteurs d'écran). */
export function LoadingState({
  label = 'Chargement…',
  rows = 3,
}: {
  label?: string
  rows?: number
}) {
  return (
    <div aria-busy="true" aria-live="polite" className="space-y-4">
      <span className="sr-only">{label}</span>
      <Skeleton className="h-8 w-1/2 max-w-xs" />
      {Array.from({ length: rows }, (_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: liste statique de squelettes
        <Skeleton key={index} className="h-20 w-full" />
      ))}
    </div>
  )
}

export function ErrorState({
  error,
  onRetry,
  title = 'Impossible de charger les données',
}: {
  error: unknown
  onRetry?: () => void
  title?: string
}) {
  return (
    <Alert variant="destructive">
      <AlertCircleIcon />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{errorMessage(error)}</AlertDescription>
      {onRetry && (
        <AlertAction>
          <Button size="sm" variant="outline" onClick={onRetry}>
            <RotateCwIcon />
            Réessayer
          </Button>
        </AlertAction>
      )}
    </Alert>
  )
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode
  title: string
  description?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed px-6 py-12 text-center">
      {icon && (
        <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground [&_svg]:size-6">
          {icon}
        </div>
      )}
      <h2 className="text-lg font-semibold">{title}</h2>
      {description && <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}
