import { type ImportSeparators, LIMITS, MESSAGES, parseCards } from '@quizlet/shared'
import { count, eq, max, sql } from 'drizzle-orm'
import type { Db } from '../db/client'
import { cards, sets, type User } from '../db/schema'
import { ApiError } from '../errors'
import { assertAccess, findSet, insertCards } from './sets'

interface ImportSource {
  text: string
  separators: ImportSeparators
}

export interface ImportResult {
  set: { id: string }
  imported: number
  /** Lignes non vides ignorées (terme ou définition vide, ou trop long). */
  skipped: number
}

function tooMany(existing: number, incoming: number) {
  return new ApiError(400, 'VALIDATION_ERROR', MESSAGES.tooManyCards, { existing, incoming })
}

/** Découpe le texte côté serveur : le parsing du client (aperçu) n'est jamais repris tel quel. */
function parse({ text, separators }: ImportSource) {
  const { cards: parsed, invalid } = parseCards(text, separators)
  if (parsed.length === 0) throw new ApiError(400, 'VALIDATION_ERROR', MESSAGES.noCardToImport)
  return { parsed, skipped: invalid.length }
}

/** Crée un set privé contenant les cartes importées, en une transaction. */
export function importIntoNewSet(
  db: Db,
  user: User,
  input: ImportSource & { title: string },
): Promise<ImportResult> {
  const { parsed, skipped } = parse(input)
  if (parsed.length > LIMITS.cards) throw tooMany(0, parsed.length)
  return db.transaction(async (tx) => {
    const [set] = await tx
      .insert(sets)
      .values({ ownerId: user.id, title: input.title, visibility: 'private' })
      .returning({ id: sets.id })
    if (!set) throw new Error('Insertion du set sans résultat')
    await insertCards(tx, set.id, parsed)
    return { set, imported: parsed.length, skipped }
  })
}

/** Ajoute les cartes importées à la fin d'un set de l'utilisateur, en une transaction. */
export function importIntoSet(
  db: Db,
  user: User,
  setId: string,
  input: ImportSource,
): Promise<ImportResult> {
  const { parsed, skipped } = parse(input)
  return db.transaction(async (tx) => {
    // Même règle que la modification : 404 pour un set privé d'autrui, 403 pour un set public.
    const row = await findSet(tx, setId, { lock: true })
    assertAccess(row, user, 'edit')
    const [stats] = await tx
      .select({ existing: count(), last: max(cards.position) })
      .from(cards)
      .where(eq(cards.setId, setId))
    const existing = stats?.existing ?? 0
    if (existing + parsed.length > LIMITS.cards) throw tooMany(existing, parsed.length)

    await insertCards(tx, setId, parsed, (stats?.last ?? -1) + 1)
    await tx.update(sets).set({ updatedAt: sql`now()` }).where(eq(sets.id, setId))
    return { set: { id: setId }, imported: parsed.length, skipped }
  })
}
