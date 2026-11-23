import { useEffect } from 'react'
import { AppState } from 'react-native'
import { useAuth } from '@/auth'
import { useEffectiveSummary } from '@/offline'
import { planReminder } from './plan-reminder'
import { applyPlan, getPermission } from './reminder-adapter'
import { useReminderPrefs } from './use-reminder-prefs'

/**
 * CONTRAT : monté dans le layout racine (dans `AuthProvider` et `AppQueryProvider`). Reprogramme le
 * rappel (`planReminder`) au démarrage, au changement de préférences, de résumé, de statut
 * d'authentification et au retour au premier plan. Le contenu d'une notification est figé à la
 * programmation, d'où ces reprogrammations. Ne demande jamais la permission (c'est `ReminderSection`).
 */
export function useReminderSync(): void {
  const { prefs, loaded } = useReminderPrefs()
  const { status } = useAuth()
  const summary = useEffectiveSummary()
  const due = summary.data?.due
  const fresh = summary.data?.new
  const updatedAt = summary.dataUpdatedAt

  useEffect(() => {
    // Préférences non lues ou session pas encore connue : ne rien annuler à tort.
    if (!loaded || status === 'loading') return

    let stale = false
    async function sync() {
      const permission = await getPermission()
      if (stale) return
      await applyPlan(
        planReminder({
          prefs,
          permission,
          status,
          summary: due === undefined || fresh === undefined ? null : { due, new: fresh, updatedAt },
          now: new Date(),
        }),
      )
    }

    void sync()
    // La permission peut changer dans les réglages Android pendant que l'app est en arrière-plan.
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void sync()
    })
    return () => {
      stale = true
      subscription.remove()
    }
  }, [loaded, prefs, status, due, fresh, updatedAt])
}
