// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { demoMe, installDomStubs, mockApi, renderApp, sentBody } from '@/test/dom'

installDomStubs()

const saved = {
  timezone: 'Europe/Paris',
  newCardsPerDay: 20,
  reviewsPerDay: 200,
  desiredRetention: 0.9,
}

describe('paramètres', () => {
  it('modifie les limites quotidiennes, le fuseau et la rétention', async () => {
    const fetchMock = mockApi({
      'GET /api/me': { body: demoMe },
      'GET /api/settings': { body: { settings: saved } },
      'PUT /api/settings': () =>
        Response.json({ settings: { ...saved, timezone: 'America/New_York', newCardsPerDay: 10 } }),
    })
    const user = userEvent.setup()
    await renderApp('/settings')

    const newCards = await screen.findByLabelText('Nouvelles cartes par jour')
    await user.clear(newCards)
    await user.type(newCards, '10')
    await user.selectOptions(screen.getByLabelText('Fuseau horaire'), 'America/New_York')
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() =>
      expect(sentBody(fetchMock, 'PUT', '/api/settings')).toEqual({
        ...saved,
        timezone: 'America/New_York',
        newCardsPerDay: 10,
      }),
    )
    expect(await screen.findByText('Paramètres enregistrés.')).toBeTruthy()
  })

  it('signale une rétention hors bornes sans rien envoyer', async () => {
    const fetchMock = mockApi({
      'GET /api/me': { body: demoMe },
      'GET /api/settings': { body: { settings: saved } },
    })
    const user = userEvent.setup()
    await renderApp('/settings')

    const retention = await screen.findByLabelText('Rétention cible')
    await user.clear(retention)
    await user.type(retention, '0.5')
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(
      await screen.findByText('La rétention cible doit être comprise entre 0,70 et 0,99'),
    ).toBeTruthy()
    expect(sentBody(fetchMock, 'PUT', '/api/settings')).toBeUndefined()
  })

  it('enregistre le fuseau du navigateur quand aucun n’a été choisi', async () => {
    const fetchMock = mockApi({
      'GET /api/me': { body: demoMe },
      'GET /api/settings': { body: { settings: { ...saved, timezone: null } } },
      'PUT /api/settings': () => Response.json({ settings: saved }),
    })
    await renderApp('/nimporte/quoi')

    await waitFor(() =>
      expect(sentBody(fetchMock, 'PUT', '/api/settings')).toEqual({
        ...saved,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
    )
  })
})
