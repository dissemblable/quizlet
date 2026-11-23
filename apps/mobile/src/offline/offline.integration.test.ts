/**
 * Intégration sous Node : le VRAI code de TanStack (`QueryClient`, `onlineManager`, mutations à
 * `scope`, `dehydrate` / restauration) avec un serveur simulé et un stockage en mémoire, sans React
 * ni React Native. Le « serveur » applique une note si `reviewedAt` est postérieur à la dernière
 * révision de la carte (comme `gradeCard` côté API).
 */
import { ApiError } from '@quizlet/shared'
import { onlineManager, type QueryClient, QueryObserver } from '@tanstack/react-query'
import { persistQueryClientRestore } from '@tanstack/react-query-persist-client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthStatus } from '@/auth/types'
import { createOfflineClient } from './client-factory'
import type { KeyValueStorage } from './file-storage'
import { submitGrade } from './grade-flow'
import { GradeAbortedError, type GradeResponse, type GradeVariables } from './grade-policy'
import { GRADE_MUTATION_KEY, ME_KEY, REVIEW_SUMMARY_KEY, reviewQueueKey } from './keys'
import { createOwnerStore } from './owner-store'
import {
  createDirectPersister,
  dehydrateOptions,
  flushCache,
  PERSIST_BUSTER,
  serializeClient,
} from './persist'
import { createRestoreHandlers, watchReconnection } from './restore'
import { createSendGate } from './send-gate'
import type { SyncReport } from './sync-report'

function memoryStorage(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return {
    data,
    getItem: async (key) => data.get(key) ?? null,
    setItem: async (key, value) => void data.set(key, value),
    removeItem: async (key) => void data.delete(key),
  }
}

/** Serveur simulé : mémorise la dernière révision par carte et les notes appliquées. */
function createServer() {
  const lastReview = new Map<string, number>()
  const applied: GradeVariables[] = []
  const calls: GradeVariables[] = []
  const server = {
    applied,
    calls,
    /** Appelé avant la réponse : peut échouer, ou ne jamais répondre. */
    beforeReply: undefined as undefined | ((variables: GradeVariables) => Promise<void> | void),
    /** Si vrai, la note est appliquée mais la réponse ne revient jamais (app tuée en plein envoi). */
    swallowReply: false,
    async post(variables: GradeVariables): Promise<GradeResponse> {
      calls.push(variables)
      await server.beforeReply?.(variables)
      const at = Date.parse(variables.reviewedAt)
      const last = lastReview.get(variables.cardId)
      const ignored = last !== undefined && at <= last
      if (!ignored) {
        lastReview.set(variables.cardId, at)
        applied.push(variables)
      }
      if (server.swallowReply) await new Promise<never>(() => {})
      return { card: null, ignored }
    },
  }
  return server
}
type Server = ReturnType<typeof createServer>

const clients: QueryClient[] = []

function build(
  server: Server,
  overrides: { whenReadyToSend?: (ownerId?: string) => Promise<void> } = {},
) {
  const reports: SyncReport[] = []
  const client = createOfflineClient({
    postGrade: (variables) => server.post(variables),
    whenReadyToSend: overrides.whenReadyToSend ?? (async () => {}),
    report: (report) => reports.push(report),
    // Toute note a « attendu » : elle compte dans le compte rendu.
    now: () => Date.now() + 60_000,
  })
  client.mount()
  clients.push(client)
  return { client, reports }
}

/** Mort de l'app : le client disparaît sans rien envoyer de plus. */
function kill(client: QueryClient) {
  client.unmount()
  client.getMutationCache().clear()
  client.getQueryCache().clear()
}

const deps = (client: QueryClient) => ({
  client,
  isOnline: () => onlineManager.isOnline(),
  flush: () => {},
})

/** Une note à la seconde `n` : les dates croissantes de `n` ordonnent les notes. */
const at = (n: number) => new Date(Date.UTC(2026, 10, 20, 10, 0, n))
const card = (id: string, state: 'new' | 'review' = 'review') => ({ id, state })

async function restoreInto(client: QueryClient, storage: KeyValueStorage) {
  const handlers = createRestoreHandlers(client)
  await persistQueryClientRestore({
    queryClient: client,
    persister: createDirectPersister(storage),
    buster: PERSIST_BUSTER,
    maxAge: Number.POSITIVE_INFINITY,
  }).then(() => handlers.onSuccess())
  return handlers
}

