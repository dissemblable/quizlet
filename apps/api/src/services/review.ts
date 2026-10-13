import type { CardState, Rating } from '@quizlet/shared'
import { and, asc, eq, gte, inArray, isNull, lt, ne, or, sql } from 'drizzle-orm'
import { createEmptyCard } from 'ts-fsrs'
import type { Db, Executor } from '../db/client'
import { cardReviews, cards, reviewLogs, sets, type User } from '../db/schema'
import { decideAccess } from '../domain/permissions'
import {
  createScheduler,
  fromFsrsCard,
  fromFsrsLog,
  previewDue,
  type ReviewFields,
  type Scheduler,
  toFsrsCard,
} from '../domain/scheduler'
import { notFound } from '../errors'
import { findViewableSet } from './sets'
import { dayBounds, effectiveSettings } from './settings'

export interface QueueCard {
  id: string
  setId: string
  term: string
  definition: string
  state: CardState
  /** Échéance prévue pour chaque note, de 1 (À revoir) à 4 (Facile). */
  intervals: Date[]
}

const cardColumns = {
  id: cards.id,
  setId: cards.setId,
  term: cards.term,
  definition: cards.definition,
}

/** Sets dont l'utilisateur peut réviser les cartes : les siens, et les sets publics. */
function visibleTo(user: User) {
  return or(eq(sets.ownerId, user.id), eq(sets.visibility, 'public'))
}

function toQueueCard(
  card: Omit<QueueCard, 'state' | 'intervals'>,
  review: ReviewFields | undefined,
  scheduler: Scheduler,
  now: Date,
): QueueCard {
  const fsrsCard = toFsrsCard(review, now)
  return {
    ...card,
    state: review?.state ?? 'new',
    intervals: previewDue(scheduler, fsrsCard, now),
  }
}

/** Révisions déjà faites aujourd'hui, selon l'état des cartes avant la révision. */
async function doneToday(db: Executor, user: User, start: Date) {
  const [row] = await db
    .select({
      newCards: sql<number>`count(*) FILTER (WHERE ${reviewLogs.state} = 'new')`.mapWith(Number),
      reviews: sql<number>`count(*) FILTER (WHERE ${reviewLogs.state} = 'review')`.mapWith(Number),
    })
    .from(reviewLogs)
    .where(and(eq(reviewLogs.userId, user.id), gte(reviewLogs.reviewedAt, start)))
  return { newCards: row?.newCards ?? 0, reviews: row?.reviews ?? 0 }
}

/**
 * File de révision du jour (tous mes sets, ou un seul set visible) :
 * - cartes en (ré)apprentissage dues avant minuit, sans plafond ;
 * - cartes en révision dues avant minuit, dans la limite des révisions restantes du jour ;
 * - nouvelles cartes, dans la limite des nouvelles cartes restantes du jour. Sans `setId`, elles ne
 *   viennent que de mes sets ; les cartes dues, elles, viennent aussi des sets publics commencés.
 * Le jour change à minuit dans le fuseau de l'utilisateur.
 */
export async function buildQueue(db: Db, user: User, now: Date, setId?: string) {
  if (setId) await findViewableSet(db, setId, user)
  const settings = await effectiveSettings(db, user)
  const { start, end } = await dayBounds(db, now, settings.timezone)
  const done = await doneToday(db, user, start)
  const inScope = setId ? eq(cards.setId, setId) : undefined

  const due = (states: CardState[], limit?: number) => {
    const query = db
      .select({ card: cardColumns, review: cardReviews })
      .from(cardReviews)
      .innerJoin(cards, eq(cards.id, cardReviews.cardId))
      .innerJoin(sets, eq(sets.id, cards.setId))
      .where(
        and(
          eq(cardReviews.userId, user.id),
          inArray(cardReviews.state, states),
          lt(cardReviews.due, end),
          visibleTo(user),
          inScope,
        ),
      )
      .orderBy(asc(cardReviews.due))
      .$dynamic()
    return limit === undefined ? query : query.limit(limit)
  }

  const learning = await due(['learning', 'relearning'])
  const reviews = await due(['review'], Math.max(0, settings.reviewsPerDay - done.reviews))
  const fresh = await db
    .select(cardColumns)
    .from(cards)
    .innerJoin(sets, eq(sets.id, cards.setId))
    .leftJoin(cardReviews, and(eq(cardReviews.cardId, cards.id), eq(cardReviews.userId, user.id)))
    .where(and(isNull(cardReviews.cardId), inScope ?? eq(sets.ownerId, user.id), visibleTo(user)))
    .orderBy(asc(sets.createdAt), asc(cards.position))
    .limit(Math.max(0, settings.newCardsPerDay - done.newCards))

  const scheduler = createScheduler(settings.desiredRetention)
  return {
    cards: [
      ...[...learning, ...reviews].map(({ card, review }) =>
        toQueueCard(card, review, scheduler, now),
      ),
      ...fresh.map((card) => toQueueCard(card, undefined, scheduler, now)),
    ],
    counts: { learning: learning.length, review: reviews.length, new: fresh.length },
  }
}

