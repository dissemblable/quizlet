import { describe, expect, it } from 'vitest'
import { routes } from './routes'

const ID = '3f2b8c1e-5a4d-4e7f-9b21-0c6d7e8f9a10'

describe('routes', () => {
  it('chemins fixes, sans groupes (app) / (tabs)', () => {
    expect(routes).toMatchObject({
      home: '/',
      review: '/review',
      search: '/search',
      account: '/account',
      settings: '/settings',
      diagnostics: '/diagnostics',
      login: '/login',
      importNew: '/import',
      newSet: '/sets/new',
    })
  })

  it('constructeurs de chemins d’un set', () => {
    expect(routes.set(ID)).toBe(`/sets/${ID}`)
    expect(routes.editSet(ID)).toBe(`/sets/${ID}/edit`)
    expect(routes.importInto(ID)).toBe(`/sets/${ID}/import`)
    expect(routes.flashcards(ID)).toBe(`/sets/${ID}/flashcards`)
    expect(routes.quiz(ID)).toBe(`/sets/${ID}/quiz`)
    expect(routes.write(ID)).toBe(`/sets/${ID}/write`)
    expect(routes.reviewSet(ID)).toBe(`/sets/${ID}/review`)
  })

  it('encode l’identifiant (pas d’injection de segment ni de requête)', () => {
    expect(routes.set('a b/c')).toBe('/sets/a%20b%2Fc')
    expect(routes.quiz('x?y=1#z')).toBe('/sets/x%3Fy%3D1%23z/quiz')
    expect(routes.set('../review')).toBe('/sets/..%2Freview')
  })

  it('« new » ne se confond pas avec un identifiant : /sets/new est une route fixe', () => {
    expect(routes.newSet).toBe('/sets/new')
    expect(routes.set(ID)).not.toBe(routes.newSet)
  })
})
