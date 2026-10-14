import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { sql } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { assertTestDatabase, TEST_DATABASE_URL } from '../test/test-db'
import { createDb } from './client'
import { migrationsDir } from './migrate'

// Base dédiée : on y rejoue l'historique (la V1 et ses données, puis les migrations suivantes).
const url = new URL(TEST_DATABASE_URL)
url.pathname = '/quizlet_migrate_test'
const dbName = assertTestDatabase(url.toString())
const adminUrl = new URL(TEST_DATABASE_URL)
adminUrl.pathname = '/postgres'

const admin = postgres(adminUrl.toString(), { max: 1, onnotice: () => {} })
let tempDir = ''

/** Copie des migrations limitée à la première (0000_init) : l'état d'une base V1. */
function v1MigrationsFolder(): string {
  tempDir = mkdtempSync(join(tmpdir(), 'quizlet-migrations-'))
  cpSync(migrationsDir(), tempDir, { recursive: true })
  const journalPath = join(tempDir, 'meta', '_journal.json')
  const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as { entries: unknown[] }
  journal.entries = journal.entries.slice(0, 1)
  writeFileSync(journalPath, JSON.stringify(journal))
  return tempDir
}

beforeAll(async () => {
  await admin`DROP DATABASE IF EXISTS ${admin(dbName)}`
  await admin`CREATE DATABASE ${admin(dbName)}`
})

afterAll(async () => {
  await admin`DROP DATABASE IF EXISTS ${admin(dbName)}`
  await admin.end({ timeout: 5 })
  if (tempDir) rmSync(tempDir, { recursive: true, force: true })
})

describe('migrations', () => {
  it('appliquent la V2 sur une base V1 sans perdre ses données', async () => {
    const { db, close } = createDb(url.toString(), { max: 1 })
    try {
      await migrate(db, { migrationsFolder: v1MigrationsFolder() })
      // Données V1 insérées en SQL : le schéma Drizzle courant décrit déjà la V2.
      await db.execute(sql`
        WITH u AS (
          INSERT INTO users (username, display_name) VALUES ('alice', 'Alice') RETURNING id
        ), s AS (
          INSERT INTO sets (owner_id, title, visibility)
          SELECT id, 'Capitales', 'public' FROM u RETURNING id
        )
        INSERT INTO cards (set_id, term, definition, position)
        SELECT s.id, v.term, v.definition, v.position
        FROM s, (VALUES ('France', 'Paris', 0), ('Italie', 'Rome', 1)) AS v(term, definition, position)
      `)

      await migrate(db, { migrationsFolder: migrationsDir() })

      const [set] = await db.execute<{ title: string; visibility: string; folder_id: null }>(
        sql`SELECT title, visibility, folder_id FROM sets`,
      )
      expect(set).toEqual({ title: 'Capitales', visibility: 'public', folder_id: null })
      const terms = await db.execute<{ term: string }>(
        sql`SELECT term FROM cards ORDER BY position`,
      )
      expect(terms.map((row) => row.term)).toEqual(['France', 'Italie'])
      const [counts] = await db.execute<{ reviews: number; folders: number; settings: number }>(
        sql`SELECT (SELECT count(*)::int FROM card_reviews) AS reviews,
                   (SELECT count(*)::int FROM folders) AS folders,
                   (SELECT count(*)::int FROM user_settings) AS settings`,
      )
      expect(counts).toEqual({ reviews: 0, folders: 0, settings: 0 })
    } finally {
      await close()
    }
  })
})
