// @vitest-environment jsdom
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { demoMe, installDomStubs, mockApi, renderApp } from '@/test/dom'

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

  it('affiche une page introuvable pour une adresse inconnue', async () => {
    mockApi({ 'GET /api/me': { body: demoMe } })
    await renderApp('/nimporte/quoi')
    expect(await screen.findByRole('heading', { name: 'Page introuvable' })).toBeTruthy()
  })
})
