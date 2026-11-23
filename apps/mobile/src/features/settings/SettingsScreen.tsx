import { zodResolver } from '@hookform/resolvers/zod'
import { DEFAULT_SETTINGS, errorMessage } from '@quizlet/shared'
import { useMemo } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { StyleSheet, View } from 'react-native'
import { type Settings, useSaveSettings, useSettings } from '@/lib/queries'
import { queryView } from '@/lib/query-state'
import { listTimeZones } from '@/lib/timezones'
import { ReminderSection } from '@/notifications'
import { useOnlineGuard } from '@/offline'
import {
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  Screen,
  spacing,
  Text,
  TextField,
  toast,
} from '@/ui'
import { AppearanceSection } from './AppearanceSection'
import {
  SETTINGS_TEXT,
  type SettingsFormOutput,
  type SettingsFormValues,
  settingsFormSchema,
  toFormValues,
} from './settings-form'
import { TimeZoneField } from './TimeZoneField'

/** Paramètres : réglages de révision (comme le web), puis apparence et rappel quotidien. */
export function SettingsScreen() {
  const query = useSettings()
  return (
    <Screen scroll keyboardAvoiding padded contentContainerStyle={styles.page}>
      <Text tone="muted">{SETTINGS_TEXT.intro}</Text>
      <RevisionSettings query={query} />
      <AppearanceSection />
      <ReminderSection />
    </Screen>
  )
}

function RevisionSettings({ query }: { query: ReturnType<typeof useSettings> }) {
  // Un rafraîchissement raté après un succès garde les données : on les montre.
  if (query.data !== undefined) return <SettingsForm settings={query.data} />
  const view = queryView(query)
  if (view === 'loading') return <LoadingState label="Chargement des paramètres…" rows={4} />
  if (view === 'offline') {
    return (
      <EmptyState
        icon="wifi-off"
        title="Paramètres indisponibles"
        description="Connectez-vous à Internet pour charger vos paramètres de révision."
      />
    )
  }
  return <ErrorState error={query.error} onRetry={() => query.refetch()} />
}

function SettingsForm({ settings }: { settings: Settings }) {
  const save = useSaveSettings()
  const guard = useOnlineGuard()
  const zones = useMemo(
    () => listTimeZones(settings.timezone ?? DEFAULT_SETTINGS.timezone),
    [settings.timezone],
  )
  const form = useForm<SettingsFormValues, unknown, SettingsFormOutput>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: toFormValues(settings),
  })
  const {
    control,
    formState: { isSubmitting },
  } = form

  const onSubmit = form.handleSubmit(async (values) => {
    if (!guard()) return
    try {
      form.reset(toFormValues(await save.mutateAsync(values)))
      toast.success('Paramètres enregistrés.')
    } catch (error) {
      toast.error(errorMessage(error))
    }
  })

  return (
    <View style={styles.form}>
      <Controller
        control={control}
        name="timezone"
        render={({ field, fieldState }) => (
          <TimeZoneField
            label={SETTINGS_TEXT.timezone.label}
            helper={SETTINGS_TEXT.timezone.help}
            value={field.value}
            onChange={field.onChange}
            zones={zones}
            error={fieldState.error?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="newCardsPerDay"
        render={({ field, fieldState }) => (
          <TextField
            label={SETTINGS_TEXT.newCardsPerDay.label}
            helper={SETTINGS_TEXT.newCardsPerDay.help}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            inputRef={field.ref}
            error={fieldState.error?.message}
            keyboardType="number-pad"
          />
        )}
      />
      <Controller
        control={control}
        name="reviewsPerDay"
        render={({ field, fieldState }) => (
          <TextField
            label={SETTINGS_TEXT.reviewsPerDay.label}
            helper={SETTINGS_TEXT.reviewsPerDay.help}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            inputRef={field.ref}
            error={fieldState.error?.message}
            keyboardType="number-pad"
          />
        )}
      />
      <Controller
        control={control}
        name="desiredRetention"
        render={({ field, fieldState }) => (
          <TextField
            label={SETTINGS_TEXT.desiredRetention.label}
            helper={SETTINGS_TEXT.desiredRetention.help}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            inputRef={field.ref}
            error={fieldState.error?.message}
            keyboardType="decimal-pad"
          />
        )}
      />
      <Button label="Enregistrer" onPress={onSubmit} loading={isSubmitting} fullWidth />
    </View>
  )
}

const styles = StyleSheet.create({
  page: { gap: spacing.xl },
  form: { gap: spacing.lg },
})
