import {
  cardIdParamSchema,
  dueCardsQuerySchema,
  gradeSchema,
  reviewQueueQuerySchema,
} from '@quizlet/shared'
import { Hono } from 'hono'
import type { Db } from '../db/client'
import { buildQueue, dueCardIds, gradeCard, reviewSummary } from '../services/review'
import type { AppEnv } from '../types'
import { validate } from '../validation'

/** Répétition espacée (FSRS). `now` : horloge, remplaçable dans les tests. */
export function reviewRoutes(db: Db, now: () => Date) {
  return new Hono<AppEnv>()
    .get('/summary', async (c) => {
      return c.json(await reviewSummary(db, c.get('user'), now()))
    })
    .get('/queue', validate('query', reviewQueueQuerySchema), async (c) => {
      return c.json(await buildQueue(db, c.get('user'), now(), c.req.valid('query').setId))
    })
    .get('/due', validate('query', dueCardsQuerySchema), async (c) => {
      const cardIds = await dueCardIds(db, c.get('user'), now(), c.req.valid('query').setId)
      return c.json({ cardIds })
    })
    .post(
      '/cards/:cardId',
      validate('param', cardIdParamSchema),
      validate('json', gradeSchema),
      async (c) => {
        const { cardId } = c.req.valid('param')
        const { rating } = c.req.valid('json')
        return c.json(await gradeCard(db, c.get('user'), cardId, rating, now()))
      },
    )
}
