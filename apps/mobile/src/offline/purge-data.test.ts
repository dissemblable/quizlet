import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import type { KeyValueStorage } from './file-storage'
import { createOwnerStore, OWNER_KEY } from './owner-store'
import { purgeUserDataWith, trackOwner } from './purge-data'

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  const storage: KeyValueStorage = {
    getItem: async (key) => data.get(key) ?? null,
    setItem: async (key, value) => void data.set(key, value),
    removeItem: async (key) => void data.delete(key),
  }
  return { data, storage }
}

describe('createOwnerStore', () => {
  it('lit à travers un cache mémoire et écrit dans le stockage', async () => {
    const { data, storage } = memoryStorage({ [OWNER_KEY]: 'alice' })
    const owner = createOwnerStore(storage)
    expect(await owner.get()).toBe('alice')
    await owner.set('bob')
    expect(await owner.get()).toBe('bob')
    expect(data.get(OWNER_KEY)).toBe('bob')
    await owner.clear()
    expect(await owner.get()).toBeNull()
    expect(data.has(OWNER_KEY)).toBe(false)
  })

  it("propage une erreur de lecture (elle n'est pas « aucun propriétaire »)", async () => {
    const owner = createOwnerStore({
      getItem: async () => {
        throw new Error('disque')
      },
      setItem: async () => {},
      removeItem: async () => {},
    })
    await expect(owner.get()).rejects.toThrow('disque')
  })
})

describe('purgeUserDataWith', () => {
  function filled() {
    const client = new QueryClient()
    client.setQueryData(['me'], { id: 'alice' })
    client.setQueryData(['review', 'queue', 'all'], { cards: [] })
    return client
  }

  it('vide le cache, la file de notes, le fichier et le propriétaire', async () => {
    const client = filled()
    const { storage, data } = memoryStorage({ [OWNER_KEY]: 'alice' })
    const removeCache = vi.fn(async () => {})
    await purgeUserDataWith({ client, removeCache, owner: createOwnerStore(storage) })
    expect(client.getQueryCache().getAll()).toHaveLength(0)
    expect(client.getMutationCache().getAll()).toHaveLength(0)
    expect(removeCache).toHaveBeenCalledTimes(1)
    expect(data.has(OWNER_KEY)).toBe(false)
  })

  it('ne rejette jamais, même si la suppression des fichiers échoue', async () => {
    const client = filled()
    const { storage } = memoryStorage()
    await expect(
      purgeUserDataWith({
        client,
        removeCache: async () => {
          throw new Error('disque')
        },
        owner: createOwnerStore(storage),
      }),
    ).resolves.toBeUndefined()
    expect(client.getQueryCache().getAll()).toHaveLength(0)
  })

  it('garde le propriétaire si la suppression du cache persisté échoue', async () => {
    const client = filled()
    const { storage, data } = memoryStorage({ [OWNER_KEY]: 'alice' })
    await purgeUserDataWith({
      client,
      removeCache: async () => {
        throw new Error('disque')
      },
      owner: createOwnerStore(storage),
    })
    // Le cache en mémoire et la file de notes sont partis ; la clé reste pour reconnaître le fichier.
    expect(client.getQueryCache().getAll()).toHaveLength(0)
    expect(data.get(OWNER_KEY)).toBe('alice')
  })

  it("ne rejette pas non plus si l'effacement du propriétaire échoue", async () => {
    const client = filled()
    await expect(
      purgeUserDataWith({
        client,
        removeCache: async () => {},
        owner: {
          clear: async () => {
            throw new Error('disque')
          },
        },
      }),
    ).resolves.toBeUndefined()
  })

  it('`refetch` : remet les requêtes à zéro au lieu de les retirer', async () => {
    const client = filled()
    const { storage } = memoryStorage()
    await purgeUserDataWith(
      { client, removeCache: async () => {}, owner: createOwnerStore(storage) },
      { refetch: true },
    )
    const query = client.getQueryCache().find({ queryKey: ['me'] })
    expect(query).toBeDefined()
    expect(query?.state.data).toBeUndefined()
  })
})

describe('trackOwner', () => {
  it('mémorise le premier utilisateur sans purger', async () => {
    const { storage } = memoryStorage()
    const owner = createOwnerStore(storage)
    const purge = vi.fn(async () => {})
    await trackOwner('alice', { owner, purge })
    expect(await owner.get()).toBe('alice')
    expect(purge).not.toHaveBeenCalled()
  })

  it('même utilisateur : rien à faire', async () => {
    const { storage } = memoryStorage({ [OWNER_KEY]: 'alice' })
    const purge = vi.fn(async () => {})
    await trackOwner('alice', { owner: createOwnerStore(storage), purge })
    expect(purge).not.toHaveBeenCalled()
  })

  it("autre utilisateur : purge d'abord le cache de l'ancien, puis mémorise le nouveau", async () => {
    const { storage } = memoryStorage({ [OWNER_KEY]: 'alice' })
    const owner = createOwnerStore(storage)
    const order: string[] = []
    await trackOwner('bob', {
      owner,
      purge: async () => {
        order.push('purge')
        await owner.clear()
      },
    })
    order.push(`owner=${await owner.get()}`)
    expect(order).toEqual(['purge', 'owner=bob'])
  })
})
