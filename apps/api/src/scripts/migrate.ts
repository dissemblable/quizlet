import { createDb } from '../db/client'
import { migrationsDir, runMigrations } from '../db/migrate'
import { loadConfigOrExit } from '../env'

const config = loadConfigOrExit()
const { db, close } = createDb(config.databaseUrl, { max: 1 })

try {
  await runMigrations(db)
  console.log(`Migrations appliquées depuis ${migrationsDir()}`)
} finally {
  await close()
}
