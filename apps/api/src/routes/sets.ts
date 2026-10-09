import { setIdParamSchema, setInputSchema } from '@quizlet/shared'
import { Hono } from 'hono'
import type { Db } from '../db/client'
import { createSet, deleteSet, duplicateSet, getSet, updateSet } from '../services/sets'
import type { AppEnv } from '../types'
import { validate } from '../validation'

export function setsRoutes(db: Db) {
  return new Hono<AppEnv>()
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
    .post('/:id/duplicate', validate('param', setIdParamSchema), async (c) => {
      const set = await duplicateSet(db, c.req.valid('param').id, c.get('user'))
      return c.json({ set }, 201)
    })
}
