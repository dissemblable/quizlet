import AsyncStorage from '@react-native-async-storage/async-storage'
import { PermissionStatus } from 'expo'
import * as Notifications from 'expo-notifications'
import { routes } from '@/lib/routes'
import type { ReminderPermission, ReminderPlan } from './plan-reminder'
import {
  DEFAULT_REMINDER_PREFS,
  parseReminderPrefs,
  REMINDER_PREFS_KEY,
  type ReminderPrefs,
  serializeReminderPrefs,
} from './prefs'
import { prefsStore } from './reminder-store'

// Adaptateur appareil : seul fichier avec `expo-notifications` et AsyncStorage (règle de pureté).

const REMINDER_ID = 'daily-reminder'
const CHANNEL_ID = 'reminders'

// Une seule fois, à l'import : sans handler, une notification reçue au premier plan est ignorée.
// Pas de son : sur Android cela supprime aussi l'alerte déroulante au premier plan (voulu).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
})

function warn(action: string, error: unknown) {
  console.warn(`Rappel quotidien (${action}) :`, error instanceof Error ? error.message : error)
}

/**
 * Crée le canal `reminders` (idempotent). À appeler AVANT de demander la permission : le dialogue
 * d'Android 13 n'apparaît qu'une fois un canal créé. Ne rejette jamais.
 */
export async function ensureChannel(): Promise<void> {
  try {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Rappel quotidien',
      importance: Notifications.AndroidImportance.DEFAULT,
    })
  } catch (error) {
    warn('canal', error)
  }
}

function toPermission({
  granted,
  status,
}: Notifications.NotificationPermissionsStatus): ReminderPermission {
  if (granted) return 'granted'
  return status === PermissionStatus.UNDETERMINED ? 'undetermined' : 'denied'
}

/** Permission actuelle, sans dialogue. Ne rejette jamais (échec → `undetermined`). */
export async function getPermission(): Promise<ReminderPermission> {
  try {
    return toPermission(await Notifications.getPermissionsAsync())
  } catch (error) {
    warn('permission', error)
    return 'undetermined'
  }
}

/** Affiche le dialogue système si besoin. Ne rejette jamais (échec → `denied`). */
export async function requestPermission(): Promise<ReminderPermission> {
  await ensureChannel()
  try {
    return toPermission(await Notifications.requestPermissionsAsync())
  } catch (error) {
    warn('demande de permission', error)
    return 'denied'
  }
}

// Les opérations sont sérialisées : un `cancel` tardif ne doit pas défaire un `schedule` plus récent.
let queue: Promise<void> = Promise.resolve()

function enqueue(action: string, task: () => Promise<void>): Promise<void> {
  queue = queue.then(task).catch((error) => warn(action, error))
  return queue
}

/** Applique le plan : annule le rappel existant puis reprogramme. Ne rejette jamais. */
export function applyPlan(plan: ReminderPlan): Promise<void> {
  return enqueue('programmation', async () => {
    await Notifications.cancelScheduledNotificationAsync(REMINDER_ID)
    if (plan.action === 'cancel') return
    // Le plugin `defaultChannel` n'écrit que des métadonnées : le canal doit exister.
    await ensureChannel()
    await Notifications.scheduleNotificationAsync({
      identifier: REMINDER_ID,
      content: { title: plan.title, body: plan.body, data: { route: routes.review } },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: plan.hour,
        minute: plan.minute,
        channelId: CHANNEL_ID,
      },
    })
  })
}

/**
 * CONTRAT : annule le rappel quotidien programmé (`cancelScheduledNotificationAsync('daily-reminder')`)
 * et oublie ses préférences. Appelée à la déconnexion (`onSignedOut` du layout racine). Ne rejette
 * jamais.
 */
export function cancelReminder(): Promise<void> {
  return enqueue('annulation', async () => {
    try {
      await Notifications.cancelScheduledNotificationAsync(REMINDER_ID)
    } finally {
      await AsyncStorage.removeItem(REMINDER_PREFS_KEY)
      prefsStore.set({ ...DEFAULT_REMINDER_PREFS })
    }
  })
}

/** Lecture tolérante : stockage illisible ou JSON corrompu → défauts. Ne rejette jamais. */
export async function loadPrefs(): Promise<ReminderPrefs> {
  try {
    return parseReminderPrefs(await AsyncStorage.getItem(REMINDER_PREFS_KEY))
  } catch (error) {
    warn('lecture des préférences', error)
    return { ...DEFAULT_REMINDER_PREFS }
  }
}

/** Écriture au mieux : un échec laisse les préférences en mémoire, perdues au prochain démarrage. */
export async function savePrefs(prefs: ReminderPrefs): Promise<void> {
  try {
    await AsyncStorage.setItem(REMINDER_PREFS_KEY, serializeReminderPrefs(prefs))
  } catch (error) {
    warn('écriture des préférences', error)
  }
}
