import { Hono } from 'hono'
import type { AppEnv } from '../types'

export function meRoutes(logoutUrl: string | null, aiEnabled: boolean) {
  return new Hono<AppEnv>().get('/', (c) => {
    const { id, username, displayName, email } = c.get('user')
    return c.json({ user: { id, username, displayName, email }, logoutUrl, aiEnabled })
  })
}
