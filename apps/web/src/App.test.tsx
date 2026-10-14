// @vitest-environment jsdom
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { demoMe, installDomStubs, mockApi, renderApp } from '@/test/dom'
import { libraryPage } from '@/test/fixtures'

installDomStubs()

describe('App', () => {
  it("affiche l'utilisateur SSO dans l'en-tête après GET /api/me", async () => {
    mockApi({ 'GET /api/me': { body: demoMe } })
    await renderApp()
    expect(await screen.findByRole('button', { name: 'Compte de Utilisateur Démo' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Ma bibliothèque' })).toBeTruthy()
  })

  it('propose de se reconnecter quand Authelia redirige (session expirée)', async () => {
    mockApi({ 'GET /api/me': () => ({ type: 'opaqueredirect', status: 0 }) as Response })
    await renderApp()
    expect(await screen.findByText('Session expirée')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Se reconnecter' })).toBeTruthy()
  })

  it("affiche une erreur avec un bouton Réessayer si l'API est indisponible", async () => {
    mockApi({
      'GET /api/me': {
        status: 503,
        body: { error: { code: 'INTERNAL_ERROR', message: 'Service indisponible.' } },
      },
    })
    await renderApp()
    expect(await screen.findByText('Impossible de charger votre profil')).toBeTruthy()
    expect(screen.getByText('Service indisponible.')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Réessayer/ })).toBeTruthy()
  })

  it('place le focus sur le contenu principal après un changement de page', async () => {
    mockApi({ 'GET /api/me': { body: demoMe }, 'GET /api/sets': { body: libraryPage([]) } })
    const user = userEvent.setup()
    await renderApp()
    await user.click(await screen.findByRole('link', { name: 'Créer un set' }))
    expect(await screen.findByRole('heading', { name: 'Nouveau set' })).toBeTruthy()
    expect(document.activeElement?.id).toBe('contenu')
  })

  it('ouvre l’aide des raccourcis clavier avec « ? »', async () => {
    mockApi({ 'GET /api/me': { body: demoMe } })
    const user = userEvent.setup()
    await renderApp('/nimporte/quoi')
    await screen.findByRole('heading', { name: 'Page introuvable' })

    await user.keyboard('?')
    const dialog = await screen.findByRole('dialog', { name: 'Raccourcis clavier' })
    expect(dialog.textContent).toContain('Noter : À revoir, Difficile, Bien, Facile')
  })

  it('affiche une page introuvable pour une adresse inconnue', async () => {
    mockApi({ 'GET /api/me': { body: demoMe } })
    await renderApp('/nimporte/quoi')
    expect(await screen.findByRole('heading', { name: 'Page introuvable' })).toBeTruthy()
  })
})