beforeEach(() => {
  onlineManager.setOnline(true)
})

afterEach(() => {
  vi.useRealTimers()
  for (const client of clients.splice(0)) client.unmount()
  onlineManager.setOnline(true)
})

describe('note hors ligne', () => {
  it('naît en pause, persistable, sans appel serveur', async () => {
    onlineManager.setOnline(false)
    const server = createServer()
    const { client } = build(server)

    const outcome = await submitGrade(deps(client), card('c1'), 3, at(1))

    expect(outcome).toEqual({ kind: 'queued' })
    const [mutation] = client.getMutationCache().getAll()
    expect(mutation?.state.status).toBe('pending')
    expect(mutation?.state.isPaused).toBe(true)
    expect(server.calls).toHaveLength(0)
    expect(
      client
        .getMutationCache()
        .getAll()
        .filter((m) => dehydrateOptions.shouldDehydrateMutation(m)),
    ).toHaveLength(1)
  })

  it("part au retour du réseau, une note après l'autre dans l'ordre", async () => {
    onlineManager.setOnline(false)
    const server = createServer()
    const { client, reports } = build(server)
    for (const [n, id] of [
      [1, 'c1'],
      [2, 'c2'],
      [3, 'c3'],
      [4, 'c1'],
    ] as const) {
      await submitGrade(deps(client), card(id), 3, at(n))
    }
    expect(server.calls).toHaveLength(0)

    onlineManager.setOnline(true)

    await vi.waitFor(() => expect(server.applied).toHaveLength(4))
    expect(server.applied.map((v) => [v.cardId, v.reviewedAt])).toEqual([
      ['c1', at(1).toISOString()],
      ['c2', at(2).toISOString()],
      ['c3', at(3).toISOString()],
      ['c1', at(4).toISOString()],
    ])
    await vi.waitFor(() => expect(reports).toHaveLength(1))
    expect(reports[0]).toEqual({ message: '4 notes synchronisées', kind: 'info' })
  })

  it("dehydrate → nouveau client → defaults → reprise dans l'ordre", async () => {
    onlineManager.setOnline(false)
    const server = createServer()
    const first = build(server)
    const storage = memoryStorage()
    for (const [n, id] of [
      [1, 'c1'],
      [2, 'c2'],
      [3, 'c3'],
    ] as const) {
      await submitGrade(deps(first.client), card(id), n === 3 ? 1 : 3, at(n))
    }
    await flushCache(first.client, storage)
    kill(first.client)

    // Redémarrage : un client neuf (les defaults sont posés à sa création), puis la restauration.
    const second = build(server)
    const handlers = await restoreInto(second.client, storage)
    expect(handlers.isRestored()).toBe(true)
    const restored = second.client.getMutationCache().getAll()
    expect(restored).toHaveLength(3)
    expect(restored.every((m) => m.state.status === 'pending')).toBe(true)
    expect(server.calls).toHaveLength(0)

    onlineManager.setOnline(true)

    await vi.waitFor(() => expect(server.applied).toHaveLength(3))
    expect(server.applied.map((v) => v.cardId)).toEqual(['c1', 'c2', 'c3'])
    // Les notes d'origine (variables) sont rejouées à l'identique.
    expect(server.applied.map((v) => v.rating)).toEqual([3, 3, 1])
    expect(server.applied.map((v) => v.reviewedAt)).toEqual([
      at(1).toISOString(),
      at(2).toISOString(),
      at(3).toISOString(),
    ])
  })

  it('une restauration en ligne relance les notes en vol toute seule (continue)', async () => {
    // Note en vol au moment de la mort : `pending`, pas en pause.
    const server = createServer()
    server.swallowReply = true
    const first = build(server)
    const storage = memoryStorage()
    const outcome = await submitGrade({ ...deps(first.client), waitMs: 20 }, card('c1'), 4, at(1))
    expect(outcome).toEqual({ kind: 'queued' })
    expect(first.client.getMutationCache().getAll()[0]?.state.isPaused).toBe(false)
    await flushCache(first.client, storage)
    kill(first.client)

    const next = createServer()
    const second = build(next)
    await restoreInto(second.client, storage)

    await vi.waitFor(() => expect(next.calls).toHaveLength(1))
  })
})

