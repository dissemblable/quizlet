import { createDb } from '../db/client'
import { seedDemoData } from '../db/seed'
import { loadConfigOrExit } from '../env'

const config = loadConfigOrExit()

if (config.nodeEnv === 'production') {
  console.error('db:seed est réservé au développement : refus de remplir une base de production.')
  process.exit(1)
}

const { db, close } = createDb(config.databaseUrl, { max: 1 })

try {
  const { user, setCount } = await seedDemoData(db)
  console.log(`Seed terminé : utilisateur « ${user.username} » et ${setCount} sets d'exemple.`)
} finally {
  await close()
}
