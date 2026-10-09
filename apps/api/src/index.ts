import { serve } from '@hono/node-server'
import { createApp } from './app'

const app = createApp()

serve({ fetch: app.fetch, hostname: '127.0.0.1', port: 3000 }, (info) => {
  console.log(`API à l'écoute sur http://${info.address}:${info.port}`)
})
