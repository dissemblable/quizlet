import { asc, eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { useTestDb } from '../test/test-db'
import { cards, folders, sets, setTags, tags, users } from './schema'
import { DEMO_SETS, DEMO_USER, seedDemoData } from './seed'

const db = useTestDb()

describe('seedDemoData', () => {
  it("crée l'utilisateur de démo et ses sets avec des cartes ordonnées", async () => {
    const { user } = await seedDemoData(db)
    expect(user.username).toBe(DEMO_USER.username)

    const demoSets = await db.select().from(sets).where(eq(sets.ownerId, user.id))
    expect(demoSets).toHaveLength(DEMO_SETS.length)
    expect(demoSets.filter((set) => set.visibility === 'public')).toHaveLength(1)

    const capitals = demoSets.find((set) => set.title === 'Capitales européennes')
    if (!capitals) throw new Error('set manquant')
    const capitalCards = await db
      .select()
      .from(cards)
      .where(eq(cards.setId, capitals.id))
      .orderBy(asc(cards.position))
    expect(capitalCards.map((card) => card.position)).toEqual(capitalCards.map((_, i) => i))
    expect(capitalCards[0]).toMatchObject({ term: 'France', definition: 'Paris' })
  })

  it('est idempotent', async () => {
    await seedDemoData(db)
    await seedDemoData(db)
    expect(await db.select().from(users)).toHaveLength(1)
    expect(await db.select().from(sets)).toHaveLength(DEMO_SETS.length)
    expect(await db.select().from(folders)).toHaveLength(2)
    expect(await db.select().from(tags)).toHaveLength(5)
  })

  it('range les sets privés dans des dossiers et pose des tags', async () => {
    await seedDemoData(db)
    const demoFolders = await db.select({ name: folders.name }).from(folders)
    expect(demoFolders.map((folder) => folder.name).sort()).toEqual(['Langues', 'Sciences'])
    expect(await db.select().from(setTags)).toHaveLength(5)
  })
})

describe('schéma', () => {
  it("impose l'unicité du nom d'utilisateur", async () => {
    await db.insert(users).values({ username: 'alice', displayName: 'Alice' })
    await expect(
      db.insert(users).values({ username: 'alice', displayName: 'Autre Alice' }),
    ).rejects.toThrow()
  })

  it("supprime en cascade les sets et les cartes d'un utilisateur", async () => {
    const { user } = await seedDemoData(db)
    await db.delete(users).where(eq(users.id, user.id))
    expect(await db.select().from(sets)).toHaveLength(0)
    expect(await db.select().from(cards)).toHaveLength(0)
  })
})