describe("rejeu après mort pendant l'envoi", () => {
  it('une seule application côté serveur, la seconde est ignorée et comptée', async () => {
    const server = createServer()
    server.swallowReply = true
    const first = build(server)
    const storage = memoryStorage()
    await submitGrade({ ...deps(first.client), waitMs: 20 }, card('c1'), 3, at(1))
    expect(server.applied).toHaveLength(1)
    await flushCache(first.client, storage)
    kill(first.client)

    server.swallowReply = false
    const second = build(server)
    await restoreInto(second.client, storage)

    await vi.waitFor(() => expect(server.calls).toHaveLength(2))
    expect(server.applied).toHaveLength(1)
    await vi.waitFor(() => expect(second.reports).toHaveLength(1))
    expect(second.reports[0]).toEqual({ message: '1 note ignorée', kind: 'info' })
  })
})

describe('refus définitif (4xx)', () => {
  it('abandonne la note, la compte, et laisse partir les suivantes', async () => {
    const server = createServer()
    server.beforeReply = (variables) => {
      if (variables.cardId === 'supprimee') {
        throw new ApiError(404, 'NOT_FOUND', 'Carte introuvable.')
      }
    }
    onlineManager.setOnline(false)
    const { client, reports } = build(server)
    client.setQueryData(reviewQueueKey(), { cards: [{ id: 'supprimee' }, { id: 'c2' }] })
    await submitGrade(deps(client), card('supprimee'), 3, at(1))
    await submitGrade(deps(client), card('c2'), 3, at(2))

    onlineManager.setOnline(true)

    await vi.waitFor(() => expect(reports).toHaveLength(1))
    // Une seule tentative pour le 404 (aucun retry), puis la note suivante est partie.
    expect(server.calls.map((v) => v.cardId)).toEqual(['supprimee', 'c2'])
    expect(reports[0]).toEqual({
      message: '1 note synchronisée · 1 note abandonnée (refus ou panne du serveur)',
      kind: 'error',
    })
    // La carte refusée ne revient pas dans la file en cache.
    expect(client.getQueryData(reviewQueueKey())).toEqual({ cards: [] })
  })

  it('en ligne, `submitGrade` rejette pour un refus définitif', async () => {
    const server = createServer()
    server.beforeReply = () => {
      throw new ApiError(404, 'NOT_FOUND', 'Carte introuvable.')
    }
    const { client } = build(server)
    await expect(submitGrade(deps(client), card('c1'), 3, at(1))).rejects.toMatchObject({
      status: 404,
    })
  })
})

describe('erreur réseau ou serveur', () => {
  it('est réessayée avec un délai croissant puis la note est appliquée une fois', async () => {
    vi.useFakeTimers()
    const server = createServer()
    let failures = 2
    server.beforeReply = () => {
      if (failures-- > 0)
        throw new ApiError(0, 'NETWORK_ERROR', 'Impossible de joindre le serveur.')
    }
    const { client } = build(server)

    const outcome = submitGrade({ ...deps(client), waitMs: 60_000 }, card('c1'), 3, at(1))
    await vi.advanceTimersByTimeAsync(0)
    expect(server.calls).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(999)
    expect(server.calls).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(server.calls).toHaveLength(2)
    await vi.advanceTimersByTimeAsync(2000)

    await expect(outcome).resolves.toEqual({ kind: 'synced', requeue: null, ignored: false })
    expect(server.calls).toHaveLength(3)
    expect(server.applied).toHaveLength(1)
  })

  it('une 5xx est aussi réessayée', async () => {
    vi.useFakeTimers()
    const server = createServer()
    let failures = 1
    server.beforeReply = () => {
      if (failures-- > 0) throw new ApiError(503, 'INTERNAL_ERROR', 'Indisponible.')
    }
    const { client } = build(server)
    const outcome = submitGrade({ ...deps(client), waitMs: 60_000 }, card('c1'), 3, at(1))
    await vi.advanceTimersByTimeAsync(1000)
    await expect(outcome).resolves.toMatchObject({ kind: 'synced' })
    expect(server.calls).toHaveLength(2)
  })
})

