import { DEFAULT_SETTINGS, type SettingsInput } from '@quizlet/shared'
import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { cardReviews, reviewLogs, users } from '../db/schema'
import { createTestClient, readJson } from '../test/app'
import { useTestDb } from '../test/test-db'

const db = useTestDb()

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
let clock = new Date('2026-10-13T08:00:00Z')
let request: ReturnType<typeof createTestClient>['request']

interface QueueJson {
  cards: Array<{ id: string; setId: string; term: string; state: string; intervals: string[] }>
  counts: { learning: number; review: number; new: number }
}
interface GradeJson {
  state: string
  due: string
  requeue: boolean
  card: { id: string; intervals: string[] } | null
  ignored: boolean
}

beforeEach(() => {
  clock = new Date('2026-10-13T08:00:00Z')
  ;({ request } = createTestClient(db, {}, { now: () => clock }))
})

async function createSetAs(username: string, count: number, visibility = 'private') {
  const res = await request('/api/sets', {
    method: 'POST',
    as: username,
    body: {
      title: `Set de ${username}`,
      description: null,
      visibility,
      cards: Array.from({ length: count }, (_, i) => ({ term: `t${i}`, definition: `d${i}` })),
    },
  })
  return (await readJson<{ set: { id: string; cards: Array<{ id: string }> } }>(res)).set
}

async function queueAs(username: string, setId?: string) {
  const res = await request(`/api/review/queue${setId ? `?setId=${setId}` : ''}`, { as: username })
  return { status: res.status, body: await readJson<QueueJson>(res) }
}

async function grade(username: string, cardId: string, rating: number, reviewedAt?: string) {
  const res = await request(`/api/review/cards/${cardId}`, {
    method: 'POST',
    as: username,
    body: reviewedAt === undefined ? { rating } : { rating, reviewedAt },
  })
  return { status: res.status, body: await readJson<GradeJson>(res) }
}

function saveSettings(username: string, settings: Partial<SettingsInput>) {
  return request('/api/settings', {
    method: 'PUT',
    as: username,
    body: { ...DEFAULT_SETTINGS, ...settings },
  })
}

async function userId(username: string) {
  const [user] = await db.select().from(users).where(eq(users.username, username))
  if (!user) throw new Error(`utilisateur ${username} absent`)
  return user.id
}

/** Progression « en révision », due à `due`, insérée directement. */
async function insertReview(username: string, cardId: string, due: Date) {
  await db.insert(cardReviews).values({
    userId: await userId(username),
    cardId,
    due,
    stability: 5,
    difficulty: 5,
    elapsedDays: 3,
    scheduledDays: 5,
    learningSteps: 0,
    reps: 3,
    lapses: 0,
    state: 'review',
    lastReview: new Date(due.getTime() - 5 * DAY),
  })
}

describe('notation (POST /api/review/cards/:cardId)', () => {
  it('enregistre le nouvel état FSRS et l’historique de la carte', async () => {
    const set = await createSetAs('alice', 2)
    const [first, second] = set.cards

    const good = await grade('alice', first?.id ?? '', 3)
    expect(good.status).toBe(200)
    expect(good.body).toMatchObject({ state: 'learning', requeue: true, ignored: false })
    expect(new Date(good.body.due)).toEqual(new Date(clock.getTime() + 10 * MINUTE))
    expect(good.body.card?.intervals).toHaveLength(4)

    const easy = await grade('alice', second?.id ?? '', 4)
    expect(easy.body).toMatchObject({
      state: 'review',
      requeue: false,
      card: null,
      ignored: false,
    })
    expect(new Date(easy.body.due).getTime() - clock.getTime()).toBeGreaterThanOrEqual(DAY)

    const logs = await db.select().from(reviewLogs)
    expect(logs.map(({ rating, state }) => ({ rating, state }))).toEqual([
      { rating: 3, state: 'new' },
      { rating: 4, state: 'new' },
    ])
    expect(await db.select().from(cardReviews)).toHaveLength(2)
  })

  it('refuse une note invalide et une carte inconnue', async () => {
    const set = await createSetAs('alice', 1)
    expect((await grade('alice', set.cards[0]?.id ?? '', 5)).status).toBe(400)
    expect((await grade('alice', '00000000-0000-4000-8000-000000000000', 3)).status).toBe(404)
  })
})

