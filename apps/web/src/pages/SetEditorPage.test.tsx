// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { demoMe, installDomStubs, mockApi, renderApp, sentBody } from '@/test/dom'
import { makeSet } from '@/test/fixtures'

installDomStubs()

describe('création d’un set', () => {
  it('valide les cartes, ignore les lignes vides puis crée le set', async () => {
    const created = makeSet({
      id: '22222222-2222-4222-8222-222222222222',
      title: 'Anglais',
      description: null,
      visibility: 'private',
      cards: [{ id: 'c1', term: 'a knife', definition: 'un couteau' }],
    })
    const fetchMock = mockApi({
      'GET /api/me': { body: demoMe },
      'POST /api/sets': { status: 201, body: { set: created } },
      [`GET /api/sets/${created.id}`]: { body: { set: created } },
    })
    const user = userEvent.setup()
    await renderApp('/sets/new')

    await user.type(await screen.findByLabelText('Titre'), 'Anglais')
    const terms = screen.getAllByLabelText('Terme')
    const definitions = screen.getAllByLabelText('Définition')
    await user.type(terms[0] as HTMLElement, 'a knife')
    await user.click(screen.getByRole('button', { name: 'Créer le set' }))

    // Carte 1 à moitié remplie : erreur affichée, rien n'est envoyé.
    expect(await screen.findByText('La définition est requise')).toBeTruthy()
    expect(sentBody(fetchMock, 'POST', '/api/sets')).toBeUndefined()

    await user.type(definitions[0] as HTMLElement, 'un couteau')
    await user.click(screen.getByRole('button', { name: 'Créer le set' }))

    expect(await screen.findByRole('heading', { name: 'Anglais' })).toBeTruthy()
    expect(sentBody(fetchMock, 'POST', '/api/sets')).toEqual({
      title: 'Anglais',
      description: null,
      visibility: 'private',
      cards: [{ term: 'a knife', definition: 'un couteau' }],
      tags: [],
    })
  })

  it('ajoute des tags avec Entrée et les envoie avec le set', async () => {
    const created = makeSet({ id: '22222222-2222-4222-8222-222222222222', title: 'Anglais' })
    const fetchMock = mockApi({
      'GET /api/me': { body: demoMe },
      'GET /api/tags': { body: { tags: [{ id: 't1', name: 'vocabulaire', setCount: 2 }] } },
      'POST /api/sets': { status: 201, body: { set: created } },
      [`GET /api/sets/${created.id}`]: { body: { set: created } },
    })
    const user = userEvent.setup()
    await renderApp('/sets/new')

    await user.type(await screen.findByLabelText('Titre'), 'Anglais')
    await user.type(screen.getByLabelText(/^Tags/), 'anglais{Enter}oral,')
    expect(screen.getByRole('button', { name: 'Retirer le tag anglais' })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Retirer le tag oral' }))
    await user.click(screen.getByRole('button', { name: 'Créer le set' }))

    await waitFor(() => expect(sentBody(fetchMock, 'POST', '/api/sets')?.tags).toEqual(['anglais']))
  })

  it('ajoute une carte et place le focus sur son terme', async () => {
    mockApi({ 'GET /api/me': { body: demoMe } })
    const user = userEvent.setup()
    await renderApp('/sets/new')
    await screen.findByLabelText('Titre')
    expect(screen.getAllByLabelText('Terme')).toHaveLength(3)

    await user.click(screen.getByRole('button', { name: 'Ajouter une carte' }))
    const terms = screen.getAllByLabelText('Terme')
    expect(terms).toHaveLength(4)
    await waitFor(() => expect(document.activeElement).toBe(terms[3]))
  })
})

describe('modification d’un set', () => {
  it('réordonne et supprime des cartes en conservant leurs identifiants', async () => {
    const set = makeSet()
    const fetchMock = mockApi({
      'GET /api/me': { body: demoMe },
      [`GET /api/sets/${set.id}`]: { body: { set } },
      [`PUT /api/sets/${set.id}`]: { body: { set } },
    })
    const user = userEvent.setup()
    await renderApp(`/sets/${set.id}/edit`)

    await user.click(await screen.findByRole('button', { name: 'Descendre la carte 1' }))
    await user.click(screen.getByRole('button', { name: 'Supprimer la carte 3' }))
    expect(screen.getByText('Carte 3 supprimée.')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() => expect(sentBody(fetchMock, 'PUT', `/api/sets/${set.id}`)).toBeDefined())
    expect(sentBody(fetchMock, 'PUT', `/api/sets/${set.id}`)?.cards).toEqual([
      { id: set.cards[1]?.id, term: 'Italie', definition: 'Rome' },
      { id: set.cards[0]?.id, term: 'France', definition: 'Paris' },
    ])
  })

  it("refuse l'édition à un utilisateur qui n'est pas l'auteur", async () => {
    const set = makeSet({ isOwner: false, owner: { displayName: 'Alice' } })
    mockApi({
      'GET /api/me': { body: demoMe },
      [`GET /api/sets/${set.id}`]: { body: { set } },
    })
    await renderApp(`/sets/${set.id}/edit`)
    expect(await screen.findByText("Modification réservée à l'auteur")).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Enregistrer' })).toBeNull()
  })
})