describe('chemin unique de note en ligne', () => {
  it('rend `synced` avec la carte à remettre en file et le drapeau `ignored`', async () => {
    const server = createServer()
    const requeue = { id: 'c1', setId: 's' } as unknown as GradeResponse['card']
    server.post = async () => ({ card: requeue, ignored: false })
    const { client } = build(server)
    await expect(submitGrade(deps(client), card('c1'), 1, at(1))).resolves.toEqual({
      kind: 'synced',
      requeue,
      ignored: false,
    })
  })

  it('rend `queued` passé le délai, la note continue en arrière-plan', async () => {
    const server = createServer()
    let release: () => void = () => {}
    server.beforeReply = () =>
      new Promise<void>((resolve) => {
        release = resolve
      })
    const { client } = build(server)
    const outcome = await submitGrade({ ...deps(client), waitMs: 10 }, card('c1'), 3, at(1))
    expect(outcome).toEqual({ kind: 'queued' })
    expect(client.isMutating({ mutationKey: GRADE_MUTATION_KEY })).toBe(1)
    release()
    await vi.waitFor(() => expect(client.isMutating({ mutationKey: GRADE_MUTATION_KEY })).toBe(0))
    expect(server.applied).toHaveLength(1)
  })

  it('un refus arrivé après le délai ne provoque aucun rejet non géré', async () => {
    const server = createServer()
    let fail: () => void = () => {}
    server.beforeReply = () =>
      new Promise<void>((_resolve, reject) => {
        fail = () => reject(new ApiError(404, 'NOT_FOUND', 'Carte introuvable.'))
      })
    const unhandled = vi.fn()
    process.on('unhandledRejection', unhandled)
    try {
      const { client, reports } = build(server)
      await submitGrade({ ...deps(client), waitMs: 10 }, card('c1'), 3, at(1))
      fail()
      await vi.waitFor(() => expect(reports).toHaveLength(1))
      await new Promise((resolve) => setTimeout(resolve, 20))
      expect(unhandled).not.toHaveBeenCalled()
    } finally {
      process.off('unhandledRejection', unhandled)
    }
  })

  it("un refus dans la fenêtre fait rejeter `grade()` sans second toast (celui de l'écran suffit)", async () => {
    const server = createServer()
    server.beforeReply = () => {
      throw new ApiError(404, 'NOT_FOUND', 'Carte introuvable.')
    }
    const reports: SyncReport[] = []
    // Horloge réelle : la note n'a pas « attendu », elle ne compte pas dans le compte rendu.
    const client = createOfflineClient({
      postGrade: (variables) => server.post(variables),
      whenReadyToSend: async () => {},
      report: (report) => reports.push(report),
    })
    client.mount()
    clients.push(client)

    await expect(submitGrade(deps(client), card('c1'), 3)).rejects.toMatchObject({ status: 404 })
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(reports).toEqual([])
  })

  it('une note donnée en ligne et vite synchronisée ne déclenche aucun toast', async () => {
    const server = createServer()
    const reports: SyncReport[] = []
    const client = createOfflineClient({
      postGrade: (variables) => server.post(variables),
      whenReadyToSend: async () => {},
      report: (report) => reports.push(report),
    })
    client.mount()
    clients.push(client)
    await submitGrade(deps(client), card('c1'), 3)
    expect(reports).toEqual([])
  })
})

describe("effets d'une note terminée", () => {
  it("retire la carte des files en cache et n'invalide le résumé qu'à la dernière note", async () => {
    onlineManager.setOnline(false)
    const server = createServer()
    const { client } = build(server)
    client.setQueryData(reviewQueueKey(), { cards: [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }] })
    client.setQueryData(reviewQueueKey('set-1'), { cards: [{ id: 'c1' }] })
    client.setQueryData(REVIEW_SUMMARY_KEY, { due: 3, new: 0 })
    await submitGrade(deps(client), card('c1'), 3, at(1))
    await submitGrade(deps(client), card('c2'), 3, at(2))

    const release = new Map<string, () => void>()
    server.beforeReply = (variables) =>
      new Promise<void>((resolve) => {
        release.set(variables.cardId, resolve)
      })
    onlineManager.setOnline(true)

    await vi.waitFor(() => expect(release.has('c1')).toBe(true))
    release.get('c1')?.()
    // La première est terminée, la seconde attend encore : pas d'invalidation du résumé.
    await vi.waitFor(() => expect(release.has('c2')).toBe(true))
    expect(client.getQueryData(reviewQueueKey())).toEqual({ cards: [{ id: 'c2' }, { id: 'c3' }] })
    expect(client.getQueryState(REVIEW_SUMMARY_KEY)?.isInvalidated).toBe(false)

    release.get('c2')?.()
    await vi.waitFor(() =>
      expect(client.getQueryState(REVIEW_SUMMARY_KEY)?.isInvalidated).toBe(true),
    )
    expect(client.getQueryData(reviewQueueKey())).toEqual({ cards: [{ id: 'c3' }] })
    expect(client.getQueryData(reviewQueueKey('set-1'))).toEqual({ cards: [] })
  })
})

