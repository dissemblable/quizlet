import { setStringAsync } from 'expo-clipboard'
import { File } from 'expo-file-system'
import { getCalendars } from 'expo-localization'
import { Linking } from 'react-native'
import type { ImportFile } from './import-file'

// CONTRAT : adaptateurs appareil (seul fichier de `lib/` avec `expo-*`, exempté de la règle de
// pureté). Aucun ne rejette sauf mention.

/** Fuseau IANA de l'appareil (`expo-localization` : `getCalendars()[0].timeZone`), `null` si inconnu. */
export function getDeviceTimeZone(): string | null {
  try {
    return getCalendars()[0].timeZone?.trim() || null
  } catch {
    return null
  }
}

/** Copie `text` dans le presse-papiers (`expo-clipboard`). `false` en cas d'échec. */
export async function copyText(text: string): Promise<boolean> {
  try {
    return await setStringAsync(text)
  } catch {
    return false
  }
}

/**
 * Ouvre le sélecteur de fichiers (`File.pickFileAsync`, tous types : le filtre MIME masque des CSV).
 * `null` si l'utilisateur annule. Le contrôle `.csv` / `.txt` n'est pas fait ici.
 */
export async function pickTextFile(): Promise<ImportFile | null> {
  try {
    const picked = await File.pickFileAsync({ mimeTypes: '*/*' })
    if (picked.canceled) return null
    const file = picked.result
    return { name: file.name, size: file.size, bytes: () => file.bytes() }
  } catch {
    // CONTRAT : « ne rejette pas » : un sélecteur indisponible se confond avec une annulation.
    return null
  }
}

/** Ouvre les réglages Android de l'application (`Linking.openSettings`). */
export async function openAppSettings(): Promise<void> {
  try {
    await Linking.openSettings()
  } catch {
    // Aucun écran de réglages à ouvrir : rien à faire de plus.
  }
}
