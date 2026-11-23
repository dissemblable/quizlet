import { IMPORT_MAX_BYTES } from '@quizlet/shared'
import { decodeUtf8Strict } from './utf8'

/**
 * Fichier choisi par l'utilisateur, vu par la logique pure. `File` d'`expo-file-system` convient
 * (typage structurel) ; les tests passent un objet en mémoire.
 */
export interface ImportFile {
  name: string
  /** Taille en octets (0 si illisible). */
  size: number
  bytes(): Promise<Uint8Array>
}

export type ImportFileResult = { ok: true; text: string } | { ok: false; error: string }

const TOO_LARGE = 'Fichier trop volumineux : 1 Mo au maximum.'
const NOT_UTF8 =
  "Ce fichier n'est pas encodé en UTF-8. Enregistrez-le au format « CSV UTF-8 » puis réessayez."
const UNREADABLE = 'Impossible de lire ce fichier.'

/**
 * Lit un fichier d'import avec les MÊMES messages que le web (`ImportPage.loadFile`). Pas de contrôle
 * d'extension (le web n'en fait pas, et certains fournisseurs de fichiers n'en donnent aucune) : le
 * décodage UTF-8 strict écarte les binaires.
 * - `size > IMPORT_MAX_BYTES` → refus sans lecture ;
 * - octets non UTF-8 (`decodeUtf8Strict` → `null`) → refus ;
 * - lecture impossible (`bytes()` rejette) → refus.
 * Ne rejette jamais.
 */
export async function readImportFile(file: ImportFile): Promise<ImportFileResult> {
  if (file.size > IMPORT_MAX_BYTES) return { ok: false, error: TOO_LARGE }
  try {
    const bytes = await file.bytes()
    // `size` vaut 0 quand il est illisible : on re-vérifie sur les octets réellement lus.
    if (bytes.length > IMPORT_MAX_BYTES) return { ok: false, error: TOO_LARGE }
    const text = decodeUtf8Strict(bytes)
    return text === null ? { ok: false, error: NOT_UTF8 } : { ok: true, text }
  } catch {
    return { ok: false, error: UNREADABLE }
  }
}
