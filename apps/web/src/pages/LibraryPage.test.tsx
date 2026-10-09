// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { router } from '@/router'
import { demoMe, installDomStubs, mockApi, renderApp } from '@/test/dom'

installDomStubs()

const summary = (id: string, title: string, cardCount: number, visibility = 'private') => ({
  id,
  title,
  description: null,
  visibility,
  updatedAt: '2026-10-09T12:00:00.000Z',
  cardCount,
})

describe('bibliothèque', () => {
  it('liste mes sets avec leur nombre de cartes', async () => {
    mockApi({
      'GET /api/me': { body: demoMe },
      'GET /api/sets': {
        body: {
          sets: [summary('1', 'Capitales européennes', 12, 'public'), summary('2', 'Chimie', 1)],
        },
      },
    })
    await renderApp()

    const list = await screen.findByRole('list', { name: 'Mes sets' })
    const items = within(list).getAllByRole('link')
    expect(items).toHaveLength(2)
    expect(within(items[0] as HTMLElement).getByText('12 cartes')).toBeTruthy()
    expect(within(items[0] as HTMLElement).getByText('Public')).toBeTruthy()
    expect(within(items[1] as HTMLElement).getByText('1 carte')).toBeTruthy()
    expect(screen.getByText('2 sets')).toBeTruthy()
  })

  it('cherche par titre et garde la recherche dans l’URL', async () => {
    const fetchMock = mockApi({
      'GET /api/me': { body: demoMe },
      'GET /api/sets': { body: { sets: [summary('1', 'Chimie', 3)] } },
    })
    const user = userEvent.setup()
    await renderApp()
    await screen.findByRole('list', { name: 'Mes sets' })

    await user.type(screen.getByLabelText('Rechercher un set par titre'), 'chim')
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([input]) => String(input).includes('/api/sets?q=chim')),
      ).toBe(true),
    )
    await waitFor(() => expect(router.state.location.search).toBe('?q=chim'))
  })

  it('invite à créer un premier set quand la bibliothèque est vide', async () => {
    mockApi({ 'GET /api/me': { body: demoMe }, 'GET /api/sets': { body: { sets: [] } } })
    await renderApp()
    expect(await screen.findByText('Votre bibliothèque est vide')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Créer un set' })).toBeTruthy()
  })

  it('distingue « aucun résultat » d’une bibliothèque vide', async () => {
    mockApi({ 'GET /api/me': { body: demoMe }, 'GET /api/sets': { body: { sets: [] } } })
    await renderApp('/?q=zzz')
    expect(await screen.findByText('Aucun résultat')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Effacer la recherche' })).toBeTruthy()
  })
})
