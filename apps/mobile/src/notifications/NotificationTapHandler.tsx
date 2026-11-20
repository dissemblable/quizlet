import * as Notifications from 'expo-notifications'
import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { useAuth } from '@/auth'
import { tapKey, tapTarget } from './tap-route'

// Module : survit à un remontage du layout (ErrorBoundary > « Réessayer »), sans rejouer le tap.
let handledKey: string | null = null

/**
 * CONTRAT : monté dans le layout racine, APRÈS le `Stack` (le navigateur existe). Au toucher d'une
 * notification (`useLastNotificationResponse` à froid + écouteur à chaud), navigue vers
 * `data.route` (`/review`) si l'état est `signedIn`, une seule fois par réponse. Rend `null`.
 */
export function NotificationTapHandler() {
  const { status } = useAuth()
  const router = useRouter()
  // À froid : la réponse qui a lancé l'app. Le hook ne la remplace pas par une réponse de même
  // identifiant (toujours `daily-reminder`) : les taps suivants passent donc par l'écouteur.
  const lastResponse = Notifications.useLastNotificationResponse()
  const [liveResponse, setLiveResponse] = useState<Notifications.NotificationResponse | null>(null)

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(setLiveResponse)
    return () => subscription.remove()
  }, [])

  const response = liveResponse ?? lastResponse

  // Réponse conservée (état) tant que la session n'est pas `signedIn` : traitée à ce moment-là.
  useEffect(() => {
    if (status !== 'signedIn' || !response) return
    const key = tapKey(response)
    if (key === handledKey) return
    handledKey = key
    const target = tapTarget(response)
    if (target) router.navigate(target)
  }, [status, response, router])

  return null
}
