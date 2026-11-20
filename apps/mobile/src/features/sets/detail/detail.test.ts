import { describe, expect, it } from 'vitest'
import { createdByLabel, setWebUrl, tagsLabel } from './set-meta'
import { NO_CARDS_REASON, quizUnavailableReason, studyModes } from './study-modes'

const card = (definition: string) => ({ definition })
const reasons = (cards: Array<{ definition: string }>) =>
  Object.fromEntries(studyModes(cards).map((mode) => [mode.key, mode.unavailableReason]))

describe('studyModes', () => {
  it('liste les 4 modes dans l’ordre du web, avec les textes du web', () => {
    const modes = studyModes([card('a')])
    expect(modes.map((mode) => [mode.key, mode.title])).toEqual([
      ['review', 'Répétition espacée'],
      ['flashcards', 'Flashcards'],
      ['quiz', 'Quiz'],
      ['write', 'Mode écrit'],
    ])
    expect(modes[0]?.description).toBe('Révisez chaque carte au bon moment (FSRS).')
    expect(modes[1]?.description).toBe('Retournez les cartes et notez celles à revoir.')
    expect(modes[2]?.description).toBe('Questions à choix multiples, avec un score final.')
    expect(modes[3]?.description).toBe('Tapez la réponse, corrigée avec tolérance.')
  })

  it('set vide : révision, flashcards et écrit demandent des cartes ; le quiz sa propre raison', () => {
    expect(reasons([])).toEqual({
      review: NO_CARDS_REASON,
      flashcards: NO_CARDS_REASON,
      quiz: 'Il faut au moins 4 cartes aux définitions différentes.',
      write: NO_CARDS_REASON,
    })
    expect(NO_CARDS_REASON).toBe('Ajoutez des cartes pour réviser.')
  })

  it('quiz : 4 définitions différentes suffisent, 3 non', () => {
    expect(quizUnavailableReason([card('a'), card('b'), card('c')])).toBe(
      'Il faut au moins 4 cartes aux définitions différentes.',
    )
    expect(quizUnavailableReason([card('a'), card('b'), card('c'), card('d')])).toBeUndefined()
  })

  it('quiz : des définitions identiques ne comptent qu’une fois', () => {
    const same = [card('Paris'), card('Paris'), card('paris'), card('Rome'), card('Madrid')]
    expect(quizUnavailableReason(same)).toBe(
      'Il faut au moins 4 cartes aux définitions différentes.',
    )
  })

  it('un set de 1 carte permet les trois autres modes mais pas le quiz', () => {
    const r = reasons([card('a')])
    expect(r.review).toBeUndefined()
    expect(r.flashcards).toBeUndefined()
    expect(r.write).toBeUndefined()
    expect(r.quiz).toBeDefined()
  })
})

describe('set-meta', () => {
  it('« Créé par » n’apparaît que pour un non-auteur', () => {
    expect(createdByLabel({ isOwner: true, owner: { displayName: 'Alice' } })).toBeNull()
    expect(createdByLabel({ isOwner: false, owner: { displayName: 'Alice' } })).toBe(
      'Créé par Alice',
    )
  })

  it('tags : « #nom » séparés par une espace, rien sans tag', () => {
    expect(tagsLabel([])).toBeNull()
    expect(tagsLabel([{ name: 'anglais' }, { name: 'oral' }])).toBe('#anglais #oral')
  })

  it('lien d’un set : même forme que le web (`/sets/<id>`)', () => {
    expect(setWebUrl('https://quizlet.example.com', 'abc')).toBe(
      'https://quizlet.example.com/sets/abc',
    )
  })
})
