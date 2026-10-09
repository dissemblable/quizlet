import { ArrowDownIcon, ArrowUpIcon, Trash2Icon } from 'lucide-react'
import type { FieldErrors, UseFormRegister } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import type { SetFormValues } from '@/lib/set-form'

interface CardFieldsRowProps {
  index: number
  count: number
  register: UseFormRegister<SetFormValues>
  errors: FieldErrors<SetFormValues>
  onMove: (from: number, to: number) => void
  onRemove: (index: number) => void
}

export function CardFieldsRow({
  index,
  count,
  register,
  errors,
  onMove,
  onRemove,
}: CardFieldsRowProps) {
  const number = index + 1
  const cardErrors = errors.cards?.[index]
  const termId = `card-${index}-term`
  const definitionId = `card-${index}-definition`

  return (
    <li className="rounded-xl border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-muted-foreground">Carte {number}</span>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Monter la carte ${number}`}
            disabled={index === 0}
            onClick={() => onMove(index, index - 1)}
          >
            <ArrowUpIcon />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Descendre la carte ${number}`}
            disabled={index === count - 1}
            onClick={() => onMove(index, index + 1)}
          >
            <ArrowDownIcon />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Supprimer la carte ${number}`}
            onClick={() => onRemove(index)}
          >
            <Trash2Icon />
          </Button>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field data-invalid={Boolean(cardErrors?.term)}>
          <FieldLabel htmlFor={termId}>Terme</FieldLabel>
          <Textarea
            id={termId}
            rows={2}
            aria-invalid={Boolean(cardErrors?.term)}
            {...register(`cards.${index}.term`)}
          />
          <FieldError errors={[cardErrors?.term]} />
        </Field>
        <Field data-invalid={Boolean(cardErrors?.definition)}>
          <FieldLabel htmlFor={definitionId}>Définition</FieldLabel>
          <Textarea
            id={definitionId}
            rows={2}
            aria-invalid={Boolean(cardErrors?.definition)}
            {...register(`cards.${index}.definition`)}
          />
          <FieldError errors={[cardErrors?.definition]} />
        </Field>
      </div>
    </li>
  )
}