const iso = (ms: number) => new Date(ms).toISOString()
const cardRows = (cardId: string) =>
  db.select().from(cardReviews).where(eq(cardReviews.cardId, cardId))

/** Un set d'une carte : identifiant de la carte et note (date facultative) en un appel. */
async function oneCard(username = 'alice') {
  const [card] = (await createSetAs(username, 1)).cards
  const cardId = card?.id ?? ''
  return {
    cardId,
    grade: (rating: number, reviewedAt?: string) => grade(username, cardId, rating, reviewedAt),
  }
}

describe('notation datée (reviewedAt)', () => {
  it('applique une note passée à son heure : échéance, dernière révision et historique', async () => {
    const { cardId, grade } = await oneCard()
    const at = clock.getTime() - 2 * HOUR

    const res = await grade(3, iso(at))
    expect(res.status).toBe(200)
    // Échéance déjà dépassée : la carte reste dans la file du jour.
    expect(res.body).toMatchObject({ state: 'learning', requeue: true, ignored: false })
    expect(new Date(res.body.due)).toEqual(new Date(at + 10 * MINUTE))

    const [review] = await cardRows(cardId)
    expect(review).toMatchObject({ state: 'learning', reps: 1 })
    expect(review?.lastReview).toEqual(new Date(at))
    expect(review?.due).toEqual(new Date(at + 10 * MINUTE))
    const logs = await db.select().from(reviewLogs)
    expect(logs.map((log) => log.reviewedAt)).toEqual([new Date(at)])
  })

  it('garde telle quelle une note datée jusqu’à 5 minutes dans le futur', async () => {
    const { cardId, grade } = await oneCard()
    const at = clock.getTime() + 5 * MINUTE

    expect((await grade(3, iso(at))).body.ignored).toBe(false)
    expect((await cardRows(cardId))[0]?.lastReview).toEqual(new Date(at))
  })

  it('ramène à maintenant une note datée au-delà de la tolérance', async () => {
    const { cardId, grade } = await oneCard()

    const res = await grade(3, iso(clock.getTime() + 5 * MINUTE + 1))
    expect(res.body).toMatchObject({ state: 'learning', ignored: false })
    expect(new Date(res.body.due)).toEqual(new Date(clock.getTime() + 10 * MINUTE))
    expect((await cardRows(cardId))[0]?.lastReview).toEqual(clock)
    expect((await db.select().from(reviewLogs))[0]?.reviewedAt).toEqual(clock)
  })

  it('ignore une note de plus de 30 jours : carte nouvelle, rien n’est écrit', async () => {
    const { cardId, grade } = await oneCard()

    const res = await grade(3, iso(clock.getTime() - 30 * DAY - 1))
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ state: 'new', requeue: false, card: null, ignored: true })
    expect(new Date(res.body.due)).toEqual(clock)
    expect(await cardRows(cardId)).toEqual([])
    expect(await db.select().from(reviewLogs)).toEqual([])
  })

  it('ignore une note périmée sur une carte commencée : état renvoyé, rien n’est modifié', async () => {
    const { cardId, grade } = await oneCard()
    await insertReview('alice', cardId, new Date(clock.getTime() + 2 * DAY))
    const before = await cardRows(cardId)

    const res = await grade(1, iso(clock.getTime() - 40 * DAY))
    expect(res.body).toMatchObject({ state: 'review', requeue: false, card: null, ignored: true })
    expect(new Date(res.body.due)).toEqual(new Date(clock.getTime() + 2 * DAY))
    expect(await cardRows(cardId)).toEqual(before)
    expect(await db.select().from(reviewLogs)).toEqual([])
  })

  it('applique une note de 30 jours pile', async () => {
    const { grade } = await oneCard()
    expect((await grade(3, iso(clock.getTime() - 30 * DAY))).body.ignored).toBe(false)
  })

  it('ignore le rejeu identique d’une note : un seul historique, carte inchangée', async () => {
    const { cardId, grade } = await oneCard()
    const reviewedAt = iso(clock.getTime() - HOUR)

    const first = await grade(3, reviewedAt)
    const after = await cardRows(cardId)
    clock = new Date(clock.getTime() + HOUR) // la réponse s'est perdue : le rejeu arrive plus tard
    const replay = await grade(3, reviewedAt)

    expect(first.body.ignored).toBe(false)
    expect(replay.status).toBe(200)
    expect(replay.body).toMatchObject({
      state: first.body.state,
      due: first.body.due,
      requeue: false,
      card: null,
      ignored: true,
    })
    expect(await cardRows(cardId)).toEqual(after)
    expect(await db.select().from(reviewLogs)).toHaveLength(1)
  })

  it('applique deux notes dans l’ordre de leurs dates', async () => {
    const { cardId, grade } = await oneCard()
    const first = clock.getTime() - HOUR
    const second = first + 20 * MINUTE

    expect((await grade(3, iso(first))).body.ignored).toBe(false)
    expect((await grade(3, iso(second))).body).toMatchObject({ state: 'review', ignored: false })

    const logs = await db.select().from(reviewLogs).orderBy(reviewLogs.reviewedAt)
    expect(logs.map(({ state, reviewedAt }) => ({ state, reviewedAt }))).toEqual([
      { state: 'new', reviewedAt: new Date(first) },
      { state: 'learning', reviewedAt: new Date(second) },
    ])
    expect((await cardRows(cardId))[0]?.lastReview).toEqual(new Date(second))
  })

  it('ignore la note la plus ancienne quand elle arrive après une plus récente', async () => {
    const { cardId, grade } = await oneCard()
    const older = clock.getTime() - HOUR
    const newer = older + 20 * MINUTE

    expect((await grade(3, iso(newer))).body.ignored).toBe(false)
    const after = await cardRows(cardId)
    const late = await grade(1, iso(older))

    expect(late.body).toMatchObject({ state: 'learning', ignored: true })
    expect(await cardRows(cardId)).toEqual(after)
    expect(await db.select().from(reviewLogs)).toHaveLength(1)
  })

  it('compte une note datée d’hier pour hier : le quota du jour reste entier', async () => {
    await saveSettings('alice', { newCardsPerDay: 1 })
    const set = await createSetAs('alice', 3)
    const [yesterday, today] = set.cards

    await grade('alice', yesterday?.id ?? '', 4, iso(clock.getTime() - DAY))
    expect((await queueAs('alice')).body.counts.new).toBe(1)

    await grade('alice', today?.id ?? '', 4)
    expect((await queueAs('alice')).body.counts.new).toBe(0)
  })

  it('refuse un reviewedAt mal formé (400), sans rien écrire', async () => {
    const { cardId } = await oneCard()
    const invalid = ['2026-10-13T08:00:00+02:00', '2026-10-13T08:00:00', '2026-10-13', 'hier', '']
    for (const reviewedAt of [...invalid, 1_760_342_400_000, null]) {
      const res = await request(`/api/review/cards/${cardId}`, {
        method: 'POST',
        as: 'alice',
        body: { rating: 3, reviewedAt },
      })
      expect(res.status, String(reviewedAt)).toBe(400)
      expect(await readJson(res)).toMatchObject({ error: { code: 'VALIDATION_ERROR' } })
    }
    expect(await cardRows(cardId)).toEqual([])
  })

  it('traite la carte privée d’un autre comme inconnue (404), même avec une note périmée', async () => {
    const { cardId } = await oneCard('alice')
    for (const reviewedAt of [iso(clock.getTime() - 40 * DAY), iso(clock.getTime() - HOUR)]) {
      expect((await grade('bob', cardId, 3, reviewedAt)).status).toBe(404)
    }
    expect(await db.select().from(cardReviews)).toEqual([])
    expect(await db.select().from(reviewLogs)).toEqual([])
  })

  // Note mobile datée dans la tolérance de 5 min, puis note du web (sans reviewedAt) : l'horloge du
  // serveur est en retard sur `last_review`. À cheval sur minuit UTC, ts-fsrs lève (temps écoulé
  // négatif) : la note web et les prévisions de la file doivent s'en protéger.
  it.each([
    ['le même jour UTC', '2026-10-13T08:00:00Z'],
    ['à cheval sur minuit UTC', '2026-10-13T23:58:00Z'],
  ])('applique la note web qui suit une note mobile datée dans 2 minutes, %s', async (_, start) => {
    clock = new Date(start)
    const { cardId, grade } = await oneCard()
    const mobileAt = iso(clock.getTime() + 2 * MINUTE)

    const mobile = await grade(1, mobileAt)
    expect(mobile.status).toBe(200)
    expect(mobile.body).toMatchObject({ state: 'learning', requeue: true, ignored: false })
    expect(mobile.body.card?.intervals).toHaveLength(4)

    const web = await grade(1)
    expect(web.status).toBe(200)
    expect(web.body).toMatchObject({ state: 'learning', ignored: false })

    // L'heure de la note web est ramenée à la dernière révision, jamais avant.
    const logs = await db.select().from(reviewLogs)
    expect(logs.map((log) => log.reviewedAt)).toEqual([new Date(mobileAt), new Date(mobileAt)])
    expect((await cardRows(cardId))[0]?.lastReview).toEqual(new Date(mobileAt))

    // Le rejeu identique de la note mobile est ignoré.
    const replay = await grade(1, mobileAt)
    expect(replay.body).toMatchObject({ state: 'learning', ignored: true })
    expect(await db.select().from(reviewLogs)).toHaveLength(2)

    // La file (prévisions datées de `now`, en retard sur `last_review`) répond normalement.
    const queue = await queueAs('alice')
    expect(queue.status).toBe(200)
    expect(queue.body.cards.map((card) => card.id)).toEqual([cardId])
  })
})

