import { ApiError } from '@quizlet/shared'
import { describe, expect, it } from 'vitest'
import {
  noResultMessage,
  referenceLabel,
  resultSubtitle,
  SEARCH_LABEL,
  SEARCH_PLACEHOLDER,
  searchAnnouncement,
} from './search-text'

describe('textes de la recherche', () => {
  it('reprend le libellé du web', () => {
    expect(SEARCH_LABEL).toBe("Titre, description, tag ou contenu d'une carte")
    expect(SEARCH_PLACEHOLDER).toBe("Titre, description, tag ou contenu d'une carte…")
    expect(noResultMessage('zzz')).toBe('Aucun set ne correspond à « zzz ».')
  })

  it('décrit un résultat : cartes puis tags', () => {
    expect(resultSubtitle(3, [{ name: 'europe' }])).toBe('3 cartes · #europe')
    expect(resultSubtitle(1, [])).toBe('1 carte')
    expect(resultSubtitle(0, [{ name: 'a' }, { name: 'b' }])).toBe('0 carte · #a · #b')
    expect(resultSubtitle(1200, [])).toBe('1 200 cartes')
  })

  it('nomme la ligne « Ouvrir le set »', () => {
    expect(referenceLabel('abc')).toBe('Ouvrir le set abc')
  })
})

describe('annonce des résultats', () => {
  it('se tait pour une recherche vide ou en cours', () => {
    expect(searchAnnouncement('', { kind: 'done', total: 3 })).toBe('')
    expect(searchAnnouncement('paris', { kind: 'pending' })).toBe('')
  })

  it('annonce le nombre de résultats', () => {
    expect(searchAnnouncement('paris', { kind: 'done', total: 0 })).toBe('0 résultat')
    expect(searchAnnouncement('paris', { kind: 'done', total: 1 })).toBe('1 résultat')
    expect(searchAnnouncement('paris', { kind: 'done', total: 12 })).toBe('12 résultats')
  })

  it('annonce le message de l’erreur', () => {
    const error = new ApiError(500, 'UNKNOWN', 'Le serveur a rencontré une erreur.')
    expect(searchAnnouncement('paris', { kind: 'error', error })).toBe(
      'Le serveur a rencontré une erreur.',
    )
  })
})
