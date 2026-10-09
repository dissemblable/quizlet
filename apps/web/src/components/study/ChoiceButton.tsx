import { cn } from 'cn'
import { CheckIcon, XIcon } from 'lucide-react'

export type ChoiceStatus = 'idle' | 'correct' | 'wrong' | 'dimmed'

interface ChoiceButtonProps {
  index: number
  label: string
  status: ChoiceStatus
  onSelect: () => void
}

const STATUS_CLASSES: Record<ChoiceStatus, string> = {
  idle: 'hover:border-primary/40 hover:bg-accent/40',
  correct: 'border-emerald-500 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300',
  wrong: 'border-destructive bg-destructive/10 text-destructive',
  dimmed: 'opacity-60',
}

export function ChoiceButton({ index, label, status, onSelect }: ChoiceButtonProps) {
  const shortcut = String(index + 1)
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={status !== 'idle'}
      aria-keyshortcuts={shortcut}
      className={cn(
        'flex w-full items-center gap-3 rounded-xl border bg-card p-4 text-left outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default',
        STATUS_CLASSES[status],
      )}
    >
      <span
        aria-hidden="true"
        className="flex size-7 shrink-0 items-center justify-center rounded-md border text-xs font-medium text-muted-foreground"
      >
        {shortcut}
      </span>
      <span className="flex-1 whitespace-pre-line wrap-break-word">{label}</span>
      {status === 'correct' && (
        <>
          <CheckIcon className="size-5 shrink-0" aria-hidden="true" />
          <span className="sr-only">(bonne réponse)</span>
        </>
      )}
      {status === 'wrong' && (
        <>
          <XIcon className="size-5 shrink-0" aria-hidden="true" />
          <span className="sr-only">(votre réponse)</span>
        </>
      )}
    </button>
  )
}
