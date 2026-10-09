import { resolve } from 'node:path'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import type { Db } from './client'

/**
 * Dossier des migrations SQL générées par drizzle-kit. Relatif au répertoire courant
 * (`apps/api` en dev, `/app` dans l'image Docker), surchargeable par MIGRATIONS_DIR.
 */
export function migrationsDir(): string {
  return resolve(process.env.MIGRATIONS_DIR ?? 'drizzle')
}

export async function runMigrations(db: Db): Promise<void> {
  await migrate(db, { migrationsFolder: migrationsDir() })
}
