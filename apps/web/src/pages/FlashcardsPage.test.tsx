// @vitest-environment jsdom
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { demoMe, installDomStubs, mockApi, renderApp } from '@/test/dom'
import { makeSet } from '@/test/fixtures'

installDomStubs()

async function openFlashcards(overrides: Record<string, unknown> = {}) {
  const set = makeSet(overrides)
  mockApi({ 'GET /api/me': { body: demoMe }, [`GET /api/sets/${set.id}`]: { body: { set } } })
  const user = userEvent.setup()
  await renderApp(`/sets/${set.id}/flashcards`)
  await screen.findByText('Carte 1 sur 3')
  return user
}

const liveText = () => document.querySelector('[aria-live="polite"].sr-only')?.textContent

describe('mode flashcards', () => {
  it('retourne la carte avec Espace et navigue avec les flèches', async () => {
    const user = await openFlashcards()
    expect(liveText()).toBe('Terme : France')

    await user.keyboard(' ')
    expect(liveText()).toBe('Définition : Paris')

    await user.keyboard('{ArrowRight}')
    expect(screen.getByText('Carte 2 sur 3')).toBeTruthy()
    expect(liveText()).toBe('Terme : Italie')

    await user.keyboard('{ArrowLeft}')
    expect(screen.getByText('Carte 1 sur 3')).toBeTruthy()
  })

  it('retourne la carte au clic', async () => {
    const user = await openFlashcards()
    await user.click(screen.getByRole('button', { name: /^Terme France/ }))
    expect(liveText()).toBe('Définition : Paris')
  })

  it('met à jour la barre de progression', async () => {
    const user = await openFlashcards()
    const bar = screen.getByRole('progressbar', { name: 'Progression de la session' })
    expect(bar.getAttribute('aria-valuenow')).toBe('0')
    await user.keyboard('{ArrowRight}')
    expect(bar.getAttribute('aria-valuenow')).toBe('33')
  })

  it('affiche un récapitulatif et permet de réviser les cartes à revoir', async () => {
    const user = await openFlashcards()
    await user.click(screen.getByRole('button', { name: 'Je sais' }))
    await user.click(screen.getByRole('button', { name: 'À revoir' }))
    await user.click(screen.getByRole('button', { name: 'Je sais' }))

    const recap = await screen.findByRole('region', { name: 'Session terminée' })
    expect(within(recap).getByText('Je sais').nextElementSibling?.textContent).toBe('2')
    expect(within(recap).getByText('Italie')).toBeTruthy()
    expect(document.activeElement).toBe(within(recap).getByRole('heading', { level: 2 }))

    await user.click(within(recap).getByRole('button', { name: 'Réviser la carte à revoir' }))
    expect(await screen.findByText('Carte 1 sur 1')).toBeTruthy()
    expect(liveText()).toBe('Terme : Italie')
  })

  it('mélange les cartes et le signale', async () => {
    const user = await openFlashcards()
    const shuffle = screen.getByRole('button', { name: 'Mélanger' })
    expect(shuffle.getAttribute('aria-pressed')).toBe('false')
    await user.click(shuffle)
    expect(shuffle.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText('Carte 1 sur 3')).toBeTruthy()
  })

  it('indique quand le set ne contient aucune carte', async () => {
    const set = makeSet({ cards: [] })
    mockApi({ 'GET /api/me': { body: demoMe }, [`GET /api/sets/${set.id}`]: { body: { set } } })
    await renderApp(`/sets/${set.id}/flashcards`)
    expect(await screen.findByText('Ce set ne contient aucune carte')).toBeTruthy()
  })
})
