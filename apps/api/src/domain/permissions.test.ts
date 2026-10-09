import { describe, expect, it } from 'vitest'
import { canEdit, canView, decideAccess } from './permissions'

const owner = 'owner-id'
const other = 'other-id'
const privateSet = { ownerId: owner, visibility: 'private' as const }
const publicSet = { ownerId: owner, visibility: 'public' as const }

describe('canView / canEdit', () => {
  it("l'auteur voit et modifie ses sets, publics ou privés", () => {
    for (const set of [privateSet, publicSet]) {
      expect(canView(set, owner)).toBe(true)
      expect(canEdit(set, owner)).toBe(true)
    }
  })

  it('un autre utilisateur voit un set public sans pouvoir le modifier', () => {
    expect(canView(publicSet, other)).toBe(true)
    expect(canEdit(publicSet, other)).toBe(false)
  })

  it('un autre utilisateur ne voit pas un set privé', () => {
    expect(canView(privateSet, other)).toBe(false)
    expect(canEdit(privateSet, other)).toBe(false)
  })
})

describe('decideAccess', () => {
  it.each([
    [privateSet, owner, 'view', 'allowed'],
    [privateSet, owner, 'edit', 'allowed'],
    [privateSet, other, 'view', 'not-found'],
    [privateSet, other, 'edit', 'not-found'],
    [publicSet, other, 'view', 'allowed'],
    [publicSet, other, 'edit', 'forbidden'],
    [undefined, owner, 'view', 'not-found'],
  ] as const)('%o, %s, %s → %s', (set, userId, action, expected) => {
    expect(decideAccess(set, userId, action)).toBe(expected)
  })
})
