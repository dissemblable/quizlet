import { Hono } from 'hono'

export function createApp() {
  return new Hono().basePath('/api').get('/health', (c) => c.json({ status: 'ok' as const }))
}

/** Type de l'API consommé par le client RPC du front (`hc<AppType>`). */
export type AppType = ReturnType<typeof createApp>
