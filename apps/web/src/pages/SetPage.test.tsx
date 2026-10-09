// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { demoMe, installDomStubs, mockApi, renderApp } from '@/test/dom'
import { makeSet } from '@/test/fixtures'

installDomStubs()

describe('page d’un set', () => {
  it("affiche les cartes et les actions de l'auteur", async () => {
    const set = makeSet()
    mockApi({ 'GET /api/me': { body: demoMe }, [`GET /api/sets/${set.id}`]: { body: { set } } })
    await renderApp(`/sets/${set.id}`)

    expect(await screen.findByRole('heading', { name: 'Capitales européennes' })).toBeTruthy()
    expect(screen.getByText('3 cartes')).toBeTruthy()
    expect(screen.getByText('Madrid')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Modifier' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Supprimer' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Copier le lien' })).toBeTruthy()
  })

  it("n'offre que la lecture et la duplication sur le set public d'un autre", async () => {
    const set = makeSet({ isOwner: false, owner: { displayName: 'Alice' } })
    mockApi({ 'GET /api/me': { body: demoMe }, [`GET /api/sets/${set.id}`]: { body: { set } } })
    await renderApp(`/sets/${set.id}`)

    expect(await screen.findByText('Créé par Alice')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Dupliquer' })).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Modifier' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Supprimer' })).toBeNull()
  })

  it('affiche « Set introuvable » pour un set privé ou supprimé', async () => {
    const id = '33333333-3333-4333-8333-333333333333'
    mockApi({
      'GET /api/me': { body: demoMe },
      [`GET /api/sets/${id}`]: {
        status: 404,
        body: { error: { code: 'NOT_FOUND', message: 'Set introuvable.' } },
      },
    })
    await renderApp(`/sets/${id}`)
    expect(await screen.findByRole('heading', { name: 'Set introuvable' })).toBeTruthy()
  })

  it('supprime le set après confirmation et revient à la bibliothèque', async () => {
    const set = makeSet()
    const fetchMock = mockApi({
      'GET /api/me': { body: demoMe },
      [`GET /api/sets/${set.id}`]: { body: { set } },
      [`DELETE /api/sets/${set.id}`]: () => new Response(null, { status: 204 }),
    })
    const user = userEvent.setup()
    await renderApp(`/sets/${set.id}`)

    await user.click(await screen.findByRole('button', { name: 'Supprimer' }))
    expect(await screen.findByRole('alertdialog')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Supprimer définitivement' }))

    expect(await screen.findByRole('heading', { name: 'Ma bibliothèque' })).toBeTruthy()
    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(true),
    )
  })
})
