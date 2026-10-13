// @vitest-environment jsdom
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { router } from '@/router'
import { demoMe, installDomStubs, mockApi, renderApp, sentBody } from '@/test/dom'
import { makeSet } from '@/test/fixtures'

installDomStubs()

describe('import de cartes', () => {
  it('affiche l’aperçu, laisse corriger le séparateur et crée le set', async () => {
    const created = makeSet({ id: '33333333-3333-4333-8333-333333333333', title: 'Anglais' })
    const fetchMock = mockApi({
      'GET /api/me': { body: demoMe },
      'POST /api/sets/import': {
        status: 201,
        body: { set: { id: created.id }, imported: 2, skipped: 1 },
      },
      [`GET /api/sets/${created.id}`]: { body: { set: created } },
    })
    const user = userEvent.setup()
    await renderApp('/import')

    await user.type(await screen.findByLabelText('Titre du nouveau set'), 'Anglais')
    await user.click(screen.getByLabelText('Cartes à importer'))
    await user.paste('cat - chat\ndog - chien\nbird')
    // Aucun séparateur reconnu : la détection retombe sur la tabulation.
    expect(await screen.findByText('0 carte détectée · 3 lignes ignorées')).toBeTruthy()

    const termGroup = screen.getByRole('group', { name: 'Entre le terme et la définition' })
    await user.click(within(termGroup).getByRole('radio', { name: 'Autre' }))
    await user.type(within(termGroup).getByLabelText('Séparateur personnalisé'), ' - ')
    expect(await screen.findByText('2 cartes détectées · 1 ligne ignorée')).toBeTruthy()
    expect(screen.getByRole('cell', { name: 'chien' })).toBeTruthy()
    expect(screen.getByText(/Ligne 3/)).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Importer 2 cartes' }))
    await waitFor(() => expect(router.state.location.pathname).toBe(`/sets/${created.id}`))
    expect(sentBody(fetchMock, 'POST', '/api/sets/import')).toEqual({
      title: 'Anglais',
      text: 'cat - chat\ndog - chien\nbird',
      separators: { term: ' - ', card: '\n' },
    })
  })

  it('refuse un fichier qui n’est pas en UTF-8', async () => {
    mockApi({ 'GET /api/me': { body: demoMe } })
    await renderApp('/import')

    const latin1 = new File([new Uint8Array([0x63, 0x61, 0x66, 0xe9])], 'cartes.csv', {
      type: 'text/csv',
    })
    fireEvent.change(await screen.findByLabelText('Ou un fichier .csv / .txt'), {
      target: { files: [latin1] },
    })
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      "Ce fichier n'est pas encodé en UTF-8. Enregistrez-le au format « CSV UTF-8 » puis réessayez.",
    )
  })

  it("réserve l'import dans un set existant à son auteur", async () => {
    const set = makeSet({ isOwner: false })
    mockApi({ 'GET /api/me': { body: demoMe }, [`GET /api/sets/${set.id}`]: { body: { set } } })
    await renderApp(`/sets/${set.id}/import`)
    expect(await screen.findByText("Import réservé à l'auteur")).toBeTruthy()
  })
})