describe('restauration', () => {
  it("`onSuccess` ne renvoie pas de promesse : la restauration ne dépend pas de l'envoi des notes", async () => {
    onlineManager.setOnline(false)
    const server = createServer()
    const first = build(server)
    const storage = memoryStorage()
    await submitGrade(deps(first.client), card('c1'), 3, at(1))
    await flushCache(first.client, storage)
    kill(first.client)

    // Note bloquée indéfiniment (porte jamais ouverte) : si `onSuccess` renvoyait la promesse de
    // `continue()`, la restauration ci-dessous ne se terminerait jamais.
    const second = build(server, { whenReadyToSend: () => new Promise<void>(() => {}) })
    onlineManager.setOnline(true)
    const handlers = createRestoreHandlers(second.client)
    // Même chaîne que `PersistQueryClientProvider` : la promesse d'`onSuccess` serait attendue.
    const onSuccess: () => Promise<unknown> | unknown = handlers.onSuccess
    const restored = persistQueryClientRestore({
      queryClient: second.client,
      persister: createDirectPersister(storage),
      buster: PERSIST_BUSTER,
      maxAge: Number.POSITIVE_INFINITY,
    }).then(() => onSuccess())
    const verdict = await Promise.race([
      restored.then(() => 'restaurée'),
      new Promise((resolve) => setTimeout(() => resolve('bloquée'), 500)),
    ])
    expect(verdict).toBe('restaurée')
    expect(second.client.isMutating({ mutationKey: GRADE_MUTATION_KEY })).toBe(1)
  })

  it("un cache vide ou d'un autre buster ne ressuscite aucune note", async () => {
    const storage = memoryStorage()
    const server = createServer()
    onlineManager.setOnline(false)
    const first = build(server)
    await submitGrade(deps(first.client), card('c1'), 3, at(1))
    const json = serializeClient({
      timestamp: Date.now(),
      buster: 'autre',
      clientState: { mutations: [], queries: [] },
    })
    await storage.setItem('quizlet.offline.cache.v1', json)
    kill(first.client)
    const second = build(server)
    await restoreInto(second.client, storage)
    expect(second.client.getMutationCache().getAll()).toHaveLength(0)
  })
})

/** Porte d'envoi réelle, session et utilisateur pilotés à la main. */
function gated() {
  let status: AuthStatus = 'expired'
  const listeners = new Set<(status: AuthStatus) => void>()
  const owner = createOwnerStore(memoryStorage())
  const purge = vi.fn(async () => {
    await owner.clear()
  })
  let userId = 'alice'
  const fetchUserId = vi.fn(async () => userId)
  const gate = createSendGate({
    whenAuthenticated: () =>
      status === 'signedIn'
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            const listener = (next: AuthStatus) => {
              if (next !== 'signedIn') return
              listeners.delete(listener)
              resolve()
            }
            listeners.add(listener)
          }),
    subscribeStatus: (listener) => {
      listeners.add(listener)
      return () => void listeners.delete(listener)
    },
    fetchUserId,
    owner,
    purge,
  })
  return {
    gate,
    owner,
    purge,
    fetchUserId,
    /** Utilisateur renvoyé par `/api/me` (celui du jeton courant). */
    setUser(next: string) {
      userId = next
    },
    setStatus(next: AuthStatus) {
      status = next
      for (const listener of [...listeners]) listener(next)
    },
  }
}

describe("porte d'envoi", () => {
  it('aucun envoi tant que la session est expirée, puis la file part à la reconnexion', async () => {
    const server = createServer()
    const g = gated()
    await g.owner.set('alice')
    const { client } = build(server, {
      whenReadyToSend: (ownerId) => g.gate.whenReadyToSend(ownerId),
    })

    const outcome = await submitGrade({ ...deps(client), waitMs: 10 }, card('c1'), 3, at(1))
    expect(outcome).toEqual({ kind: 'queued' })
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(server.calls).toHaveLength(0)
    expect(g.fetchUserId).not.toHaveBeenCalled()

    g.setStatus('signedIn')

    await vi.waitFor(() => expect(server.applied).toHaveLength(1))
    expect(g.fetchUserId).toHaveBeenCalledTimes(1)
  })

  it('un autre propriétaire : cache purgé, note jamais envoyée, aucun toast', async () => {
    const server = createServer()
    const g = gated()
    await g.owner.set('bob')
    const { client, reports } = build(server, {
      whenReadyToSend: (ownerId) => g.gate.whenReadyToSend(ownerId),
    })
    g.setStatus('signedIn')

    await expect(submitGrade(deps(client), card('c1'), 3, at(1))).rejects.toBeInstanceOf(
      GradeAbortedError,
    )
    expect(g.purge).toHaveBeenCalledTimes(1)
    expect(server.calls).toHaveLength(0)
    expect(reports).toEqual([])
  })
})

