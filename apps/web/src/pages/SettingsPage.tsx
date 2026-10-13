import { zodResolver } from '@hookform/resolvers/zod'
import {
  DEFAULT_SETTINGS,
  SETTINGS_LIMITS,
  type SettingsInput,
  settingsSchema,
} from '@quizlet/shared'
import { Loader2Icon } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import type { z } from 'zod'
import { ErrorState, LoadingState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { pageTitle } from '@/config'
import { errorMessage } from '@/lib/http'
import { type Settings, useSaveSettings, useSettings } from '@/lib/queries'

export function SettingsPage() {
  const query = useSettings()
  return (
    <div className="mx-auto max-w-2xl">
      <title>{pageTitle('Paramètres')}</title>
      <h1 className="mb-2 text-2xl font-semibold tracking-tight">Paramètres</h1>
      <p className="mb-8 text-muted-foreground">Réglages de la répétition espacée.</p>
      {query.isPending ? (
        <LoadingState label="Chargement des paramètres…" rows={4} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <SettingsForm settings={query.data} />
      )}
    </div>
  )
}

/** Fuseaux IANA proposés, avec le fuseau actuel même s'il n'est qu'un alias. */
function timeZones(current: string): string[] {
  const zones = Intl.supportedValuesOf('timeZone')
  return zones.includes(current) ? zones : [current, ...zones]
}

function SettingsForm({ settings }: { settings: Settings }) {
  const save = useSaveSettings()
  const form = useForm<SettingsInput, unknown, z.output<typeof settingsSchema>>({
    resolver: zodResolver(settingsSchema),
    defaultValues: { ...settings, timezone: settings.timezone ?? DEFAULT_SETTINGS.timezone },
  })
  const {
    register,
    formState: { errors, isSubmitting },
  } = form

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      form.reset(await save.mutateAsync(values))
      toast.success('Paramètres enregistrés.')
    } catch (error) {
      toast.error(errorMessage(error))
    }
  })

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        <Field data-invalid={Boolean(errors.timezone)}>
          <FieldLabel htmlFor="timezone">Fuseau horaire</FieldLabel>
          <NativeSelect id="timezone" className="w-full" {...register('timezone')}>
            {timeZones(form.getValues('timezone')).map((zone) => (
              <NativeSelectOption key={zone} value={zone}>
                {zone.replaceAll('_', ' ')}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <FieldDescription>
            Le jour change à minuit dans ce fuseau : les compteurs repartent à zéro et les cartes
            dues avant minuit sont proposées. Il est repris de votre navigateur à la première
            visite.
          </FieldDescription>
          <FieldError errors={[errors.timezone]} />
        </Field>

        <Field data-invalid={Boolean(errors.newCardsPerDay)}>
          <FieldLabel htmlFor="new-cards">Nouvelles cartes par jour</FieldLabel>
          <Input
            id="new-cards"
            type="number"
            min={0}
            max={SETTINGS_LIMITS.perDay}
            className="max-w-32"
            aria-invalid={Boolean(errors.newCardsPerDay)}
            {...register('newCardsPerDay', { valueAsNumber: true })}
          />
          <FieldDescription>
            Cartes jamais révisées présentées chaque jour ({DEFAULT_SETTINGS.newCardsPerDay} par
            défaut).
          </FieldDescription>
          <FieldError errors={[errors.newCardsPerDay]} />
        </Field>

        <Field data-invalid={Boolean(errors.reviewsPerDay)}>
          <FieldLabel htmlFor="reviews">Révisions par jour</FieldLabel>
          <Input
            id="reviews"
            type="number"
            min={0}
            max={SETTINGS_LIMITS.perDay}
            className="max-w-32"
            aria-invalid={Boolean(errors.reviewsPerDay)}
            {...register('reviewsPerDay', { valueAsNumber: true })}
          />
          <FieldDescription>
            Cartes déjà apprises à réviser chaque jour au plus ({DEFAULT_SETTINGS.reviewsPerDay} par
            défaut). Les cartes en cours d'apprentissage ne sont jamais limitées.
          </FieldDescription>
          <FieldError errors={[errors.reviewsPerDay]} />
        </Field>

        <Field data-invalid={Boolean(errors.desiredRetention)}>
          <FieldLabel htmlFor="retention">Rétention cible</FieldLabel>
          <Input
            id="retention"
            type="number"
            step={0.01}
            min={SETTINGS_LIMITS.minRetention}
            max={SETTINGS_LIMITS.maxRetention}
            className="max-w-32"
            aria-invalid={Boolean(errors.desiredRetention)}
            {...register('desiredRetention', { valueAsNumber: true })}
          />
          <FieldDescription>
            Probabilité visée de se souvenir d'une carte quand elle revient (
            {DEFAULT_SETTINGS.desiredRetention.toLocaleString('fr-FR')} par défaut, de{' '}
            {SETTINGS_LIMITS.minRetention.toLocaleString('fr-FR')} à{' '}
            {SETTINGS_LIMITS.maxRetention.toLocaleString('fr-FR')}). Plus elle est haute, plus les
            révisions sont fréquentes.
          </FieldDescription>
          <FieldError errors={[errors.desiredRetention]} />
        </Field>
      </FieldGroup>

      <div className="mt-8 flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2Icon className="animate-spin" />}
          Enregistrer
        </Button>
      </div>
    </form>
  )
}
