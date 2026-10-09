import { afterAll, beforeEach } from 'vitest'
import { createDb } from '../db/client'
import { users } from '../db/schema'

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://quizlet:quizlet@127.0.0.1:5433/quizlet_test'

/** Garde-fou : les tests vident les tables, ils ne doivent jamais viser une autre base. */
export function assertTestDatabase(url: string): string {
  const name = decodeURIComponent(new URL(url).pathname.slice(1))
  if (!name.endsWith('_test')) {
    throw new Error(`Refus de lancer les tests sur « ${name} » : le nom doit finir par _test`)
  }
  return name
}

/**
 * Connexion à la base de test, vidée avant chaque test.
 * Supprimer les utilisateurs suffit : sets et cartes suivent par cascade.
 */
export function useTestDb() {
  assertTestDatabase(TEST_DATABASE_URL)
  const { db, close } = createDb(TEST_DATABASE_URL, { max: 3 })

  beforeEach(async () => {
    await db.delete(users)
  })

  afterAll(async () => {
    await close()
  })

  return db
}
