import { and, asc, count, eq, inArray, sql } from 'drizzle-orm'
import type { Db, Executor } from '../db/client'
import { setTags, tags, type User } from '../db/schema'
import { notFound } from '../errors'

export interface TagSummary {
  id: string
  name: string
}

const byName = asc(sql`lower(${tags.name})`)

/** Tags de l'utilisateur et leur nombre de sets, par ordre alphabétique. */
export function listTags(db: Db, user: User) {
  return db
    .select({ id: tags.id, name: tags.name, setCount: count(setTags.setId) })
    .from(tags)
    .leftJoin(setTags, eq(setTags.tagId, tags.id))
    .where(eq(tags.ownerId, user.id))
    .groupBy(tags.id)
    .orderBy(byName)
}

/** Supprime un tag de l'utilisateur ; il disparaît de ses sets (cascade). */
export async function deleteTag(db: Db, id: string, user: User): Promise<void> {
  const deleted = await db
    .delete(tags)
    .where(and(eq(tags.id, id), eq(tags.ownerId, user.id)))
    .returning({ id: tags.id })
  if (deleted.length === 0) throw notFound('Tag introuvable.')
}

/** Tags de chaque set demandé, par ordre alphabétique. */
export async function loadTagsBySet(
  db: Executor,
  setIds: string[],
): Promise<Map<string, TagSummary[]>> {
  const rows = await db
    .select({ setId: setTags.setId, id: tags.id, name: tags.name })
    .from(setTags)
    .innerJoin(tags, eq(tags.id, setTags.tagId))
    .where(inArray(setTags.setId, setIds))
    .orderBy(byName)
  const bySet = new Map<string, TagSummary[]>()
  for (const { setId, ...tag } of rows) {
    const list = bySet.get(setId)
    if (list) list.push(tag)
    else bySet.set(setId, [tag])
  }
  return bySet
}

/**
 * Remplace les tags d'un set par `names` : des tags de son auteur, créés s'ils n'existent pas.
 * Deux noms qui ne diffèrent que par la casse désignent le même tag.
 */
export async function replaceSetTags(
  tx: Executor,
  ownerId: string,
  setId: string,
  names: readonly string[],
): Promise<void> {
  await tx.delete(setTags).where(eq(setTags.setId, setId))
  const unique = names.filter(
    (name, index) => names.findIndex((other) => sameTag(other, name)) === index,
  )
  if (unique.length === 0) return

  // Conflit sur (owner_id, lower(name)) : le tag existe déjà, on garde son orthographe.
  await tx
    .insert(tags)
    .values(unique.map((name) => ({ ownerId, name })))
    .onConflictDoNothing()
  const found = await tx
    .select({ id: tags.id })
    .from(tags)
    .where(
      and(
        eq(tags.ownerId, ownerId),
        inArray(
          sql`lower(${tags.name})`,
          unique.map((name) => sql`lower(${name})`),
        ),
      ),
    )
  if (found.length > 0) {
    await tx.insert(setTags).values(found.map(({ id }) => ({ setId, tagId: id })))
  }
}

function sameTag(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase()
}
