import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

export function createDb(url: string, options: { max?: number } = {}) {
  const client = postgres(url, { max: options.max ?? 10, onnotice: () => {} })
  const db = drizzle({ client, schema })
  return { db, close: () => client.end({ timeout: 5 }) }
}

export type Db = ReturnType<typeof createDb>['db']
/** Transaction ouverte par `db.transaction` ; `Executor` désigne l'une ou l'autre. */
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]
export type Executor = Db | Tx
