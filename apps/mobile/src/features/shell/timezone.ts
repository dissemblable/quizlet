import type { SettingsInput } from '@quizlet/shared'
import type { Settings } from '@/lib/queries'

/**
 * Réglages à enregistrer pour fixer le fuseau de l'appareil, ou `null` s'il n'y a rien à faire :
 * l'utilisateur a déjà un fuseau, ou l'appareil n'en donne pas (comme le web, on n'enregistre
 * alors rien ; Europe/Paris s'applique côté API).
 */
export function withDeviceTimeZone(
  settings: Settings,
  deviceTimeZone: string | null,
): SettingsInput | null {
  if (settings.timezone !== null || deviceTimeZone === null) return null
  return { ...settings, timezone: deviceTimeZone }
}
