import { cleanup, render } from '@testing-library/react'
import { afterEach, vi } from 'vitest'
import { App } from '@/App'
import { createQueryClient } from '@/lib/query-client'
import { resetSessionExpired } from '@/lib/session'
import { router } from '@/router'

/** À appeler en tête d'un fichier de test `@vitest-environment jsdom`. */
export function installDomStubs() {
  // jsdom n'implémente pas matchMedia (utilisé par le thème).
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList

  // API absentes de jsdom mais utilisées par les primitives Radix (radio, dialogues, menus).
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Element.prototype.hasPointerCapture ??= () => false
  Element.prototype.releasePointerCapture ??= () => {}
  Element.prototype.scrollIntoView ??= () => {}

  afterEach(() => {
    cleanup()
    resetSessionExpired()
    vi.unstubAllGlobals()
    window.history.replaceState(null, '', '/')
  })
}

type MockReply = { status?: number; body?: unknown } | (() => Response)

/**
 * Remplace fetch par une fausse API : clés « MÉTHODE /chemin ».
 * Une route non déclarée répond 404 au format d'erreur de l'API.
 */
export function mockApi(routes: Record<string, MockReply>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input), window.location.href)
    const key = `${init?.method ?? 'GET'} ${url.pathname}`
    const reply = routes[key]
    if (typeof reply === 'function') return reply()
    if (!reply) {
      return Response.json(
        { error: { code: 'NOT_FOUND', message: `Route simulée absente : ${key}` } },
        { status: 404 },
      )
    }
    return Response.json(reply.body ?? {}, { status: reply.status ?? 200 })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

/** Corps JSON envoyé lors du premier appel correspondant à « MÉTHODE /chemin ». */
export function sentBody(fetchMock: ReturnType<typeof mockApi>, method: string, path: string) {
  const call = fetchMock.mock.calls.find(([input, init]) => {
    const url = new URL(String(input), window.location.href)
    return (init?.method ?? 'GET') === method && url.pathname === path
  })
  return call?.[1]?.body ? JSON.parse(String(call[1].body)) : undefined
}

export const demoMe = {
  user: {
    id: '00000000-0000-4000-8000-000000000001',
    username: 'demo',
    displayName: 'Utilisateur Démo',
    email: 'demo@example.com',
  },
  logoutUrl: 'https://auth.example.test/logout',
}

/** Rend l'application complète à l'adresse donnée, avec un client de requêtes neuf et sans retry. */
export async function renderApp(path = '/') {
  await router.navigate(path)
  return render(<App queryClient={createQueryClient({ retry: false })} />)
}
