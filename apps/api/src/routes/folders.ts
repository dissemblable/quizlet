import { folderInputSchema, idParamSchema } from '@quizlet/shared'
import { Hono } from 'hono'
import type { Db } from '../db/client'
import { createFolder, deleteFolder, listFolders, renameFolder } from '../services/folders'
import type { AppEnv } from '../types'
import { validate } from '../validation'

export function foldersRoutes(db: Db) {
  return new Hono<AppEnv>()
    .get('/', async (c) => {
      return c.json({ folders: await listFolders(db, c.get('user')) })
    })
    .post('/', validate('json', folderInputSchema), async (c) => {
      const folder = await createFolder(db, c.get('user'), c.req.valid('json').name)
      return c.json({ folder }, 201)
    })
    .patch(
      '/:id',
      validate('param', idParamSchema),
      validate('json', folderInputSchema),
      async (c) => {
        const { id } = c.req.valid('param')
        const folder = await renameFolder(db, id, c.get('user'), c.req.valid('json').name)
        return c.json({ folder })
      },
    )
    .delete('/:id', validate('param', idParamSchema), async (c) => {
      await deleteFolder(db, c.req.valid('param').id, c.get('user'))
      return c.body(null, 204)
    })
}
