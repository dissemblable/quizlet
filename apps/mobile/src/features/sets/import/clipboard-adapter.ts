import { getStringAsync } from 'expo-clipboard'

/**
 * Texte du presse-papiers (`expo-clipboard`), `''` s'il est vide, `null` si la lecture échoue.
 * `@/lib/device` n'expose que `copyText` : ce lecteur reste ici (besoin signalé à l'intégrateur).
 */
export async function pasteText(): Promise<string | null> {
  try {
    return await getStringAsync()
  } catch {
    return null
  }
}
