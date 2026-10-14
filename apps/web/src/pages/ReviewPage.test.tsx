// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { demoMe, installDomStubs, mockApi, renderApp, sentBody } from '@/test/dom'
import { libraryPage } from '@/test/fixtures'

installDomStubs()

const in10min = () => new Date(Date.now() + 10 * 60_000).toISOString()
const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString()

function queueCard(id: string, term: string, definition: string) {
  return {
    id,
    setId: 's1',
    term,
    definition,
    state: 'new',
    intervals: [in10min(), in10min(), in10min(), inDays(3)],
  }
}

describe('révision du jour', () => {
  it('retourne la carte avec Espace, note au clavier et revoit une carte ratée', async () => {
    const france = queueCard('c1', 'France', 'Paris')
    const italie = queueCard('c2', 'Italie', 'Rome')
    const grades: number[] = []
    const fetchMock = mockApi({
      'GET /api/me': { body: demoMe },
      'GET /api/review/summary': { body: { due: 0, new: 2 } },
      'GET /api/review/queue': { body: { cards: [france, italie], counts: {} } },
      'POST /api/review/cards/c1': () => {
        grades.push(1)
        // « À revoir » : encore due aujourd'hui, la carte revient en fin de séance.
        return Response.json({ state: 'learning', due: in10min(), requeue: true, card: france })
      },
      'POST /api/review/cards/c2': () =>
        Response.json({ state: 'review', due: inDays(3), requeue: false, card: null }),
    })
    const user = userEvent.setup()
    await renderApp('/review')

    expect(await screen.findByText('Encore 2 cartes')).toBeTruthy()
    await user.keyboard(' ')
    expect(screen.getByText('Définition : Paris')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Facile 3 j' })).toBeTruthy()

    await user.keyboard('1')
    await waitFor(() => expect(grades).toEqual([1]))
    expect(sentBody(fetchMock, 'POST', '/api/review/cards/c1')).toEqual({ rating: 1 })
    expect(await screen.findByText('Terme : Italie')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Afficher la réponse' }))
    await user.click(screen.getByRole('button', { name: /^Bien/ }))
    // La carte ratée revient.
    expect(await screen.findByText('Terme : France')).toBeTruthy()
    expect(screen.getByText('Encore 1 carte')).toBeTruthy()
  })

  it('annonce qu’il n’y a rien à réviser', async () => {
    mockApi({
      'GET /api/me': { body: demoMe },
      'GET /api/review/queue': { body: { cards: [], counts: {} } },
    })
    await renderApp('/review')
    expect(await screen.findByText('Rien à réviser pour le moment')).toBeTruthy()
  })

  it('affiche les compteurs dans l’en-tête et sur la bibliothèque', async () => {
    mockApi({
      'GET /api/me': { body: demoMe },
      'GET /api/review/summary': { body: { due: 3, new: 2 } },
      'GET /api/sets': { body: libraryPage([]) },
    })
    await renderApp('/')

    const banner = await screen.findByRole('region', { name: 'Révision du jour' })
    expect(within(banner).getByText('3 cartes dues · 2 nouvelles cartes')).toBeTruthy()
    expect(within(banner).getByRole('link', { name: 'Réviser' }).getAttribute('href')).toBe(
      '/review',
    )
    const headerLink = screen.getByRole('link', { name: /Révision\s*5 à réviser/ })
    expect(headerLink.getAttribute('href')).toBe('/review')
  })
})
