import { idParamSchema } from '@quizlet/shared'
import { Hono } from 'hono'
import type { Db } from '../db/client'
import { deleteTag, listTags } from '../services/tags'
import type { AppEnv } from '../types'
import { validate } from '../validation'

/** Les tags se créent à la volée dans l'éditeur de set (champ `tags` du set). */
export function tagsRoutes(db: Db) {
  return new Hono<AppEnv>()
    .get('/', async (c) => {
      return c.json({ tags: await listTags(db, c.get('user')) })
    })
    .delete('/:id', validate('param', idParamSchema), async (c) => {
      await deleteTag(db, c.req.valid('param').id, c.get('user'))
      return c.body(null, 204)
    })
}
