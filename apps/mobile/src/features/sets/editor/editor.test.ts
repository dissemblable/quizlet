import { LIMITS, setFormSchema, toSetInput } from '@quizlet/shared'
import { describe, expect, it } from 'vitest'
import { firstErrorTarget, moveAnnouncement, removeAnnouncement } from './card-list'
import { editorInitialValues } from './editor-values'
import { addTag, addTags, refusalMessage, splitDraft, tagSuggestions } from './tag-rules'

describe('addTag', () => {
  it('ajoute un tag nettoyé des espaces', () => {
    expect(addTag(['anglais'], '  oral ')).toEqual({ tags: ['anglais', 'oral'] })
  })

  it('ignore une saisie vide sans changer le tableau', () => {
    const tags = ['anglais']
    const result = addTag(tags, '   ')
    expect(result.refused).toBe('empty')
    expect(result.tags).toBe(tags)
  })

  it('refuse un doublon sans tenir compte de la casse', () => {
    const tags = ['Anglais']
    const result = addTag(tags, 'anglais')
    expect(result).toEqual({ tags, refused: 'duplicate' })
    expect(result.tags).toBe(tags)
  })

  it('refuse le 11e tag', () => {
    const full = Array.from({ length: LIMITS.tagsPerSet }, (_, i) => `t${i}`)
    expect(addTag(full, 'autre').refused).toBe('full')
    expect(addTag(full.slice(1), 'autre').refused).toBeUndefined()
  })

  it('refuse plus de 30 caractères, accepte exactement 30', () => {
    expect(addTag([], 'a'.repeat(LIMITS.tagName + 1)).refused).toBe('too-long')
    expect(addTag([], 'a'.repeat(LIMITS.tagName)).refused).toBeUndefined()
  })
})

describe('splitDraft / addTags', () => {
  it('chaque virgule valide le texte précédent', () => {
    expect(splitDraft('anglais')).toEqual({ names: [], rest: 'anglais' })
    expect(splitDraft('oral,')).toEqual({ names: ['oral'], rest: '' })
    expect(splitDraft('a,b, c')).toEqual({ names: ['a', 'b'], rest: ' c' })
    expect(splitDraft(',')).toEqual({ names: [''], rest: '' })
  })

  it('ajoute à la suite et liste les refus, sans signaler les saisies vides', () => {
    const result = addTags(['a'], ['b', 'B', '', ' c '])
    expect(result.tags).toEqual(['a', 'b', 'c'])
    expect(result.refused).toEqual([{ name: 'B', reason: 'duplicate' }])
  })

  it('s’arrête à 10 tags', () => {
    const names = Array.from({ length: 12 }, (_, i) => `t${i}`)
    const result = addTags([], names)
    expect(result.tags).toHaveLength(LIMITS.tagsPerSet)
    expect(result.refused.map((r) => r.reason)).toEqual(['full', 'full'])
  })

  it('messages de refus', () => {
    expect(refusalMessage('duplicate', 'oral')).toBe('Le tag « oral » est déjà ajouté.')
    expect(refusalMessage('full', 'x')).toBe('Un set ne peut pas avoir plus de 10 tags')
    expect(refusalMessage('too-long', 'x')).toBe('Un tag ne peut pas dépasser 30 caractères')
  })
})

describe('tagSuggestions', () => {
  const all = ['vocabulaire', 'Anglais', 'oral', 'grammaire']

  it('exclut les tags déjà choisis (casse ignorée)', () => {
    expect(tagSuggestions(all, ['anglais'], '')).toEqual(['vocabulaire', 'oral', 'grammaire'])
  })

  it('filtre par sous-chaîne, casse ignorée', () => {
    expect(tagSuggestions(all, [], 'AI')).toEqual(['vocabulaire', 'Anglais', 'grammaire'])
    expect(tagSuggestions(all, [], '  ora ')).toEqual(['oral'])
    expect(tagSuggestions(all, [], 'zzz')).toEqual([])
  })

  it('limite le nombre de suggestions', () => {
    const many = Array.from({ length: 30 }, (_, i) => `tag${i}`)
    expect(tagSuggestions(many, [], '')).toHaveLength(8)
    expect(tagSuggestions(many, [], '', 3)).toEqual(['tag0', 'tag1', 'tag2'])
  })
})

describe('annonces', () => {
  it('numérote les cartes à partir de 1', () => {
    expect(moveAnnouncement(0, 1)).toBe('Carte 1 déplacée en position 2.')
    expect(moveAnnouncement(4, 3)).toBe('Carte 5 déplacée en position 4.')
    expect(removeAnnouncement(2)).toBe('Carte 3 supprimée.')
  })
})

describe('editorInitialValues', () => {
  it('création : set privé vide avec 3 cartes vides', () => {
    const values = editorInitialValues()
    expect(values).toMatchObject({ title: '', description: '', visibility: 'private', tags: [] })
    expect(values.cards).toEqual([
      { term: '', definition: '' },
      { term: '', definition: '' },
      { term: '', definition: '' },
    ])
  })

  const set = {
    title: 'Capitales',
    description: null,
    visibility: 'public' as const,
    tags: [{ name: 'géo' }],
    cards: [
      { id: 'c1', term: 'France', definition: 'Paris' },
      { id: 'c2', term: 'Italie', definition: 'Rome' },
    ],
  }

  it('édition : valeurs du set, description nulle devenue vide', () => {
    const values = editorInitialValues(set)
    expect(values.description).toBe('')
    expect(values.visibility).toBe('public')
    expect(values.tags).toEqual(['géo'])
  })

  it('édition : les identifiants des cartes survivent jusqu’au corps de requête', () => {
    const body = toSetInput(setFormSchema.parse(editorInitialValues(set)))
    expect(body.cards).toEqual([
      { id: 'c1', term: 'France', definition: 'Paris' },
      { id: 'c2', term: 'Italie', definition: 'Rome' },
    ])
    expect(body.description).toBeNull()
  })

  it('édition d’un set sans carte : une ligne vide pour commencer', () => {
    expect(editorInitialValues({ ...set, cards: [] }).cards).toEqual([{ term: '', definition: '' }])
  })
})

describe('firstErrorTarget', () => {
  const error = { type: 'custom', message: 'x' }

  it('rien à signaler sans erreur', () => {
    expect(firstErrorTarget({})).toBeNull()
  })

  it('titre, description ou erreur globale des cartes : en-tête', () => {
    expect(firstErrorTarget({ title: error })).toEqual({ kind: 'header' })
    expect(firstErrorTarget({ description: error })).toEqual({ kind: 'header' })
    expect(firstErrorTarget({ cards: { root: error } })).toEqual({ kind: 'header' })
  })

  it('première carte en erreur', () => {
    expect(
      firstErrorTarget({ cards: [undefined, undefined, { term: error }, { definition: error }] }),
    ).toEqual({ kind: 'card', index: 2 })
  })

  it('l’en-tête passe avant les cartes', () => {
    expect(firstErrorTarget({ title: error, cards: [{ term: error }] })).toEqual({ kind: 'header' })
  })
})
