import { MutationObserver, QueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { GRADE_MUTATION_KEY, reviewQueueKey } from './keys'
import {
  createReviewPrefetcher,
  PREFETCH_MAX_SETS,
  PREFETCH_MIN_INTERVAL_MS,
} from './prefetch-plan'

function setup({ online = true, clock = { now: 1_000_000 } } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const state = { online }
  const fetchSummary = vi.fn(async () => ({ due: 2, new: 1 }))
  const cards = [{ setId: 's1' }, { setId: 's2' }, { setId: 's1' }]
  const fetchQueue = vi.fn(async () => ({ cards }))
  const fetchSet = vi.fn(async (id: string) => ({ id }))
  const run = createReviewPrefetcher({
    client,
    isOnline: () => state.online,
    now: () => clock.now,
    fetchSummary,
    fetchQueue,
    fetchSet,
  })
  return { client, state, clock, run, fetchSummary, fetchQueue, fetchSet }
}

describe('createReviewPrefetcher', () => {
  it('charge le résumé, la file « all » et le détail de chaque set concerné (une fois)', async () => {
    const { run, client, fetchSummary, fetchQueue, fetchSet } = setup()
    await run()
    expect(fetchSummary).toHaveBeenCalledTimes(1)
    expect(fetchQueue).toHaveBeenCalledTimes(1)
    expect(fetchSet.mock.calls.map(([id]) => id)).toEqual(['s1', 's2'])
    expect(client.getQueryData(reviewQueueKey())).toBeDefined()
    expect(client.getQueryData(['review', 'summary'])).toEqual({ due: 2, new: 1 })
    expect(client.getQueryData(['sets', 'detail', 's2'])).toEqual({ id: 's2' })
  })

  it('ne fait rien hors ligne', async () => {
    const { run, fetchQueue } = setup({ online: false })
    await run()
    expect(fetchQueue).not.toHaveBeenCalled()
  })

  it("ne fait rien tant qu'une note est en attente", async () => {
    const { run, client, fetchQueue } = setup()
    client.setMutationDefaults(GRADE_MUTATION_KEY, { mutationFn: () => new Promise(() => {}) })
    void new MutationObserver<unknown, Error, unknown>(client, { mutationKey: GRADE_MUTATION_KEY })
      .mutate(null)
      .catch(() => {})
    await run()
    expect(fetchQueue).not.toHaveBeenCalled()
  })

  it('au plus une fois toutes les 10 minutes', async () => {
    const { run, clock, fetchQueue } = setup()
    await run()
    clock.now += PREFETCH_MIN_INTERVAL_MS - 1
    await run()
    expect(fetchQueue).toHaveBeenCalledTimes(1)
    clock.now += 1
    await run()
    expect(fetchQueue).toHaveBeenCalledTimes(2)
  })

  it('borne le nombre de détails de set', async () => {
    const { client, fetchSet } = setup()
    const many = Array.from({ length: PREFETCH_MAX_SETS + 10 }, (_, i) => ({ setId: `s${i}` }))
    const run = createReviewPrefetcher({
      client,
      isOnline: () => true,
      fetchSummary: async () => ({}),
      fetchQueue: async () => ({ cards: many }),
      fetchSet,
    })
    await run()
    expect(fetchSet).toHaveBeenCalledTimes(PREFETCH_MAX_SETS)
  })

  it('une panne réseau ne lève pas', async () => {
    const { client, fetchSet } = setup()
    const run = createReviewPrefetcher({
      client,
      isOnline: () => true,
      fetchSummary: async () => {
        throw new Error('réseau')
      },
      fetchQueue: async () => {
        throw new Error('réseau')
      },
      fetchSet,
    })
    await expect(run()).resolves.toBeUndefined()
    expect(fetchSet).not.toHaveBeenCalled()
  })
})