describe('file du jour (GET /api/review/queue)', () => {
  it('propose les nouvelles cartes avec les échéances prévues pour chaque note', async () => {
    await createSetAs('alice', 3)
    const { body } = await queueAs('alice')
    expect(body.counts).toEqual({ learning: 0, review: 0, new: 3 })
    const intervals = body.cards[0]?.intervals.map((due) => new Date(due).getTime()) ?? []
    expect(intervals).toEqual([
      clock.getTime() + MINUTE,
      clock.getTime() + 6 * MINUTE,
      clock.getTime() + 10 * MINUTE,
      expect.any(Number),
    ])
  })

  it('limite les nouvelles cartes par jour ; le compteur repart à minuit', async () => {
    await saveSettings('alice', { newCardsPerDay: 2 })
    const set = await createSetAs('alice', 5)
    expect((await queueAs('alice')).body.counts.new).toBe(2)

    for (const card of set.cards.slice(0, 2)) await grade('alice', card.id, 4)
    expect((await queueAs('alice')).body.counts).toEqual({ learning: 0, review: 0, new: 0 })
    const summary = await request('/api/review/summary', { as: 'alice' })
    expect(await readJson(summary)).toEqual({ due: 0, new: 0 })

    // 00:30 à Paris le lendemain : nouvelle journée, nouveau quota.
    clock = new Date('2026-10-13T22:30:00Z')
    expect((await queueAs('alice')).body.counts.new).toBe(2)
  })

  it('plafonne les révisions du jour, mais jamais les cartes en apprentissage', async () => {
    await saveSettings('alice', { reviewsPerDay: 1 })
    const set = await createSetAs('alice', 4)
    const [a, b, c] = set.cards
    await insertReview('alice', a?.id ?? '', new Date(clock.getTime() - DAY))
    await insertReview('alice', b?.id ?? '', new Date(clock.getTime() - 2 * DAY))
    await grade('alice', c?.id ?? '', 1)

    const { body } = await queueAs('alice')
    expect(body.counts).toEqual({ learning: 1, review: 1, new: 1 })
    // La plus en retard d'abord.
    expect(body.cards.find((card) => card.state === 'review')?.id).toBe(b?.id)

    await grade('alice', b?.id ?? '', 3)
    expect((await queueAs('alice')).body.counts.review).toBe(0)
  })

  it('calcule le jour dans le fuseau de l’utilisateur', async () => {
    clock = new Date('2026-10-13T21:30:00Z') // 23:30 à Paris, 17:30 à New York
    const set = await createSetAs('alice', 1)
    // Due à 01:00 à Paris le 14, soit 19:00 à New York le 13.
    await insertReview('alice', set.cards[0]?.id ?? '', new Date('2026-10-13T23:00:00Z'))

    await saveSettings('alice', { timezone: 'Europe/Paris' })
    expect((await queueAs('alice')).body.counts.review).toBe(0)
    await saveSettings('alice', { timezone: 'America/New_York' })
    expect((await queueAs('alice')).body.counts.review).toBe(1)
  })
})

