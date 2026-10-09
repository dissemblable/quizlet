/** Set tel que renvoyé par GET /api/sets/:id, pour les tests de rendu. */
export function makeSet(overrides: Record<string, unknown> = {}) {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    title: 'Capitales européennes',
    description: 'Associer chaque pays à sa capitale.',
    visibility: 'public',
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-10-02T10:00:00.000Z',
    owner: { displayName: 'Utilisateur Démo' },
    isOwner: true,
    cards: [
      { id: 'c0000000-0000-4000-8000-000000000001', term: 'France', definition: 'Paris' },
      { id: 'c0000000-0000-4000-8000-000000000002', term: 'Italie', definition: 'Rome' },
      { id: 'c0000000-0000-4000-8000-000000000003', term: 'Espagne', definition: 'Madrid' },
    ],
    ...overrides,
  }
}
