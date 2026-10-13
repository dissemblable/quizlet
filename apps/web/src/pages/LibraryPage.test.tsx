// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { router } from '@/router'
import { demoMe, installDomStubs, mockApi, renderApp, sentBody } from '@/test/dom'
import { libraryPage, makeSummary } from '@/test/fixtures'

installDomStubs()

const FOLDER_ID = 'f0000000-0000-4000-8000-000000000001'
const TAG_ID = 'a0000000-0000-4000-8000-000000000001'
const folders = { folders: [{ id: FOLDER_ID, name: 'Langues', setCount: 1 }] }
const tags = { tags: [{ id: TAG_ID, name: 'anglais', setCount: 1 }] }

function fetchedUrls(fetchMock: ReturnType<typeof mockApi>) {
  return fetchMock.mock.calls.map(([input]) => String(input))
}

describe('bibliothèque', () => {
  it('liste mes sets avec leur nombre de cartes et leurs tags', async () => {
    mockApi({
      'GET /api/me': { body: demoMe },
      'GET /api/sets': {
        body: libraryPage([
          makeSummary('1', 'Capitales européennes', { cardCount: 12, visibility: 'public' }),
          makeSummary('2', 'Chimie', { cardCount: 1, tags: [{ id: TAG_ID, name: 'chimie' }] }),
        ]),
      },
    })
    await renderApp()

    const list = await screen.findByRole('list', { name: 'Mes sets' })
    const items = within(list).getAllByRole('link')
    expect(items).toHaveLength(2)
    expect(within(items[0] as HTMLElement).getByText('12 cartes')).toBeTruthy()
    expect(within(items[0] as HTMLElement).getByText('Public')).toBeTruthy()
    expect(within(items[1] as HTMLElement).getByText('1 carte')).toBeTruthy()
    expect(within(items[1] as HTMLElement).getByText('#chimie')).toBeTruthy()
    expect(screen.getByText('2 sets')).toBeTruthy()
  })

  it('cherche par titre et garde la recherche dans l’URL', async () => {
    const fetchMock = mockApi({
      'GET /api/me': { body: demoMe },
      'GET /api/sets': { body: libraryPage([makeSummary('1', 'Chimie')]) },
    })
    const user = userEvent.setup()
    await renderApp()
    await screen.findByRole('list', { name: 'Mes sets' })

    await user.type(screen.getByLabelText('Rechercher un set par titre'), 'chim')
    await waitFor(() =>
      expect(fetchedUrls(fetchMock).some((url) => url.includes('/api/sets?q=chim'))).toBe(true),
    )
    await waitFor(() => expect(router.state.location.search).toBe('?q=chim'))
  })

  it('filtre par dossier et par tag, en gardant les filtres dans l’URL', async () => {
    const fetchMock = mockApi({
      'GET /api/me': { body: demoMe },
      'GET /api/sets': { body: libraryPage([makeSummary('1', 'Anglais')]) },
      'GET /api/folders': { body: folders },
      'GET /api/tags': { body: tags },
    })
    const user = userEvent.setup()
    await renderApp()

    await user.click(await screen.findByRole('button', { name: /Langues/ }))
    await waitFor(() => expect(router.state.location.search).toBe(`?folder=${FOLDER_ID}`))
    expect(screen.getByRole('button', { name: /Langues/ }).getAttribute('aria-pressed')).toBe(
      'true',
    )
    expect(screen.getByRole('button', { name: 'Renommer' })).toBeTruthy()

    await user.click(screen.getByRole('button', { name: '#anglais' }))
    await waitFor(() =>
      expect(router.state.location.search).toBe(`?folder=${FOLDER_ID}&tags=${TAG_ID}`),
    )
    await waitFor(() =>
      expect(
        fetchedUrls(fetchMock).some((url) =>
          url.endsWith(`/api/sets?folder=${FOLDER_ID}&tags=${TAG_ID}`),
        ),
      ).toBe(true),
    )
  })

  it('pagine la bibliothèque', async () => {
    mockApi({
      'GET /api/me': { body: demoMe },
      'GET /api/sets': { body: libraryPage([makeSummary('1', 'Anglais')], { total: 30 }) },
    })
    const user = userEvent.setup()
    await renderApp()

    expect(await screen.findByText('Page 1 sur 2')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Précédente' })).toHaveProperty('disabled', true)
    await user.click(screen.getByRole('button', { name: 'Suivante' }))
    await waitFor(() => expect(router.state.location.search).toBe('?page=2'))
  })

  it('range un set dans un dossier depuis la bibliothèque', async () => {
    const fetchMock = mockApi({
      'GET /api/me': { body: demoMe },
      'GET /api/sets': { body: libraryPage([makeSummary('1', 'Anglais')]) },
      'GET /api/folders': { body: folders },
      'PUT /api/sets/1/folder': () => new Response(null, { status: 204 }),
    })
    const user = userEvent.setup()
    await renderApp()

    await user.click(
      await screen.findByRole('button', { name: 'Déplacer « Anglais » vers un dossier' }),
    )
    await user.click(await screen.findByRole('menuitemradio', { name: 'Langues' }))
    await waitFor(() =>
      expect(sentBody(fetchMock, 'PUT', '/api/sets/1/folder')).toEqual({ folderId: FOLDER_ID }),
    )
  })

  it('invite à créer un premier set quand la bibliothèque est vide', async () => {
    mockApi({ 'GET /api/me': { body: demoMe }, 'GET /api/sets': { body: libraryPage([]) } })
    await renderApp()
    expect(await screen.findByText('Votre bibliothèque est vide')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Créer un set' })).toBeTruthy()
  })

  it('distingue « aucun résultat » d’une bibliothèque vide', async () => {
    mockApi({ 'GET /api/me': { body: demoMe }, 'GET /api/sets': { body: libraryPage([]) } })
    await renderApp('/?q=zzz')
    expect(await screen.findByText('Aucun résultat')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Effacer la recherche' })).toBeTruthy()
  })
})