describe('permissions de la révision', () => {
  it("interdit d'étudier le set privé d'un autre (404)", async () => {
    const set = await createSetAs('alice', 2)
    expect((await grade('bob', set.cards[0]?.id ?? '', 3)).status).toBe(404)
    expect((await queueAs('bob', set.id)).status).toBe(404)
    const due = await request(`/api/review/due?setId=${set.id}`, { as: 'bob' })
    expect(due.status).toBe(404)
    expect(await db.select().from(cardReviews)).toEqual([])
  })

  it('garde une progression propre à chacun sur un set public', async () => {
    const set = await createSetAs('alice', 3, 'public')
    const [first] = set.cards
    expect((await queueAs('bob', set.id)).body.counts.new).toBe(3)

    expect((await grade('bob', first?.id ?? '', 1)).status).toBe(200)
    // Bob : la carte commencée revient dans sa révision du jour, sans les autres cartes d'Alice.
    const bobQueue = (await queueAs('bob')).body
    expect(bobQueue.counts).toEqual({ learning: 1, review: 0, new: 0 })
    // Alice : sa progression n'a pas bougé.
    expect((await queueAs('alice')).body.counts).toEqual({ learning: 0, review: 0, new: 3 })

    // Le set redevient privé : Bob ne peut plus ni le voir ni le réviser.
    await request(`/api/sets/${set.id}`, {
      method: 'PUT',
      as: 'alice',
      body: {
        title: 'Set de alice',
        description: null,
        visibility: 'private',
        cards: set.cards.map((card, i) => ({ id: card.id, term: `t${i}`, definition: `d${i}` })),
      },
    })
    expect((await queueAs('bob')).body.counts.learning).toBe(0)
    expect((await grade('bob', first?.id ?? '', 3)).status).toBe(404)
  })

  it('fait repartir de zéro la copie d’un set', async () => {
    const set = await createSetAs('alice', 2)
    for (const card of set.cards) await grade('alice', card.id, 4)
    const res = await request(`/api/sets/${set.id}/duplicate`, { method: 'POST', as: 'alice' })
    const copy = (await readJson<{ set: { id: string } }>(res)).set
    expect((await queueAs('alice', copy.id)).body.counts).toEqual({
      learning: 0,
      review: 0,
      new: 2,
    })
  })
})

describe('cartes dues d’un set (GET /api/review/due)', () => {
  it('liste les cartes commencées dues aujourd’hui, sans plafond ni nouvelles cartes', async () => {
    await saveSettings('alice', { reviewsPerDay: 0 })
    const set = await createSetAs('alice', 3)
    const [a, b] = set.cards
    await insertReview('alice', a?.id ?? '', new Date(clock.getTime() - DAY))
    await insertReview('alice', b?.id ?? '', new Date(clock.getTime() + 3 * DAY))

    const res = await request(`/api/review/due?setId=${set.id}`, { as: 'alice' })
    expect(await readJson(res)).toEqual({ cardIds: [a?.id] })
  })
})
