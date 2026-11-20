import type { ImportFile } from './import-file'

// CONTRAT : adaptateurs appareil (seul fichier de `lib/` avec `expo-*`, exempté de la règle de
// pureté). Aucun ne rejette sauf mention.

/** Fuseau IANA de l'appareil (`expo-localization` : `getCalendars()[0].timeZone`), `null` si inconnu. */
export function getDeviceTimeZone(): string | null {
  throw new Error('non implémenté')
}

/** Copie `text` dans le presse-papiers (`expo-clipboard`). `false` en cas d'échec. */
export function copyText(_text: string): Promise<boolean> {
  throw new Error('non implémenté')
}

/**
 * Ouvre le sélecteur de fichiers (`File.pickFileAsync`, tous types : le filtre MIME masque des CSV).
 * `null` si l'utilisateur annule. Le contrôle `.csv` / `.txt` n'est pas fait ici.
 */
export function pickTextFile(): Promise<ImportFile | null> {
  throw new Error('non implémenté')
}

/** Ouvre les réglages Android de l'application (`Linking.openSettings`). */
export function openAppSettings(): Promise<void> {
  throw new Error('non implémenté')
}
