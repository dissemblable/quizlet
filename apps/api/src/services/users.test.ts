import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { users } from '../db/schema'
import type { Identity } from '../middleware/identity'
import { useTestDb } from '../test/test-db'
import { createUserResolver, upsertUser } from './users'

const db = useTestDb()

const alice: Identity = {
  username: 'alice',
  email: 'alice@example.test',
  displayName: 'Alice',
  groups: ['users'],
}

describe('upsertUser', () => {
  it("crée l'utilisateur à sa première requête", async () => {
    const user = await upsertUser(db, alice)
    expect(user).toMatchObject({
      username: 'alice',
      email: 'alice@example.test',
      displayName: 'Alice',
    })
    expect(await db.select().from(users)).toHaveLength(1)
  })

  it("met à jour l'email et le nom sans changer l'identifiant", async () => {
    const first = await upsertUser(db, alice)
    const second = await upsertUser(db, {
      ...alice,
      email: 'alice@nouveau.test',
      displayName: 'Alice Martin',
    })
    expect(second.id).toBe(first.id)
    expect(second).toMatchObject({ email: 'alice@nouveau.test', displayName: 'Alice Martin' })
    expect(second.updatedAt.getTime()).toBeGreaterThanOrEqual(first.updatedAt.getTime())
    expect(await db.select().from(users)).toHaveLength(1)
  })

  it("n'écrit rien quand l'identité n'a pas changé", async () => {
    const first = await upsertUser(db, alice)
    const again = await upsertUser(db, alice)
    expect(again.id).toBe(first.id)
    expect(again.updatedAt.getTime()).toBe(first.updatedAt.getTime())
  })

  it('accepte un email absent', async () => {
    const user = await upsertUser(db, { ...alice, email: null })
    expect(user.email).toBeNull()
  })
})

describe('createUserResolver', () => {
  it("met l'utilisateur en cache, puis le recharge après expiration", async () => {
    let clock = 0
    const resolve = createUserResolver(db, { ttlMs: 1_000, now: () => clock })
    const user = await resolve(alice)

    // Modification directe en base : invisible tant que le cache est valide.
    await db.update(users).set({ displayName: 'Modifié' }).where(eq(users.id, user.id))
    expect((await resolve(alice)).displayName).toBe('Alice')

    clock = 2_000
    // Après expiration, l'upsert remet le nom transmis par le SSO.
    expect((await resolve(alice)).displayName).toBe('Alice')
    const [stored] = await db.select().from(users).where(eq(users.id, user.id))
    expect(stored?.displayName).toBe('Alice')
  })

  it('prend en compte immédiatement un changement de nom côté SSO', async () => {
    const resolve = createUserResolver(db)
    await resolve(alice)
    const renamed = await resolve({ ...alice, displayName: 'Alice M.' })
    expect(renamed.displayName).toBe('Alice M.')
  })
})
