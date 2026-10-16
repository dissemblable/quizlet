// @vitest-environment jsdom
import type { AiEvent } from '@quizlet/shared'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { router } from '@/router'
import { demoMe, installDomStubs, mockApi, renderApp } from '@/test/dom'

installDomStubs()

const aiMe = { ...demoMe, aiEnabled: true }

/** Réponse NDJSON de l'API, une ligne par événement. */
function ndjson(events: AiEvent[]) {
  return () =>
    new Response(events.map((event) => `${JSON.stringify(event)}\n`).join(''), {
      headers: { 'content-type': 'application/x-ndjson' },
    })
}

describe('génération de cartes par IA', () => {
  it("ouvre l'éditeur prérempli avec le brouillon généré", async () => {
    const fetchMock = mockApi({
      'GET /api/me': { body: aiMe },
      'GET /api/tags': { body: { tags: [] } },
      'POST /api/ai/generate': ndjson([
        { type: 'progress', cards: 1 },
        {
          type: 'done',
          draft: {
            title: 'Anglais',
            description: 'Vocabulaire courant',
            cards: [
              { term: 'cat', definition: 'chat' },
              { term: 'dog', definition: 'chien' },
            ],
          },
          skipped: 0,
        },
      ]),
    })
    const user = userEvent.setup()
    await renderApp('/sets/new')

    await user.click(await screen.findByRole('link', { name: "Générer avec l'IA" }))
    await user.type(await screen.findByLabelText('Votre demande'), '2 mots d’anglais')
    const pdf = new File(['%PDF'], 'cours.pdf', { type: 'application/pdf' })
    fireEvent.change(screen.getByLabelText(/Ou des fichiers/), { target: { files: [pdf] } })
    await user.click(screen.getByRole('button', { name: 'Générer' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/sets/new'))
    expect(await screen.findByDisplayValue('Anglais')).toBeTruthy()
    expect(screen.getByDisplayValue('Vocabulaire courant')).toBeTruthy()
    expect(
      screen.getAllByLabelText('Terme').map((input) => (input as HTMLInputElement).value),
    ).toEqual(['cat', 'dog'])

    const [, init] = fetchMock.mock.calls.find(([input]) => String(input).includes('/ai/')) ?? []
    const body = init?.body as FormData
    expect(body.get('prompt')).toBe('2 mots d’anglais')
    expect((body.get('files') as File).name).toBe('cours.pdf')
  })

  it("affiche l'erreur renvoyée dans le flux et reste sur la page", async () => {
    mockApi({
      'GET /api/me': { body: aiMe },
      'POST /api/ai/generate': ndjson([
        { type: 'error', message: 'Réponse trop longue : demandez moins de cartes.' },
      ]),
    })
    const user = userEvent.setup()
    await renderApp('/generate')

    await user.type(await screen.findByLabelText('Votre demande'), '5000 mots')
    await user.click(screen.getByRole('button', { name: 'Générer' }))
    expect(await screen.findByText('Réponse trop longue : demandez moins de cartes.')).toBeTruthy()
    expect(router.state.location.pathname).toBe('/generate')
  })

  it('refuse un format de fichier non pris en charge', async () => {
    mockApi({ 'GET /api/me': { body: aiMe } })
    const user = userEvent.setup()
    await renderApp('/generate')

    await user.type(await screen.findByLabelText('Votre demande'), 'Fiche')
    const docx = new File(['x'], 'cours.docx', { type: 'application/msword' })
    fireEvent.change(screen.getByLabelText(/Ou des fichiers/), { target: { files: [docx] } })
    expect((await screen.findByRole('alert')).textContent).toContain('Formats acceptés')
    expect(screen.getByRole('button', { name: 'Générer' })).toHaveProperty('disabled', true)
  })

  it("indique que la fonction n'est pas configurée", async () => {
    mockApi({ 'GET /api/me': { body: demoMe } })
    await renderApp('/generate')
    expect(await screen.findByText('Génération par IA indisponible')).toBeTruthy()
  })
})
