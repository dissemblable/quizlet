// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { demoMe, installDomStubs, mockApi, renderApp } from '@/test/dom'
import { makeSet } from '@/test/fixtures'

installDomStubs()

const set = makeSet()
const questions = [
  { cardId: 'c1', term: 'France', choices: ['Rome', 'Paris', 'Madrid', 'Berlin'], answerIndex: 1 },
  { cardId: 'c2', term: 'Italie', choices: ['Paris', 'Madrid', 'Rome', 'Berlin'], answerIndex: 2 },
]

async function openQuiz(
  quizReply: Parameters<typeof mockApi>[0][string] = { body: { questions } },
) {
  const fetchMock = mockApi({
    'GET /api/me': { body: demoMe },
    [`GET /api/sets/${set.id}`]: { body: { set } },
    [`GET /api/sets/${set.id}/quiz`]: quizReply,
  })
  const user = userEvent.setup()
  await renderApp(`/sets/${set.id}/quiz`)
  return { user, fetchMock }
}

describe('mode quiz', () => {
  it('corrige une bonne réponse et passe à la question suivante', async () => {
    const { user } = await openQuiz()
    expect(await screen.findByRole('heading', { name: 'France' })).toBeTruthy()
    expect(screen.getByText('Question 1 sur 2')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /Paris/ }))
    expect(screen.getByText('Bonne réponse !')).toBeTruthy()
    // Les choix sont verrouillés après la réponse.
    expect(screen.getByRole('button', { name: /Rome/ }).hasAttribute('disabled')).toBe(true)

    const next = screen.getByRole('button', { name: 'Question suivante' })
    expect(document.activeElement).toBe(next)
    await user.keyboard('{Enter}')
    expect(await screen.findByRole('heading', { name: 'Italie' })).toBeTruthy()
  })

  it('montre la bonne réponse après une erreur, puis le score et les erreurs', async () => {
    const { user } = await openQuiz()
    await screen.findByRole('heading', { name: 'France' })

    await user.keyboard('1') // « Rome » : mauvaise réponse
    expect(screen.getByText('Mauvaise réponse. La bonne réponse était : Paris')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Question suivante' }))

    await user.keyboard('3') // « Rome » : bonne réponse
    await user.click(screen.getByRole('button', { name: 'Voir le résultat' }))

    const result = await screen.findByRole('region', { name: 'Résultat' })
    expect(within(result).getByText('1 / 2')).toBeTruthy()
    expect(within(result).getByText(/50 % de bonnes réponses/)).toBeTruthy()
    expect(within(result).getByText('Votre réponse : Rome')).toBeTruthy()
    expect(within(result).getByText('Bonne réponse : Paris')).toBeTruthy()
  })

  it('demande un nouveau tirage pour recommencer', async () => {
    const { user, fetchMock } = await openQuiz()
    await screen.findByRole('heading', { name: 'France' })
    for (const choice of ['2', '3']) {
      await user.keyboard(choice)
      await user.keyboard('{Enter}')
    }
    const quizCalls = () =>
      fetchMock.mock.calls.filter(([input]) => String(input).endsWith('/quiz')).length
    expect(quizCalls()).toBe(1)

    await user.click(await screen.findByRole('button', { name: 'Nouveau quiz' }))
    expect(await screen.findByText('Question 1 sur 2')).toBeTruthy()
    await waitFor(() => expect(quizCalls()).toBe(2))
  })

  it('explique quand le set ne permet pas de quiz', async () => {
    await openQuiz({
      status: 422,
      body: {
        error: {
          code: 'QUIZ_NOT_ENOUGH_CARDS',
          message: 'Un quiz demande au moins 4 cartes aux définitions différentes.',
        },
      },
    })
    expect(await screen.findByText('Pas assez de cartes pour un quiz')).toBeTruthy()
    expect(screen.getByText(/au moins 4 cartes/)).toBeTruthy()
  })
})
