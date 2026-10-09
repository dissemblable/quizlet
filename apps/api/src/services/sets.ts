import { COPY_SUFFIX, LIMITS, type setInputSchema, type Visibility } from '@quizlet/shared'
import { asc, eq } from 'drizzle-orm'
import type { z } from 'zod'
import type { Db } from '../db/client'
import { cards, type SetRow, sets, type User, users } from '../db/schema'
import { decideAccess } from '../domain/permissions'
import { forbidden, notFound } from '../errors'

export type SetData = z.output<typeof setInputSchema>
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]
type Executor = Db | Tx

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
  cards: CardDetail[]
}

async function findSet(db: Executor, id: string, { lock = false } = {}) {
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
function assertAccess(
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

async function insertCards(
  db: Executor,
  setId: string,
  list: ReadonlyArray<{ term: string; definition: string }>,
) {
  if (list.length === 0) return
  await db
    .insert(cards)
    .values(list.map(({ term, definition }, position) => ({ setId, term, definition, position })))
}

function toDetail(set: SetRow, ownerName: string, list: CardDetail[], user: User): SetDetail {
  return {
    id: set.id,
    title: set.title,
    description: set.description,
    visibility: set.visibility,
    createdAt: set.createdAt,
    updatedAt: set.updatedAt,
    owner: { displayName: ownerName },
    isOwner: set.ownerId === user.id,
    cards: list,
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
  return toDetail(row.set, row.ownerName, await loadCards(db, id), user)
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
    return toDetail(set, user.displayName, await loadCards(tx, set.id), user)
  })
}

/**
 * Remplace la liste ordonnée des cartes d'un set. Une carte dont l'identifiant appartient déjà à
 * ce set garde son identifiant ; tout autre identifiant (inconnu, ou carte d'un autre set) est
 * ignoré et la carte est créée comme nouvelle. Aucune carte d'un autre set n'est jamais touchée.
 */
async function replaceCards(tx: Tx, setId: string, list: SetData['cards']) {
  const existing = await tx
    .select({ id: cards.id, createdAt: cards.createdAt })
    .from(cards)
    .where(eq(cards.setId, setId))
  const createdAtById = new Map(existing.map((card) => [card.id, card.createdAt]))

  await tx.delete(cards).where(eq(cards.setId, setId))
  if (list.length === 0) return

  const kept = new Set<string>()
  await tx.insert(cards).values(
    list.map(({ id, term, definition }, position) => {
      const createdAt = id === undefined || kept.has(id) ? undefined : createdAtById.get(id)
      if (id === undefined || createdAt === undefined) return { setId, term, definition, position }
      kept.add(id)
      return { id, createdAt, setId, term, definition, position }
    }),
  )
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
    return toDetail(set, row.ownerName, await loadCards(tx, id), user)
  })
}

export function deleteSet(db: Db, id: string, user: User): Promise<void> {
  return db.transaction(async (tx) => {
    const row = await findSet(tx, id, { lock: true })
    assertAccess(row, user, 'edit')
    await tx.delete(sets).where(eq(sets.id, id))
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

/** Copie privée d'un set lisible (le sien, ou un set public) dans la bibliothèque de l'utilisateur. */
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
    return toDetail(copy, user.displayName, await loadCards(tx, copy.id), user)
  })
}
