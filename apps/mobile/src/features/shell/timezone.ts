import { DEFAULT_SETTINGS, type SettingsInput } from '@quizlet/shared'
import type { Settings } from '@/lib/queries'

/**
 * Réglages à enregistrer pour fixer le fuseau de l'appareil, ou `null` s'il n'y a rien à faire
 * (l'utilisateur a déjà un fuseau). Sans fuseau détectable, on retient celui par défaut : il cesse
 * ainsi d'être « non choisi » et la détection ne se rejoue pas à chaque ouverture.
 */
export function withDeviceTimeZone(
  settings: Settings,
  deviceTimeZone: string | null,
): SettingsInput | null {
  if (settings.timezone !== null) return null
  return { ...settings, timezone: deviceTimeZone ?? DEFAULT_SETTINGS.timezone }
}
