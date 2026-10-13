import { eq } from 'drizzle-orm'
import { replaceSetTags } from '../services/tags'
import type { Db } from './client'
import { cards, folders, sets, tags, users } from './schema'

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
 * Crée (ou recrée) l'utilisateur de démo et ses sets d'exemple.
 * Idempotent : les sets existants de l'utilisateur de démo sont remplacés.
 */
export async function seedDemoData(db: Db) {
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

      await tx.insert(cards).values(
        demoSet.cards.map(([term, definition], position) => ({
          setId: set.id,
          term,
          definition,
          position,
        })),
      )
    }

    return { user, setCount: DEMO_SETS.length }
  })
}
