import { serve } from '@hono/node-server'
import { createApp } from './app'
import { createDb } from './db/client'
import { runMigrations } from './db/migrate'
import { loadConfigOrExit } from './env'

const config = loadConfigOrExit()
const { db, close } = createDb(config.databaseUrl)

if (config.migrateOnStart) {
  await runMigrations(db)
  console.log('Migrations appliquées')
}

const app = createApp()

const server = serve({ fetch: app.fetch, hostname: config.host, port: config.port }, (info) => {
  console.log(`API à l'écoute sur http://${info.address}:${info.port} (${config.nodeEnv})`)
})

function shutdown(signal: string) {
  console.log(`${signal} reçu, arrêt de l'API`)
  server.close(() => {
    close().finally(() => process.exit(0))
  })
}
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
