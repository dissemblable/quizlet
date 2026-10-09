import postgres from 'postgres'
import { createDb } from '../db/client'
import { runMigrations } from '../db/migrate'
import { assertTestDatabase, TEST_DATABASE_URL } from './test-db'

/** Crée la base de test si besoin (volume Docker antérieur au script d'init) puis la migre. */
export default async function setup() {
  const dbName = assertTestDatabase(TEST_DATABASE_URL)
  const adminUrl = new URL(TEST_DATABASE_URL)
  adminUrl.pathname = '/postgres'

  const admin = postgres(adminUrl.toString(), { max: 1, onnotice: () => {} })
  try {
    const existing = await admin`SELECT 1 FROM pg_database WHERE datname = ${dbName}`
    if (existing.length === 0) {
      await admin`CREATE DATABASE ${admin(dbName)}`
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    throw new Error(
      `Postgres de test injoignable sur ${adminUrl.host} : lance « docker compose up -d db ». (${reason})`,
    )
  } finally {
    await admin.end({ timeout: 5 })
  }

  const { db, close } = createDb(TEST_DATABASE_URL, { max: 1 })
  try {
    await runMigrations(db)
  } finally {
    await close()
  }
}