describe("note d'un autre compte", () => {
  const me = (id: string) => ({ user: { id } })
  const gate = (g: ReturnType<typeof gated>) => ({
    whenReadyToSend: (ownerId?: string) => g.gate.whenReadyToSend(ownerId),
  })

  it("A se déconnecte avec une note en attente, B se connecte : la note de A n'est pas envoyée avec le jeton de B", async () => {
    const server = createServer()
    const g = gated()
    await g.owner.set('alice')
    g.setStatus('signedIn')
    onlineManager.setOnline(false)
    const first = build(server, gate(g))
    first.client.setQueryData(ME_KEY, me('alice'))
    await submitGrade(deps(first.client), card('c1'), 3, at(1))
    // La note porte le compte du tap.
    expect(first.client.getMutationCache().getAll()[0]?.state.variables).toMatchObject({
      cardId: 'c1',
      ownerId: 'alice',
    })
    const storage = memoryStorage()
    await flushCache(first.client, storage)
    kill(first.client)

    // A se déconnecte, la purge est incomplète (propriétaire perdu) ; B se connecte.
    g.setStatus('signedOut')
    await g.owner.clear()
    g.setUser('bob')
    const second = build(server, gate(g))
    await restoreInto(second.client, storage)
    onlineManager.setOnline(true)
    g.setStatus('signedIn')

    await vi.waitFor(() =>
      expect(second.client.getMutationCache().getAll()[0]?.state.error).toBeInstanceOf(
        GradeAbortedError,
      ),
    )
    expect(server.calls).toHaveLength(0)
    expect(second.reports).toEqual([])
  })

  it('une note sans ownerId (ancienne mutation restaurée) garde le comportement actuel', async () => {
    const server = createServer()
    const g = gated()
    g.setStatus('signedIn')
    const { client } = build(server, gate(g))
    // Pas de `['me']` en cache au tap : propriétaire inconnu, la note n'est pas contrôlée.
    await expect(submitGrade(deps(client), card('c1'), 3, at(1))).resolves.toMatchObject({
      kind: 'synced',
    })
    expect(server.applied).toHaveLength(1)
  })

  it('la note de B part avec le jeton de B', async () => {
    const server = createServer()
    const g = gated()
    g.setUser('bob')
    g.setStatus('signedIn')
    const { client } = build(server, gate(g))
    client.setQueryData(ME_KEY, me('bob'))
    await submitGrade(deps(client), card('c1'), 3, at(1))
    expect(server.applied).toHaveLength(1)
  })
})

describe('note empoisonnée', () => {
  it('une 5xx persistante est abandonnée après 10 réessais, comptée, et la file repart', async () => {
    vi.useFakeTimers()
    const server = createServer()
    server.beforeReply = (variables) => {
      if (variables.cardId === 'poison') throw new ApiError(500, 'INTERNAL_ERROR', 'Panne.')
    }
    onlineManager.setOnline(false)
    const { client, reports } = build(server)
    await submitGrade(deps(client), card('poison'), 3, at(1))
    await submitGrade(deps(client), card('c2'), 3, at(2))

    onlineManager.setOnline(true)
    // 1 + 2 + 4 + 8 + 16 + 5 × 30 = 181 s de délais pour les 10 réessais.
    await vi.advanceTimersByTimeAsync(181_000)

    expect(server.calls.filter((v) => v.cardId === 'poison')).toHaveLength(11)
    expect(server.applied.map((v) => v.cardId)).toEqual(['c2'])
    expect(reports).toEqual([
      {
        message: '1 note synchronisée · 1 note abandonnée (refus ou panne du serveur)',
        kind: 'error',
      },
    ])
  })

  it('une panne réseau, elle, est réessayée sans limite', async () => {
    vi.useFakeTimers()
    const server = createServer()
    let failures = 25
    server.beforeReply = () => {
      if (failures-- > 0) throw new ApiError(0, 'NETWORK_ERROR', 'Hors ligne.')
    }
    const { client } = build(server)
    void submitGrade({ ...deps(client), waitMs: 1 }, card('c1'), 3, at(1))
    await vi.advanceTimersByTimeAsync(25 * 30_000)
    expect(server.applied).toHaveLength(1)
    expect(server.calls).toHaveLength(26)
  })
})

