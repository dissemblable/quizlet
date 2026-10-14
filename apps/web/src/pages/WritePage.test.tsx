// @vitest-environment jsdom
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { demoMe, installDomStubs, mockApi, renderApp } from '@/test/dom'
import { makeSet } from '@/test/fixtures'

installDomStubs()

describe('mode écrit', () => {
  it('corrige avec tolérance, accepte « J’avais raison » et récapitule les erreurs', async () => {
    const set = makeSet()
    mockApi({ 'GET /api/me': { body: demoMe }, [`GET /api/sets/${set.id}`]: { body: { set } } })
    const user = userEvent.setup()
    await renderApp(`/sets/${set.id}/write`)

    await user.click(await screen.findByRole('button', { name: 'Commencer (3 cartes)' }))
    const answer = screen.getByLabelText('Votre définition')
    expect(document.activeElement).toBe(answer)
    expect(screen.getByText('France')).toBeTruthy()

    // Faute de frappe tolérée, puis Entrée pour continuer.
    await user.type(answer, 'pariss{Enter}')
    expect(await screen.findByText('Correct, à une faute près.')).toBeTruthy()
    await user.keyboard('{Enter}')

    // Réponse refusée, puis « J'avais raison ».
    await user.type(screen.getByLabelText('Votre définition'), 'Roma{Enter}')
    expect(await screen.findByText('Incorrect.')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: "J'avais raison" }))
    expect(screen.getByText('Réponse comptée juste.')).toBeTruthy()
    await user.keyboard('{Enter}')

    // Réponse fausse, gardée comme erreur.
    await user.type(screen.getByLabelText('Votre définition'), 'Barcelone{Enter}')
    await user.click(await screen.findByRole('button', { name: 'Voir le résultat' }))

    const result = await screen.findByRole('region', { name: 'Résultat' })
    expect(within(result).getByText('2 / 3')).toBeTruthy()
    expect(within(result).getByText('Votre réponse : Barcelone')).toBeTruthy()
    expect(within(result).getByText('Bonne réponse : Madrid')).toBeTruthy()
  })

  it('se limite aux cartes à revoir aujourd’hui si on le demande', async () => {
    const set = makeSet()
    const [, italie] = set.cards
    mockApi({
      'GET /api/me': { body: demoMe },
      [`GET /api/sets/${set.id}`]: { body: { set } },
      'GET /api/review/due': { body: { cardIds: [italie?.id] } },
    })
    const user = userEvent.setup()
    await renderApp(`/sets/${set.id}/write`)

    await user.click(await screen.findByRole('checkbox', { name: /Seulement les cartes à revoir/ }))
    expect(await screen.findByText("1 carte à revoir aujourd'hui.")).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Commencer (1 carte)' }))
    expect(screen.getByText('Italie')).toBeTruthy()
    expect(screen.getByText('Question 1 sur 1')).toBeTruthy()
  })

  it('demande le terme quand la définition est affichée', async () => {
    const set = makeSet()
    mockApi({ 'GET /api/me': { body: demoMe }, [`GET /api/sets/${set.id}`]: { body: { set } } })
    const user = userEvent.setup()
    await renderApp(`/sets/${set.id}/write`)

    await user.click(await screen.findByRole('radio', { name: 'La définition : j’écris le terme' }))
    await user.click(screen.getByRole('button', { name: 'Commencer (3 cartes)' }))
    expect(screen.getByText('Paris')).toBeTruthy()
    await user.type(screen.getByLabelText('Votre terme'), 'france{Enter}')
    expect(await screen.findByText('Correct !')).toBeTruthy()
  })
})
