import { eq, sql } from 'drizzle-orm'
import type { Db } from '../db/client'
import { type User, users } from '../db/schema'
import type { Identity } from '../middleware/identity'

/**
 * Crée l'utilisateur à sa première requête, ou met à jour son email et son nom s'ils ont changé
 * côté SSO. `username` reste l'identifiant stable.
 */
export async function upsertUser(db: Db, identity: Identity): Promise<User> {
  const values = {
    username: identity.username,
    email: identity.email,
    displayName: identity.displayName,
  }
  const [written] = await db
    .insert(users)
    .values(values)
    .onConflictDoUpdate({
      target: users.username,
      set: { email: values.email, displayName: values.displayName, updatedAt: sql`now()` },
      // Pas d'écriture si rien n'a changé (RETURNING est alors vide).
      setWhere: sql`${users.email} IS DISTINCT FROM excluded.email OR ${users.displayName} IS DISTINCT FROM excluded.display_name`,
    })
    .returning()
  if (written) return written

  const [existing] = await db.select().from(users).where(eq(users.username, values.username))
  if (!existing) throw new Error(`Utilisateur « ${values.username} » introuvable après upsert`)
  return existing
}

interface ResolverOptions {
  ttlMs?: number
  maxEntries?: number
  now?: () => number
}

/**
 * Upsert avec un petit cache mémoire, pour éviter une requête SQL à chaque appel d'API.
 * La clé inclut l'email et le nom : un changement côté SSO déclenche aussitôt une mise à jour.
 */
export function createUserResolver(db: Db, options: ResolverOptions = {}) {
  const { ttlMs = 5 * 60_000, maxEntries = 500, now = Date.now } = options
  const cache = new Map<string, { user: User; expiresAt: number }>()

  return async (identity: Identity): Promise<User> => {
    const key = JSON.stringify([identity.username, identity.email, identity.displayName])
    const hit = cache.get(key)
    if (hit && hit.expiresAt > now()) return hit.user

    const user = await upsertUser(db, identity)
    cache.delete(key)
    if (cache.size >= maxEntries) {
      const oldest = cache.keys().next().value
      if (oldest !== undefined) cache.delete(oldest)
    }
    cache.set(key, { user, expiresAt: now() + ttlMs })
    return user
  }
}
