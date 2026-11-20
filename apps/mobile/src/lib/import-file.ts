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

/**
 * CONTRAT : lit un fichier d'import avec les MÊMES messages que le web (`ImportPage.loadFile`) :
 * - `size > IMPORT_MAX_BYTES` → « Fichier trop volumineux : 1 Mo au maximum. » (sans lire) ;
 * - octets non UTF-8 (`decodeUtf8Strict` → `null`) → « Ce fichier n'est pas encodé en UTF-8.
 *   Enregistrez-le au format « CSV UTF-8 » puis réessayez. » ;
 * - lecture impossible (`bytes()` rejette) → `{ ok: false }` avec un message français.
 * Ne rejette jamais.
 */
export function readImportFile(_file: ImportFile): Promise<ImportFileResult> {
  throw new Error('non implémenté')
}
