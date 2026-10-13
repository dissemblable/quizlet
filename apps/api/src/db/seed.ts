import { DEFAULT_SETTINGS, type Rating } from '@quizlet/shared'
import { eq } from 'drizzle-orm'
import { createScheduler, fromFsrsCard, fromFsrsLog, toFsrsCard } from '../domain/scheduler'
import { replaceSetTags } from '../services/tags'
import type { Db, Tx } from './client'
import { cardReviews, cards, folders, reviewLogs, sets, tags, userSettings, users } from './schema'

/** Identité de démo : identique à celle du mode d'authentification de dev (DEV_AUTH_USER=demo). */
export const DEMO_USER = {
  username: 'demo',
  displayName: 'Utilisateur Démo',
  email: 'demo@example.com',
} as const

interface DemoSet {
  title: string
  description: string
  visibility: 'private' | 'public'
  folder?: string
  tags: readonly string[]
  cards: ReadonlyArray<readonly [term: string, definition: string]>
}

export const DEMO_SETS: readonly DemoSet[] = [
  {
    title: 'Capitales européennes',
    description: 'Associer chaque pays à sa capitale.',
    visibility: 'public',
    tags: ['géographie', 'europe'],
    cards: [
      ['France', 'Paris'],
      ['Allemagne', 'Berlin'],
      ['Espagne', 'Madrid'],
      ['Italie', 'Rome'],
      ['Portugal', 'Lisbonne'],
      ['Belgique', 'Bruxelles'],
      ['Pays-Bas', 'Amsterdam'],
      ['Autriche', 'Vienne'],
      ['Pologne', 'Varsovie'],
      ['Grèce', 'Athènes'],
      ['Suède', 'Stockholm'],
      ['Irlande', 'Dublin'],
    ],
  },
  {
    title: 'Anglais : la cuisine',
    description: 'Vocabulaire anglais des ustensiles et des gestes en cuisine.',
    visibility: 'private',
    folder: 'Langues',
    tags: ['anglais', 'vocabulaire'],
    cards: [
      ['a knife', 'un couteau'],
      ['a spoon', 'une cuillère'],
      ['a fork', 'une fourchette'],
      ['a frying pan', 'une poêle'],
      ['a saucepan', 'une casserole'],
      ['an oven', 'un four'],
      ['a cutting board', 'une planche à découper'],
      ['to boil', 'faire bouillir'],
      ['to bake', 'cuire au four'],
      ['to peel', 'éplucher'],
    ],
  },
  {
    title: 'Chimie : symboles des éléments',
    description: 'Les symboles chimiques les plus courants.',
    visibility: 'private',
    folder: 'Sciences',
    tags: ['chimie'],
    cards: [
      ['H', 'Hydrogène'],
      ['He', 'Hélium'],
      ['C', 'Carbone'],
      ['N', 'Azote'],
      ['O', 'Oxygène'],
      ['Na', 'Sodium'],
      ['K', 'Potassium'],
      ['Fe', 'Fer'],
      ['Ag', 'Argent'],
      ['Au', 'Or'],
    ],
  },
]

/**
 * Crée (ou recrée) l'utilisateur de démo, ses dossiers, ses tags, ses sets d'exemple et une
 * progression de révision sur le premier set.
 * Idempotent : les sets, dossiers et tags existants de l'utilisateur de démo sont remplacés.
 */
export async function seedDemoData(db: Db, now = new Date()) {
  return db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values(DEMO_USER)
      .onConflictDoUpdate({
        target: users.username,
        set: { displayName: DEMO_USER.displayName, email: DEMO_USER.email },
      })
      .returning()
    if (!user) throw new Error("Impossible de créer l'utilisateur de démo")

    await tx.delete(sets).where(eq(sets.ownerId, user.id))
    await tx.delete(folders).where(eq(folders.ownerId, user.id))
    await tx.delete(tags).where(eq(tags.ownerId, user.id))

    const folderNames = [...new Set(DEMO_SETS.flatMap((demoSet) => demoSet.folder ?? []))]
    const demoFolders = await tx
      .insert(folders)
      .values(folderNames.map((name) => ({ ownerId: user.id, name })))
      .returning()
    const folderIds = new Map(demoFolders.map((folder) => [folder.name, folder.id]))

    for (const demoSet of DEMO_SETS) {
      const [set] = await tx
        .insert(sets)
        .values({
          ownerId: user.id,
          folderId: demoSet.folder ? folderIds.get(demoSet.folder) : null,
          title: demoSet.title,
          description: demoSet.description,
          visibility: demoSet.visibility,
        })
        .returning({ id: sets.id })
      if (!set) throw new Error(`Impossible de créer le set « ${demoSet.title} »`)
      await replaceSetTags(tx, user.id, set.id, demoSet.tags)

      const inserted = await tx
        .insert(cards)
        .values(
          demoSet.cards.map(([term, definition], position) => ({
            setId: set.id,
            term,
            definition,
            position,
          })),
        )
        .returning({ id: cards.id })
      // Progression de démo sur le premier set (les cartes sont renvoyées dans l'ordre inséré).
      if (demoSet === DEMO_SETS[0]) await seedProgress(tx, user.id, inserted, now)
    }

    await tx
      .insert(userSettings)
      .values({ userId: user.id, ...DEFAULT_SETTINGS })
      .onConflictDoUpdate({ target: userSettings.userId, set: DEFAULT_SETTINGS })

    return { user, setCount: DEMO_SETS.length }
  })
}

/**
 * Révisions passées de démo (en jours, décimales permises) sur les premières cartes : la
 * planification FSRS en déduit des cartes dues aujourd'hui, d'autres plus tard, et une carte
 * ratée aujourd'hui (en réapprentissage dans la séance).
 */
const DEMO_PROGRESS: ReadonlyArray<ReadonlyArray<readonly [daysAgo: number, rating: Rating]>> = [
  [
    [14, 3],
    [13.99, 3],
    [10, 3],
  ],
  [[10, 4]],
  [[9, 4]],
  [[2, 4]],
  [
    [2, 3],
    [1.99, 3],
  ],
  [
    [1, 1],
    [0.99, 3],
    [0.98, 3],
  ],
  [[0, 1]],
]

async function seedProgress(tx: Tx, userId: string, cardList: Array<{ id: string }>, now: Date) {
  const scheduler = createScheduler(DEFAULT_SETTINGS.desiredRetention)
  for (const [index, history] of DEMO_PROGRESS.entries()) {
    const cardId = cardList[index]?.id
    if (!cardId) continue
    let card = toFsrsCard(undefined, now)
    const logs = []
    for (const [daysAgo, rating] of history) {
      const at = new Date(now.getTime() - daysAgo * 24 * 60 * 60_000)
      const result = scheduler.next(card, at, rating)
      card = result.card
      logs.push({ userId, cardId, ...fromFsrsLog(result.log) })
    }
    await tx.insert(cardReviews).values({ userId, cardId, ...fromFsrsCard(card) })
    await tx.insert(reviewLogs).values(logs)
  }
}
