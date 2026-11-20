import { describe, expect, it } from 'vitest'
import {
  createFallbackStorage,
  createFileStorage,
  type FsPort,
  type KeyValueStorage,
} from './file-storage'

/** Système de fichiers en mémoire ; `move` imite expo-file-system (suppression puis renommage). */
function memoryFs() {
  const files = new Map<string, string>()
  const log: string[] = []
  const fs: FsPort & { crashDuringMove: boolean } = {
    crashDuringMove: false,
    async read(name) {
      return files.get(name) ?? null
    },
    async write(name, content) {
      log.push(`write ${name}`)
      files.set(name, content)
    },
    async move(from, to) {
      log.push(`move ${from} ${to}`)
      const content = files.get(from)
      if (content === undefined) throw new Error('source absente')
      files.delete(to)
      if (this.crashDuringMove) throw new Error('mort entre la suppression et le renommage')
      files.set(to, content)
      files.delete(from)
    },
    async remove(name) {
      log.push(`remove ${name}`)
      files.delete(name)
    },
  }
  return { fs, files, log }
}

describe('createFileStorage', () => {
  it('écrit un tmp complet puis le déplace sur le fichier final', async () => {
    const { fs, files, log } = memoryFs()
    const storage = createFileStorage(fs, 'cache.json')
    await storage.setItem('k', '{"a":1}')
    expect(log).toEqual(['write cache.json.tmp', 'move cache.json.tmp cache.json'])
    expect(files.get('cache.json')).toBe('{"a":1}')
    expect(files.has('cache.json.tmp')).toBe(false)
  })

  it('relit la dernière valeur écrite ; absent → null', async () => {
    const { fs } = memoryFs()
    const storage = createFileStorage(fs, 'cache.json')
    expect(await storage.getItem('k')).toBeNull()
    await storage.setItem('k', '{"v":1}')
    await storage.setItem('k', '{"v":2}')
    expect(await storage.getItem('k')).toBe('{"v":2}')
  })

  it('reprend le .tmp complet si le final manque (mort pendant le remplacement)', async () => {
    const { fs } = memoryFs()
    const storage = createFileStorage(fs, 'cache.json')
    await storage.setItem('k', '{"v":1}')
    fs.crashDuringMove = true
    await expect(storage.setItem('k', '{"v":2}')).rejects.toThrow('mort')
    fs.crashDuringMove = false
    expect(await storage.getItem('k')).toBe('{"v":2}')
  })

  it('préfère le final au .tmp quand les deux existent', async () => {
    const { fs, files } = memoryFs()
    files.set('cache.json', '{"v":"final"}')
    files.set('cache.json.tmp', '{"v":"tmp"}')
    expect(await createFileStorage(fs, 'cache.json').getItem('k')).toBe('{"v":"final"}')
  })

  it("ignore un .tmp tronqué (mort pendant l'écriture)", async () => {
    const { fs, files } = memoryFs()
    files.set('cache.json.tmp', '{"v":')
    expect(await createFileStorage(fs, 'cache.json').getItem('k')).toBeNull()
  })

  it('removeItem supprime le final et le .tmp, sans erreur si absents', async () => {
    const { fs, files } = memoryFs()
    const storage = createFileStorage(fs, 'cache.json')
    await storage.removeItem('k')
    files.set('cache.json', '{}')
    files.set('cache.json.tmp', '{}')
    await storage.removeItem('k')
    expect(files.size).toBe(0)
  })

  it("sérialise les opérations : un seul accès au .tmp à la fois, dans l'ordre", async () => {
    const { fs, log } = memoryFs()
    const storage = createFileStorage(fs, 'cache.json')
    await Promise.all([
      storage.setItem('k', '{"n":1}'),
      storage.setItem('k', '{"n":2}'),
      storage.removeItem('k'),
    ])
    expect(log).toEqual([
      'write cache.json.tmp',
      'move cache.json.tmp cache.json',
      'write cache.json.tmp',
      'move cache.json.tmp cache.json',
      'remove cache.json',
      'remove cache.json.tmp',
    ])
  })

  it('une erreur ne bloque pas la file', async () => {
    const { fs } = memoryFs()
    const storage = createFileStorage(fs, 'cache.json')
    fs.crashDuringMove = true
    await expect(storage.setItem('k', '{"n":1}')).rejects.toThrow()
    fs.crashDuringMove = false
    await storage.setItem('k', '{"n":2}')
    expect(await storage.getItem('k')).toBe('{"n":2}')
  })
})

describe('createFallbackStorage', () => {
  function mapStorage(): KeyValueStorage & { data: Map<string, string> } {
    const data = new Map<string, string>()
    return {
      data,
      getItem: async (key) => data.get(key) ?? null,
      setItem: async (key, value) => void data.set(key, value),
      removeItem: async (key) => void data.delete(key),
    }
  }

  it("utilise le stockage principal tant qu'il fonctionne", async () => {
    const primary = mapStorage()
    const fallback = mapStorage()
    const storage = createFallbackStorage(primary, fallback)
    await storage.setItem('k', 'v')
    expect(primary.data.get('k')).toBe('v')
    expect(fallback.data.size).toBe(0)
  })

  it("bascule sur le repli à la première erreur et n'y revient plus", async () => {
    const primary = mapStorage()
    const fallback = mapStorage()
    const failures: unknown[] = []
    const storage = createFallbackStorage(primary, fallback, (error) => failures.push(error))
    primary.setItem = async () => {
      throw new Error('API File indisponible')
    }
    await storage.setItem('k', 'v1')
    expect(failures).toHaveLength(1)
    expect(fallback.data.get('k')).toBe('v1')

    primary.setItem = async (key, value) => void primary.data.set(key, value)
    await storage.setItem('k', 'v2')
    expect(fallback.data.get('k')).toBe('v2')
    expect(await storage.getItem('k')).toBe('v2')
    expect(failures).toHaveLength(1)
  })

  describe('redémarrage après un basculement (mêmes stockages, nouvelle instance)', () => {
    function failingFile(file: ReturnType<typeof mapStorage>) {
      return {
        ...file,
        setItem: async () => {
          throw new Error('API File indisponible')
        },
      }
    }

    it("le repli n'est pas masqué par l'ancienne valeur du fichier", async () => {
      const file = mapStorage()
      const repli = mapStorage()
      await file.setItem('k', 'v0')

      // Session 1 : le fichier échoue en cours de route, les notes vont au repli.
      const session1 = createFallbackStorage(failingFile(file), repli)
      await session1.setItem('k', 'v1')
      expect(file.data.has('k')).toBe(false)

      // Session 2 : le fichier refonctionne ; la valeur du repli est reprise.
      const session2 = createFallbackStorage(file, repli)
      expect(await session2.getItem('k')).toBe('v1')

      // Dès qu'il réécrit, la copie du repli disparaît : plus rien ne peut ressusciter.
      await session2.setItem('k', 'v2')
      expect(file.data.get('k')).toBe('v2')
      expect(repli.data.has('k')).toBe(false)
      const session3 = createFallbackStorage(file, repli)
      expect(await session3.getItem('k')).toBe('v2')
    })

    it('removeItem efface les deux emplacements', async () => {
      const file = mapStorage()
      const repli = mapStorage()
      await file.setItem('k', 'a')
      await repli.setItem('k', 'b')
      await createFallbackStorage(file, repli).removeItem('k')
      expect(file.data.size).toBe(0)
      expect(repli.data.size).toBe(0)
    })

    it('un fichier vide et un repli vide : rien', async () => {
      expect(await createFallbackStorage(mapStorage(), mapStorage()).getItem('k')).toBeNull()
    })
  })
})
