/**
 * Constructeurs de chemins complets (URL sans groupes `(app)` / `(tabs)`), à passer à
 * `router.push` / `replace` / `dismissTo` et à `<Link href>`. Pas de `typedRoutes` : ce sont de
 * simples chaînes. Les identifiants sont encodés pour l'URL.
 */
export const routes = {
  home: '/',
  review: '/review',
  search: '/search',
  account: '/account',
  settings: '/settings',
  diagnostics: '/diagnostics',
  login: '/login',
  /** Import dans un NOUVEAU set. */
  importNew: '/import',
  newSet: '/sets/new',
  set: (id: string) => `/sets/${encodeURIComponent(id)}`,
  editSet: (id: string) => `/sets/${encodeURIComponent(id)}/edit`,
  /** Import dans un set existant. */
  importInto: (id: string) => `/sets/${encodeURIComponent(id)}/import`,
  flashcards: (id: string) => `/sets/${encodeURIComponent(id)}/flashcards`,
  quiz: (id: string) => `/sets/${encodeURIComponent(id)}/quiz`,
  write: (id: string) => `/sets/${encodeURIComponent(id)}/write`,
  /** Révision d'un seul set (l'onglet `review` couvre tous les sets). */
  reviewSet: (id: string) => `/sets/${encodeURIComponent(id)}/review`,
} as const
