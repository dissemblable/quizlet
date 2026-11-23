/** Interface commune d'AsyncStorage et du stockage fichier (compatible `AsyncStorage<string>` de TanStack). */
export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
  removeItem(key: string): Promise<void>
}

/**
 * Port du système de fichiers (injecté : l'adaptateur réel est dans `file-adapter.ts`). Les noms
 * sont relatifs au dossier de l'application ; le port crée le dossier au besoin.
 */
export interface FsPort {
  /** `null` si le fichier n'existe pas. */
  read(name: string): Promise<string | null>
  /** Crée ou remplace. */
  write(name: string, content: string): Promise<void>
  /** Renomme en remplaçant la destination (jamais atomique pour le remplacement : voir ci-dessous). */
  move(from: string, to: string): Promise<void>
  /** Sans erreur si le fichier n'existe pas. */
  remove(name: string): Promise<void>
}

function isJson(text: string): boolean {
  try {
    JSON.parse(text)
    return true
  } catch {
    return false
  }
}

/**
 * Stockage d'UNE valeur JSON dans un fichier (`name`), la clé est ignorée. Écriture « tmp + move » :
 * `.tmp` écrit en entier puis renommé. Le remplacement d'une destination existante n'est pas
 * atomique (suppression puis renommage) : si le fichier final manque et que le `.tmp` est un JSON
 * complet, la lecture reprend le `.tmp`. Les opérations sont sérialisées (une seule écriture du
 * `.tmp` à la fois).
 */
export function createFileStorage(fs: FsPort, name: string): KeyValueStorage {
  const tmp = `${name}.tmp`
  let tail: Promise<unknown> = Promise.resolve()

  function enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const run = tail.then(operation)
    tail = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }

  return {
    getItem: () =>
      enqueue(async () => {
        const value = await fs.read(name)
        if (value !== null) return value
        const recovered = await fs.read(tmp)
        return recovered !== null && isJson(recovered) ? recovered : null
      }),
    setItem: (_key, value) =>
      enqueue(async () => {
        await fs.write(tmp, value)
        await fs.move(tmp, name)
      }),
    removeItem: () =>
      enqueue(async () => {
        await fs.remove(name)
        await fs.remove(tmp)
      }),
  }
}

const quietly = (operation: () => Promise<unknown>) => operation().catch(() => undefined)

/**
 * Bascule sur `fallback` (AsyncStorage) à la première erreur de `primary` (l'API fichier qui échoue
 * ne doit pas priver l'app du hors-ligne), jusqu'à la fin de la session. Ce qui était dans
 * `primary` n'est pas migré, mais ne masque pas le repli au démarrage suivant :
 * - au basculement, la valeur du `primary` est effacée (au mieux) ;
 * - `getItem` lit le repli quand `primary` n'a rien ;
 * - dès que `primary` réécrit, la copie du repli est effacée ;
 * - `removeItem` efface les deux.
 */
export function createFallbackStorage(
  primary: KeyValueStorage,
  fallback: KeyValueStorage,
  onFallback?: (error: unknown) => void,
): KeyValueStorage {
  let primaryFailed = false
  // Le repli peut contenir une valeur plus récente que celle du `primary`.
  let fallbackHoldsValue = false

  function fail(error: unknown): void {
    primaryFailed = true
    fallbackHoldsValue = true
    onFallback?.(error)
  }

  return {
    async getItem(key) {
      if (!primaryFailed) {
        try {
          const value = await primary.getItem(key)
          if (value !== null) return value
        } catch (error) {
          fail(error)
        }
      }
      const value = await fallback.getItem(key)
      if (value !== null) fallbackHoldsValue = true
      return value
    },
    async setItem(key, value) {
      if (!primaryFailed) {
        try {
          await primary.setItem(key, value)
          if (fallbackHoldsValue) {
            fallbackHoldsValue = false
            await quietly(() => fallback.removeItem(key))
          }
          return
        } catch (error) {
          fail(error)
          await quietly(() => primary.removeItem(key))
        }
      }
      await fallback.setItem(key, value)
    },
    async removeItem(key) {
      if (!primaryFailed) {
        try {
          await primary.removeItem(key)
        } catch (error) {
          fail(error)
        }
      }
      await quietly(() => fallback.removeItem(key))
    },
  }
}
