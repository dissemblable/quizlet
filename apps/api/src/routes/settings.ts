import { settingsSchema } from '@quizlet/shared'
import { Hono } from 'hono'
import type { Db } from '../db/client'
import { getSettings, saveSettings } from '../services/settings'
import type { AppEnv } from '../types'
import { validate } from '../validation'

/** Paramètres de révision de l'utilisateur courant (aucun accès à ceux d'un autre). */
export function settingsRoutes(db: Db) {
  return new Hono<AppEnv>()
    .get('/', async (c) => {
      return c.json({ settings: await getSettings(db, c.get('user')) })
    })
    .put('/', validate('json', settingsSchema), async (c) => {
      return c.json({ settings: await saveSettings(db, c.get('user'), c.req.valid('json')) })
    })
}
