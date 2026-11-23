import { Directory, File, Paths } from 'expo-file-system'
import type { FsPort } from './file-storage'

/** Dossier privé de l'app (`filesDir`), créé au besoin : `File.write` ne crée pas le dossier parent. */
function offlineDirectory(): Directory {
  const directory = new Directory(Paths.document, 'offline')
  directory.create({ intermediates: true, idempotent: true })
  return directory
}

/**
 * Port réel sur `expo-file-system` (`Paths.document/offline/…`). Un `File` neuf par opération :
 * `move` change l'URI de l'instance déplacée, la réutiliser écrirait ensuite à la place du final.
 */
export function createExpoFsPort(): FsPort {
  return {
    async read(name) {
      const file = new File(offlineDirectory(), name)
      return file.exists ? file.text() : null
    },
    async write(name, content) {
      await new File(offlineDirectory(), name).write(content)
    },
    async move(from, to) {
      await new File(offlineDirectory(), from).move(new File(offlineDirectory(), to), {
        overwrite: true,
      })
    },
    async remove(name) {
      const file = new File(offlineDirectory(), name)
      if (file.exists) file.delete()
    },
  }
}
