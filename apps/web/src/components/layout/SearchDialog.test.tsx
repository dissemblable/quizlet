// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { router } from '@/router'
import { demoMe, installDomStubs, mockApi, renderApp } from '@/test/dom'
import { libraryPage, makeSet, makeSummary } from '@/test/fixtures'

installDomStubs()

describe('recherche globale', () => {
  it('s’ouvre avec Ctrl+K et mène au set trouvé', async () => {
    const set = makeSet()
    const fetchMock = mockApi({
      'GET /api/me': { body: demoMe },
      'GET /api/sets': {
        body: libraryPage([
          makeSummary(set.id, set.title, { cardCount: 3, tags: [{ id: 't', name: 'europe' }] }),
        ]),
      },
      [`GET /api/sets/${set.id}`]: { body: { set } },
    })
    const user = userEvent.setup()
    await renderApp('/sets/new')
    await screen.findByRole('heading', { name: 'Nouveau set' })

    await user.keyboard('{Control>}k{/Control}')
    const dialog = await screen.findByRole('dialog', { name: 'Rechercher dans mes sets' })
    await user.type(within(dialog).getByRole('searchbox'), 'paris')

    expect(await within(dialog).findByText('3 cartes · #europe')).toBeTruthy()
    expect(
      fetchMock.mock.calls.some(([input]) => String(input).endsWith('/api/sets?q=paris')),
    ).toBe(true)

    await user.keyboard('{Enter}')
    await waitFor(() => expect(router.state.location.pathname).toBe(`/sets/${set.id}`))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('indique quand rien ne correspond', async () => {
    mockApi({ 'GET /api/me': { body: demoMe }, 'GET /api/sets': { body: libraryPage([]) } })
    const user = userEvent.setup()
    await renderApp('/sets/new')

    await user.click(await screen.findByRole('button', { name: /Rechercher/ }))
    await user.type(screen.getByRole('searchbox', { name: /Titre, description/ }), 'zzz')
    expect(await screen.findByText('Aucun set ne correspond à « zzz ».')).toBeTruthy()
  })
})
