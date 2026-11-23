import { routes } from '@/lib/routes'

/** Partie d'une `NotificationResponse` d'`expo-notifications` dont on a besoin (typage structurel). */
export interface TapResponse {
  notification: {
    date: number
    request: { identifier: string; content: { data?: unknown } }
  }
}

/**
 * Clé d'une réponse. L'identifiant de la requête est toujours `daily-reminder` (déclencheur
 * quotidien) : la date de distribution distingue les jours.
 */
export function tapKey(response: TapResponse): string {
  const { date, request } = response.notification
  return `${request.identifier}:${date}`
}

/** Seul le rappel (`data.route === '/review'`) déclenche une navigation, jamais une route arbitraire. */
export function tapTarget(response: TapResponse): string | null {
  const data = response.notification.request.content.data
  const route = typeof data === 'object' && data !== null && 'route' in data ? data.route : null
  return route === routes.review ? routes.review : null
}