/** Compteurs pour l'en-tête et l'accueil : cartes dues et nouvelles cartes du jour. */
export async function reviewSummary(db: Db, user: User, now: Date) {
  const { counts } = await buildQueue(db, user, now)
  return { due: counts.learning + counts.review, new: counts.new }
}

/**
 * Cartes d'un set déjà commencées et dues aujourd'hui, sans plafond (option « à revoir » du mode
 * écrit, qui ne modifie pas la planification).
 */
export async function dueCardIds(db: Db, user: User, now: Date, setId: string) {
  await findViewableSet(db, setId, user)
  const settings = await effectiveSettings(db, user)
  const { end } = await dayBounds(db, now, settings.timezone)
  const rows = await db
    .select({ id: cardReviews.cardId })
    .from(cardReviews)
    .innerJoin(cards, eq(cards.id, cardReviews.cardId))
    .where(
      and(
        eq(cardReviews.userId, user.id),
        eq(cards.setId, setId),
        ne(cardReviews.state, 'new'),
        lt(cardReviews.due, end),
      ),
    )
  return rows.map((row) => row.id)
}

/**
 * Note une carte (1 À revoir à 4 Facile) : nouvel état FSRS de la carte pour cet utilisateur et
 * entrée d'historique. La carte doit appartenir à un set visible (le sien, ou un set public).
 * `requeue` : la carte est encore due aujourd'hui (étape d'apprentissage), à revoir dans la séance.
 */
export async function gradeCard(db: Db, user: User, cardId: string, rating: Rating, now: Date) {
  const settings = await effectiveSettings(db, user)
  const scheduler = createScheduler(settings.desiredRetention)
  const { end } = await dayBounds(db, now, settings.timezone)

  return db.transaction(async (tx) => {
    const [found] = await tx
      .select({ card: cardColumns, ownerId: sets.ownerId, visibility: sets.visibility })
      .from(cards)
      .innerJoin(sets, eq(sets.id, cards.setId))
      .where(eq(cards.id, cardId))
    if (!found || decideAccess(found, user.id, 'view') !== 'allowed') {
      throw notFound('Carte introuvable.')
    }

    // Ligne créée si besoin (carte nouvelle), puis verrouillée : deux notes simultanées de la même
    // carte s'appliquent l'une après l'autre.
    const key = and(eq(cardReviews.userId, user.id), eq(cardReviews.cardId, cardId))
    await tx
      .insert(cardReviews)
      .values({ userId: user.id, cardId, ...fromFsrsCard(createEmptyCard(now)) })
      .onConflictDoNothing()
    const [current] = await tx.select().from(cardReviews).where(key).for('update')

    const { card: next, log } = scheduler.next(toFsrsCard(current, now), now, rating)
    const fields = fromFsrsCard(next)
    await tx.update(cardReviews).set(fields).where(key)
    await tx.insert(reviewLogs).values({ userId: user.id, cardId, ...fromFsrsLog(log) })

    const requeue = next.due < end
    return {
      state: fields.state,
      due: next.due,
      requeue,
      card: requeue ? toQueueCard(found.card, fields, scheduler, now) : null,
    }
  })
}
