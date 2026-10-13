import {
  COPY_SUFFIX,
  LIBRARY_PAGE_SIZE,
  LIMITS,
  type setInputSchema,
  type setsQuerySchema,
  type Visibility,
} from '@quizlet/shared'
import {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  ilike,
  isNull,
  notInArray,
  type SQL,
  sql,
} from 'drizzle-orm'
import type { z } from 'zod'
import type { Db, Executor, Tx } from '../db/client'
import { cards, type SetRow, sets, setTags, type User, users } from '../db/schema'
import { decideAccess } from '../domain/permissions'
import { forbidden, notFound } from '../errors'
import { assertOwnFolder } from './folders'
import { loadTagsBySet, replaceSetTags, type TagSummary } from './tags'

export type SetData = z.output<typeof setInputSchema>
export type SetsQuery = z.output<typeof setsQuerySchema>

export interface CardDetail {
  id: string
  term: string
  definition: string
}

export interface SetDetail {
  id: string
  title: string
  description: string | null
  visibility: Visibility
  createdAt: Date
  updatedAt: Date
  owner: { displayName: string }
  /** Calculé côté serveur : le front s'en sert pour afficher (ou non) les actions d'édition. */
  isOwner: boolean
  /** Rangement personnel de l'auteur : `null` et `[]` pour tout autre lecteur. */
  folderId: string | null
  tags: TagSummary[]
  cards: CardDetail[]
}

export async function findSet(db: Executor, id: string, { lock = false } = {}) {
  const query = db
    .select({ set: sets, ownerName: users.displayName })
    .from(sets)
    .innerJoin(users, eq(users.id, sets.ownerId))
    .where(eq(sets.id, id))
  // FOR UPDATE : deux enregistrements simultanés du même set s'exécutent l'un après l'autre.
  const [row] = lock ? await query.for('update', { of: sets }) : await query
  return row
}

/** Point de passage obligé : 404 si le set est invisible pour l'utilisateur, 403 s'il est en lecture seule. */
export function assertAccess(
  row: { set: SetRow; ownerName: string } | undefined,
  user: User,
  action: 'view' | 'edit',
): asserts row is { set: SetRow; ownerName: string } {
  const decision = decideAccess(row?.set, user.id, action)
  if (decision === 'not-found') throw notFound('Set introuvable.')
  if (decision === 'forbidden') throw forbidden("Seul l'auteur de ce set peut le modifier.")
}

export function loadCards(db: Executor, setId: string): Promise<CardDetail[]> {
  return db
    .select({ id: cards.id, term: cards.term, definition: cards.definition })
    .from(cards)
    .where(eq(cards.setId, setId))
    .orderBy(asc(cards.position))
}

/** Ajoute des cartes en fin de set, à partir de la position `start`. */
export async function insertCards(
  db: Executor,
  setId: string,
  list: ReadonlyArray<{ term: string; definition: string }>,
  start = 0,
) {
  if (list.length === 0) return
  await db.insert(cards).values(
    list.map(({ term, definition }, index) => ({
      setId,
      term,
      definition,
      position: start + index,
    })),
  )
}

/** Détail d'un set ; les tags ne sont chargés que pour son auteur. */
async function toDetail(db: Executor, set: SetRow, ownerName: string, user: User) {
  const isOwner = set.ownerId === user.id
  const tags = isOwner ? ((await loadTagsBySet(db, [set.id])).get(set.id) ?? []) : []
  return {
    id: set.id,
    title: set.title,
    description: set.description,
    visibility: set.visibility,
    createdAt: set.createdAt,
    updatedAt: set.updatedAt,
    owner: { displayName: ownerName },
    isOwner,
    folderId: isOwner ? set.folderId : null,
    tags,
    cards: await loadCards(db, set.id),
  } satisfies SetDetail
}

