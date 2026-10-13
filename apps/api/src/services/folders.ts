import { and, asc, count, eq, sql } from 'drizzle-orm'
import type { Db, Executor } from '../db/client'
import { folders, sets, type User } from '../db/schema'
import { notFound } from '../errors'

const FOLDER_NOT_FOUND = 'Dossier introuvable.'

function ownedFolder(id: string, user: User) {
  return and(eq(folders.id, id), eq(folders.ownerId, user.id))
}

/** Dossiers de l'utilisateur et leur nombre de sets, par ordre alphabétique. */
export function listFolders(db: Db, user: User) {
  return db
    .select({ id: folders.id, name: folders.name, setCount: count(sets.id) })
    .from(folders)
    .leftJoin(sets, eq(sets.folderId, folders.id))
    .where(eq(folders.ownerId, user.id))
    .groupBy(folders.id)
    .orderBy(asc(sql`lower(${folders.name})`), asc(folders.createdAt))
}

export async function createFolder(db: Db, user: User, name: string) {
  const [folder] = await db
    .insert(folders)
    .values({ ownerId: user.id, name })
    .returning({ id: folders.id, name: folders.name })
  if (!folder) throw new Error('Insertion du dossier sans résultat')
  return { ...folder, setCount: 0 }
}

export async function renameFolder(db: Db, id: string, user: User, name: string) {
  const [folder] = await db
    .update(folders)
    .set({ name })
    .where(ownedFolder(id, user))
    .returning({ id: folders.id, name: folders.name })
  if (!folder) throw notFound(FOLDER_NOT_FOUND)
  return folder
}

/** Supprime un dossier de l'utilisateur ; ses sets repassent « sans dossier » (ON DELETE SET NULL). */
export async function deleteFolder(db: Db, id: string, user: User): Promise<void> {
  const deleted = await db
    .delete(folders)
    .where(ownedFolder(id, user))
    .returning({ id: folders.id })
  if (deleted.length === 0) throw notFound(FOLDER_NOT_FOUND)
}

/** Le dossier d'un autre utilisateur est introuvable (404), comme un set invisible. */
export async function assertOwnFolder(db: Executor, id: string, user: User): Promise<void> {
  const [folder] = await db.select({ id: folders.id }).from(folders).where(ownedFolder(id, user))
  if (!folder) throw notFound(FOLDER_NOT_FOUND)
}
