import { cn } from 'cn'
import type { ComponentProps, ReactNode, Ref } from 'react'

interface FlashcardProps {
  term: string
  definition: string
  flipped: boolean
  onFlip: () => void
  ref?: Ref<HTMLButtonElement>
}

/**
 * Carte retournable. Animation 3D, remplacée par un fondu si l'utilisateur demande moins
 * d'animations (prefers-reduced-motion). La face cachée est masquée aux lecteurs d'écran.
 */
export function Flashcard({ term, definition, flipped, onFlip, ref }: FlashcardProps) {
  return (
    <div className="perspective-distant">
      <button
        ref={ref}
        type="button"
        onClick={onFlip}
        className="block h-72 w-full rounded-2xl text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:h-80"
      >
        <div
          className={cn(
            'relative h-full w-full transition-transform duration-500 transform-3d motion-reduce:transition-none',
            flipped && 'motion-safe:rotate-y-180',
          )}
        >
          <Face
            label="Terme"
            aria-hidden={flipped}
            className={cn(flipped && 'motion-reduce:opacity-0')}
          >
            {term}
          </Face>
          <Face
            label="Définition"
            aria-hidden={!flipped}
            className={cn('motion-safe:rotate-y-180', !flipped && 'motion-reduce:opacity-0')}
          >
            {definition}
          </Face>
        </div>
      </button>
    </div>
  )
}

function Face({
  label,
  children,
  className,
  ...props
}: { label: string; children: ReactNode } & ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'absolute inset-0 flex flex-col gap-2 rounded-2xl border bg-card p-5 shadow-sm backface-hidden motion-reduce:transition-opacity motion-reduce:duration-200 sm:p-8',
        className,
      )}
      {...props}
    >
      <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      <div className="flex flex-1 items-center justify-center overflow-y-auto text-center text-xl font-medium whitespace-pre-line wrap-break-word sm:text-2xl">
        {children}
      </div>
    </div>
  )
}