/** Échappe les jokers de LIKE : « 100% » cherche littéralement « 100% ». */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`)
}

/**
 * Bibliothèque : les sets de l'utilisateur, filtrés (recherche, dossier, tags) et paginés, du plus
 * récemment modifié au plus ancien.
 */
export async function listSets(db: Db, user: User, query: SetsQuery = {}) {
  const filters: SQL[] = [eq(sets.ownerId, user.id)]
  if (query.q) filters.push(ilike(sets.title, `%${escapeLike(query.q)}%`))
  if (query.folder === 'none') filters.push(isNull(sets.folderId))
  else if (query.folder) filters.push(eq(sets.folderId, query.folder))
  // Plusieurs tags : le set doit les porter tous.
  for (const tagId of query.tags ?? []) {
    filters.push(
      exists(
        db
          .select({ tagId: setTags.tagId })
          .from(setTags)
          .where(and(eq(setTags.setId, sets.id), eq(setTags.tagId, tagId))),
      ),
    )
  }
  const where = and(...filters)
  const page = query.page ?? 1

  const [{ total } = { total: 0 }] = await db.select({ total: count() }).from(sets).where(where)
  const rows = await db
    .select({
      id: sets.id,
      title: sets.title,
      description: sets.description,
      visibility: sets.visibility,
      folderId: sets.folderId,
      updatedAt: sets.updatedAt,
      cardCount: count(cards.id),
    })
    .from(sets)
    .leftJoin(cards, eq(cards.setId, sets.id))
    .where(where)
    .groupBy(sets.id)
    .orderBy(desc(sets.updatedAt), asc(sets.title), asc(sets.id))
    .limit(LIBRARY_PAGE_SIZE)
    .offset((page - 1) * LIBRARY_PAGE_SIZE)
  const tagsBySet = await loadTagsBySet(
    db,
    rows.map((row) => row.id),
  )

  return {
    sets: rows.map((row) => ({ ...row, tags: tagsBySet.get(row.id) ?? [] })),
    total,
    page,
    pageSize: LIBRARY_PAGE_SIZE,
  }
}

/** Charge un set lisible par l'utilisateur (auteur, ou set public). */
export async function findViewableSet(db: Executor, id: string, user: User) {
  const row = await findSet(db, id)
  assertAccess(row, user, 'view')
  return row.set
}

export async function getSet(db: Db, id: string, user: User): Promise<SetDetail> {
  const row = await findSet(db, id)
  assertAccess(row, user, 'view')
  return toDetail(db, row.set, row.ownerName, user)
}

export function createSet(db: Db, user: User, data: SetData): Promise<SetDetail> {
  return db.transaction(async (tx) => {
    const [set] = await tx
      .insert(sets)
      .values({
        ownerId: user.id,
        title: data.title,
        description: data.description,
        visibility: data.visibility,
      })
      .returning()
    if (!set) throw new Error('Insertion du set sans résultat')
    await insertCards(tx, set.id, data.cards)
    if (data.tags) await replaceSetTags(tx, user.id, set.id, data.tags)
    return toDetail(tx, set, user.displayName, user)
  })
}

/**
 * Remplace la liste ordonnée des cartes d'un set. Une carte dont l'identifiant appartient déjà à
 * ce set est modifiée sur place : elle garde son identifiant, donc sa progression de révision.
 * Tout autre identifiant (inconnu, ou carte d'un autre set) est ignoré et la carte est créée comme
 * nouvelle. Aucune carte d'un autre set n'est jamais touchée.
 */
async function replaceCards(tx: Tx, setId: string, list: SetData['cards']) {
  const existing = await tx.select({ id: cards.id }).from(cards).where(eq(cards.setId, setId))
  const existingIds = new Set(existing.map((card) => card.id))

  const kept = new Set<string>()
  const rows = list.map(({ id, term, definition }, position) => {
    if (id === undefined || !existingIds.has(id) || kept.has(id)) {
      return { setId, term, definition, position }
    }
    kept.add(id)
    return { id, setId, term, definition, position }
  })

  // Cartes retirées de la liste : supprimées, avec leur progression (cascade).
  await tx.delete(cards).where(and(eq(cards.setId, setId), notInArray(cards.id, [...kept])))
  if (rows.length === 0) return

  await tx
    .insert(cards)
    .values(rows)
    .onConflictDoUpdate({
      target: cards.id,
      set: {
        term: sql`excluded.term`,
        definition: sql`excluded.definition`,
        position: sql`excluded.position`,
        updatedAt: sql`now()`,
      },
      // Jamais une carte d'un autre set ; pas d'écriture si la carte n'a pas changé.
      setWhere: sql`${cards.setId} = ${setId} AND (${cards.term}, ${cards.definition}, ${cards.position}) IS DISTINCT FROM (excluded.term, excluded.definition, excluded.position)`,
    })
}

export function updateSet(db: Db, id: string, user: User, data: SetData): Promise<SetDetail> {
  return db.transaction(async (tx) => {
    const row = await findSet(tx, id, { lock: true })
    assertAccess(row, user, 'edit')
    const [set] = await tx
      .update(sets)
      .set({ title: data.title, description: data.description, visibility: data.visibility })
      .where(eq(sets.id, id))
      .returning()
    if (!set) throw new Error('Mise à jour du set sans résultat')
    await replaceCards(tx, id, data.cards)
    if (data.tags) await replaceSetTags(tx, user.id, id, data.tags)
    return toDetail(tx, set, row.ownerName, user)
  })
}

export function deleteSet(db: Db, id: string, user: User): Promise<void> {
  return db.transaction(async (tx) => {
    const row = await findSet(tx, id, { lock: true })
    assertAccess(row, user, 'edit')
    await tx.delete(sets).where(eq(sets.id, id))
  })
}

/** Range un set de l'utilisateur dans l'un de ses dossiers, ou l'en sort (`null`). */
export function moveSet(db: Db, id: string, user: User, folderId: string | null): Promise<void> {
  return db.transaction(async (tx) => {
    const row = await findSet(tx, id, { lock: true })
    assertAccess(row, user, 'edit')
    if (folderId) await assertOwnFolder(tx, folderId, user)
    // Ranger un set ne le modifie pas : sa date de modification reste la même.
    await tx.update(sets).set({ folderId, updatedAt: row.set.updatedAt }).where(eq(sets.id, id))
  })
}

/** Tronque sans couper un caractère hors BMP (emoji) en deux. */
function truncate(text: string, maxLength: number): string {
  let result = ''
  for (const char of text) {
    if (result.length + char.length > maxLength) break
    result += char
  }
  return result
}

export function copyTitle(title: string): string {
  return `${truncate(title, LIMITS.title - COPY_SUFFIX.length).trimEnd()}${COPY_SUFFIX}`
}

/**
 * Copie privée d'un set lisible (le sien, ou un set public) dans la bibliothèque de l'utilisateur.
 * La copie part de zéro : nouvelles cartes (donc aucune progression), ni dossier ni tags.
 */
export function duplicateSet(db: Db, id: string, user: User): Promise<SetDetail> {
  return db.transaction(async (tx) => {
    const row = await findSet(tx, id)
    assertAccess(row, user, 'view')
    const [copy] = await tx
      .insert(sets)
      .values({
        ownerId: user.id,
        title: copyTitle(row.set.title),
        description: row.set.description,
        visibility: 'private',
      })
      .returning()
    if (!copy) throw new Error('Insertion de la copie sans résultat')
    await insertCards(tx, copy.id, await loadCards(tx, id))
    return toDetail(tx, copy, user.displayName, user)
  })
}
