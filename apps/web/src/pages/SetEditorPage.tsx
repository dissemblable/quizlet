import { zodResolver } from '@hookform/resolvers/zod'
import { GlobeIcon, Loader2Icon, LockIcon, PlusIcon } from 'lucide-react'
import { useRef, useState } from 'react'
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { CardFieldsRow } from '@/components/sets/CardFieldsRow'
import { UnsavedChangesGuard } from '@/components/sets/UnsavedChangesGuard'
import { EmptyState } from '@/components/states'
import { Button } from '@/components/ui/button'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Textarea } from '@/components/ui/textarea'
import { pageTitle } from '@/config'
import { pluralize } from '@/lib/format'
import { errorMessage } from '@/lib/http'
import { type SetDetail, useCreateSet, useUpdateSet } from '@/lib/queries'
import {
  countFilledCards,
  emptyCard,
  newSetFormValues,
  type SetFormOutput,
  type SetFormValues,
  setFormSchema,
  setToFormValues,
  toSetInput,
} from '@/lib/set-form'
import { SetQueryStates, useSetFromRoute } from '@/pages/SetPage'

export function NewSetPage() {
  return <SetEditor initialValues={newSetFormValues()} />
}

export function EditSetPage() {
  const query = useSetFromRoute()
  if (!query.data) return <SetQueryStates query={query} />

  const set = query.data
  if (!set.isOwner) {
    return (
      <EmptyState
        icon={<LockIcon />}
        title="Modification réservée à l'auteur"
        description="Dupliquez ce set pour en obtenir une copie modifiable dans votre bibliothèque."
        action={
          <Button asChild>
            <Link to={`/sets/${set.id}`}>Voir le set</Link>
          </Button>
        }
      />
    )
  }
  return <SetEditor key={set.id} set={set} initialValues={setToFormValues(set)} />
}

const VISIBILITY_OPTIONS = [
  {
    value: 'private',
    title: 'Privé',
    description: 'Visible par vous seul.',
    Icon: LockIcon,
  },
  {
    value: 'public',
    title: 'Public',
    description:
      'Consultable et étudiable via son lien par tout utilisateur connecté. Vous seul pouvez le modifier.',
    Icon: GlobeIcon,
  },
] as const

function SetEditor({ set, initialValues }: { set?: SetDetail; initialValues: SetFormValues }) {
  const navigate = useNavigate()
  const create = useCreateSet()
  const update = useUpdateSet(set?.id ?? '')
  const allowLeave = useRef(false)
  const addButton = useRef<HTMLButtonElement>(null)
  const [announcement, setAnnouncement] = useState('')

  const form = useForm<SetFormValues, unknown, SetFormOutput>({
    resolver: zodResolver(setFormSchema),
    defaultValues: initialValues,
  })
  const {
    register,
    control,
    formState: { errors, isDirty, isSubmitting },
  } = form
  const { fields, append, remove, move } = useFieldArray({ control, name: 'cards' })
  const filledCount = countFilledCards(useWatch({ control, name: 'cards' }) ?? [])
  const cardsError = errors.cards?.root?.message ?? errors.cards?.message

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const input = toSetInput(values)
      const saved = set ? await update.mutateAsync(input) : await create.mutateAsync(input)
      allowLeave.current = true
      toast.success(set ? 'Modifications enregistrées.' : 'Set créé.')
      navigate(`/sets/${saved.id}`)
    } catch (error) {
      toast.error(errorMessage(error))
    }
  })

  function moveCard(from: number, to: number) {
    move(from, to)
    setAnnouncement(`Carte ${from + 1} déplacée en position ${to + 1}.`)
  }

  function removeCard(index: number) {
    remove(index)
    setAnnouncement(`Carte ${index + 1} supprimée.`)
    // Le focus passe à la carte suivante (ou au bouton d'ajout s'il n'en reste aucune).
    const next = Math.min(index, fields.length - 2)
    requestAnimationFrame(() => {
      if (next >= 0) form.setFocus(`cards.${next}.term`)
      else addButton.current?.focus()
    })
  }

  return (
    <form onSubmit={onSubmit} noValidate aria-labelledby="editor-title">
      <title>{pageTitle(set ? `Modifier « ${set.title} »` : 'Nouveau set')}</title>
      <UnsavedChangesGuard when={isDirty && !isSubmitting} allowLeave={allowLeave} />

      <h1 id="editor-title" className="mb-8 text-2xl font-semibold tracking-tight">
        {set ? 'Modifier le set' : 'Nouveau set'}
      </h1>

      <FieldGroup>
        <Field data-invalid={Boolean(errors.title)}>
          <FieldLabel htmlFor="title">Titre</FieldLabel>
          <Input
            id="title"
            placeholder="Ex. : Capitales européennes"
            aria-invalid={Boolean(errors.title)}
            {...register('title')}
          />
          <FieldError errors={[errors.title]} />
        </Field>

        <Field data-invalid={Boolean(errors.description)}>
          <FieldLabel htmlFor="description">
            Description <span className="font-normal text-muted-foreground">(facultative)</span>
          </FieldLabel>
          <Textarea
            id="description"
            rows={3}
            aria-invalid={Boolean(errors.description)}
            {...register('description')}
          />
          <FieldError errors={[errors.description]} />
        </Field>

        <Controller
          control={control}
          name="visibility"
          render={({ field }) => (
            <FieldSet>
              <FieldLegend variant="label">Visibilité</FieldLegend>
              <RadioGroup
                value={field.value}
                onValueChange={field.onChange}
                className="grid gap-3 sm:grid-cols-2"
              >
                {VISIBILITY_OPTIONS.map(({ value, title, description, Icon }) => (
                  <FieldLabel key={value} htmlFor={`visibility-${value}`}>
                    <Field orientation="horizontal">
                      <RadioGroupItem value={value} id={`visibility-${value}`} />
                      <FieldContent>
                        <FieldTitle>
                          <Icon className="size-4" aria-hidden="true" />
                          {title}
                        </FieldTitle>
                        <FieldDescription>{description}</FieldDescription>
                      </FieldContent>
                    </Field>
                  </FieldLabel>
                ))}
              </RadioGroup>
            </FieldSet>
          )}
        />
      </FieldGroup>

      <section aria-labelledby="cards-title" className="mt-10">
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <h2 id="cards-title" className="text-lg font-semibold">
            Cartes
          </h2>
          <span className="text-sm text-muted-foreground">{pluralize(filledCount, 'carte')}</span>
        </div>
        {cardsError && (
          <p role="alert" className="mb-4 text-sm text-destructive">
            {cardsError}
          </p>
        )}
        <ol className="space-y-4">
          {fields.map((field, index) => (
            <CardFieldsRow
              key={field.id}
              index={index}
              count={fields.length}
              register={register}
              errors={errors}
              onMove={moveCard}
              onRemove={removeCard}
            />
          ))}
        </ol>
        <Button
          ref={addButton}
          type="button"
          variant="outline"
          className="mt-4 w-full border-dashed"
          onClick={() => append(emptyCard(), { shouldFocus: true })}
        >
          <PlusIcon />
          Ajouter une carte
        </Button>
        <p aria-live="polite" className="sr-only">
          {announcement}
        </p>
      </section>

      <div className="sticky bottom-0 -mx-4 mt-8 flex justify-end gap-2 border-t bg-background/90 px-4 py-3 backdrop-blur">
        <Button asChild variant="ghost">
          <Link to={set ? `/sets/${set.id}` : '/'}>Annuler</Link>
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2Icon className="animate-spin" />}
          {set ? 'Enregistrer' : 'Créer le set'}
        </Button>
      </div>
    </form>
  )
}