describe('reconnexion', () => {
  function fakeAuth(initial: AuthStatus) {
    let status = initial
    const listeners = new Set<(status: AuthStatus) => void>()
    return {
      get: () => status,
      subscribe(listener: (status: AuthStatus) => void) {
        listeners.add(listener)
        return () => void listeners.delete(listener)
      },
      set(next: AuthStatus) {
        status = next
        for (const listener of [...listeners]) listener(next)
      },
    }
  }

  /** Requête active qui échoue en `SESSION_EXPIRED` tant que la session est fermée. */
  function expiringQuery(client: QueryClient) {
    const state = { open: false }
    const queryFn = vi.fn(async () => {
      if (!state.open) throw new ApiError(401, 'SESSION_EXPIRED', 'Session expirée.')
      return 'ok'
    })
    const observer = new QueryObserver(client, {
      queryKey: REVIEW_SUMMARY_KEY,
      queryFn,
      retry: false,
    })
    const unsubscribe = observer.subscribe(() => {})
    return { state, queryFn, observer, unsubscribe }
  }

  it.each(['expired', 'signedOut', 'loading'] as const)(
    'depuis %s : une requête tombée en SESSION_EXPIRED est relancée',
    async (from) => {
      const { client } = build(createServer())
      const auth = fakeAuth(from)
      const stop = watchReconnection(client, auth)
      const query = expiringQuery(client)
      await vi.waitFor(() => expect(query.observer.getCurrentResult().isError).toBe(true))

      query.state.open = true
      auth.set('signedIn')

      await vi.waitFor(() => expect(query.observer.getCurrentResult().data).toBe('ok'))
      stop()
      query.unsubscribe()
    },
  )

  it('ne relance que sur une vraie reconnexion (pas signedIn → signedIn)', async () => {
    const { client } = build(createServer())
    const auth = fakeAuth('signedIn')
    const stop = watchReconnection(client, auth)
    const query = expiringQuery(client)
    await vi.waitFor(() => expect(query.observer.getCurrentResult().isError).toBe(true))
    const calls = query.queryFn.mock.calls.length

    auth.set('expired')
    expect(query.queryFn.mock.calls.length).toBe(calls)
    auth.set('signedIn')
    await vi.waitFor(() => expect(query.queryFn.mock.calls.length).toBe(calls + 1))
    // Deux `signedIn` de suite : pas de relance supplémentaire.
    auth.set('signedIn')
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(query.queryFn.mock.calls.length).toBe(calls + 1)
    stop()
    query.unsubscribe()
  })

  it('relance les notes restaurées et ne touche pas aux mutations', async () => {
    // Note en vol à la mort de l'app : `pending`, pas en pause (le retour du réseau ne la relance pas).
    const dead = createServer()
    dead.swallowReply = true
    const first = build(dead)
    const storage = memoryStorage()
    await submitGrade({ ...deps(first.client), waitMs: 20 }, card('c1'), 3, at(1))
    await flushCache(first.client, storage)
    kill(first.client)

    // Restauration SANS reprise (aucun `onSuccess`) : la note reste `pending`, sans exécution.
    const server = createServer()
    const second = build(server)
    await persistQueryClientRestore({
      queryClient: second.client,
      persister: createDirectPersister(storage),
      buster: PERSIST_BUSTER,
      maxAge: Number.POSITIVE_INFINITY,
    })
    const mutation = second.client.getMutationCache().getAll()[0]
    expect(mutation?.state.status).toBe('pending')
    const auth = fakeAuth('expired')
    const stop = watchReconnection(second.client, auth)
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(server.calls).toHaveLength(0)

    auth.set('signedIn')

    await vi.waitFor(() => expect(server.applied).toHaveLength(1))
    expect(second.client.getMutationCache().getAll()[0]).toBe(mutation)
    stop()
  })
})
