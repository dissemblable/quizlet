import { moveSetSchema, setIdParamSchema, setInputSchema, setsQuerySchema } from '@quizlet/shared'
import { Hono } from 'hono'
import type { Db } from '../db/client'
import { getQuiz } from '../services/quiz'
import {
  createSet,
  deleteSet,
  duplicateSet,
  getSet,
  listSets,
  moveSet,
  updateSet,
} from '../services/sets'
import type { AppEnv } from '../types'
import { validate } from '../validation'

export function setsRoutes(db: Db) {
  return new Hono<AppEnv>()
    .get('/', validate('query', setsQuerySchema), async (c) => {
      return c.json(await listSets(db, c.get('user'), c.req.valid('query')))
    })
    .post('/', validate('json', setInputSchema), async (c) => {
      const set = await createSet(db, c.get('user'), c.req.valid('json'))
      return c.json({ set }, 201)
    })
    .get('/:id', validate('param', setIdParamSchema), async (c) => {
      const set = await getSet(db, c.req.valid('param').id, c.get('user'))
      return c.json({ set })
    })
    .put(
      '/:id',
      validate('param', setIdParamSchema),
      validate('json', setInputSchema),
      async (c) => {
        const set = await updateSet(db, c.req.valid('param').id, c.get('user'), c.req.valid('json'))
        return c.json({ set })
      },
    )
    .delete('/:id', validate('param', setIdParamSchema), async (c) => {
      await deleteSet(db, c.req.valid('param').id, c.get('user'))
      return c.body(null, 204)
    })
    .put(
      '/:id/folder',
      validate('param', setIdParamSchema),
      validate('json', moveSetSchema),
      async (c) => {
        const { folderId } = c.req.valid('json')
        await moveSet(db, c.req.valid('param').id, c.get('user'), folderId)
        return c.body(null, 204)
      },
    )
    .post('/:id/duplicate', validate('param', setIdParamSchema), async (c) => {
      const set = await duplicateSet(db, c.req.valid('param').id, c.get('user'))
      return c.json({ set }, 201)
    })
    .get('/:id/quiz', validate('param', setIdParamSchema), async (c) => {
      const questions = await getQuiz(db, c.req.valid('param').id, c.get('user'))
      return c.json({ questions })
    })
}
