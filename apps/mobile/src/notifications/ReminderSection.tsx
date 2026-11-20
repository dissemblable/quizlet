import { DateTimePickerAndroid } from '@react-native-community/datetimepicker'
import { useEffect, useState } from 'react'
import { AppState, View } from 'react-native'
import { openAppSettings } from '@/lib/device'
import { announce, Banner, Button, ListItem, Switch, spacing, Text } from '@/ui'
import type { ReminderPermission } from './plan-reminder'
import { formatReminderTime } from './prefs'
import { getPermission, requestPermission } from './reminder-adapter'
import { useReminderPrefs } from './use-reminder-prefs'

/**
 * CONTRAT : section « Rappel quotidien » de l'écran Paramètres, sans props : bascule (`Switch`),
 * heure (`DateTimePickerAndroid`), permission refusée → texte + bouton « Ouvrir les réglages »
 * (`openAppSettings`). Écrit les préférences ; `useReminderSync` (layout racine) reprogramme.
 */
export function ReminderSection() {
  const { prefs, loaded, update } = useReminderPrefs()
  // `null` : pas encore lue.
  const [permission, setPermission] = useState<ReminderPermission | null>(null)
  const [requesting, setRequesting] = useState(false)

  // Au retour des réglages Android, la permission a pu changer.
  useEffect(() => {
    let mounted = true
    const refresh = () => {
      void getPermission().then((current) => mounted && setPermission(current))
    }
    refresh()
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh()
    })
    return () => {
      mounted = false
      subscription.remove()
    }
  }, [])

  // Activé dans les préférences mais refusé par le système : l'interrupteur reste éteint.
  const active = prefs.enabled && (permission === null || permission === 'granted')
  const time = formatReminderTime(prefs.hour, prefs.minute)

  async function toggle(next: boolean) {
    if (!next) {
      update({ enabled: false })
      announce('Rappel quotidien désactivé.')
      return
    }
    setRequesting(true)
    const result = await requestPermission()
    setRequesting(false)
    setPermission(result)
    if (result === 'granted') {
      update({ enabled: true })
      announce(`Rappel quotidien activé à ${time}.`)
    } else {
      announce('Notifications refusées. Ouvrez les réglages pour les autoriser.')
    }
  }

  function pickTime() {
    const value = new Date()
    value.setHours(prefs.hour, prefs.minute, 0, 0)
    DateTimePickerAndroid.open({
      value,
      mode: 'time',
      is24Hour: true,
      onValueChange: (_event, date) => {
        update({ hour: date.getHours(), minute: date.getMinutes() })
        announce(`Heure du rappel : ${formatReminderTime(date.getHours(), date.getMinutes())}.`)
      },
    })
  }

  return (
    <View style={{ gap: spacing.md }}>
      <Switch
        label="Rappel quotidien"
        checked={active}
        onCheckedChange={(next) => void toggle(next)}
        disabled={!loaded || requesting}
      />
      {permission === 'denied' && (
        <Banner
          tone="warning"
          title="Notifications désactivées"
          description="Autorisez les notifications pour Quizlet dans les réglages du téléphone pour recevoir le rappel."
          action={
            <Button
              size="sm"
              variant="outline"
              label="Ouvrir les réglages"
              onPress={() => void openAppSettings()}
            />
          }
        />
      )}
      {active && (
        <ListItem
          title={`Heure du rappel : ${time}`}
          icon="clock"
          onPress={pickTime}
          accessibilityHint="Ouvre le sélecteur d'heure"
        />
      )}
      <Text variant="caption" tone="muted">
        Un rappel local, sans serveur : l'heure peut varier de quelques minutes.
      </Text>
    </View>
  )
}
