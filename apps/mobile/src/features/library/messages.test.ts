import { formatDate } from '@quizlet/shared'
import { describe, expect, it } from 'vitest'
import {
  deleteFolderConfirm,
  emptyCopy,
  folderDeletedMessage,
  folderSavedMessage,
  hasReviewWork,
  moveMessage,
  pageLabel,
  resultsAnnouncement,
  reviewSummaryText,
  setCardLabel,
  tagDeletedMessage,
} from './messages'

describe('reviewSummaryText', () => {
  it('rien à réviser quand tout est à zéro', () => {
    expect(reviewSummaryText(0, 0)).toBe('Rien à réviser pour le moment.')
    expect(hasReviewWork(0, 0)).toBe(false)
  })

  it('accorde chaque compteur (singulier jusqu’à 1, pluriel dès 2)', () => {
    expect(reviewSummaryText(1, 0)).toBe('1 carte due · 0 nouvelle carte')
    expect(reviewSummaryText(3, 1)).toBe('3 cartes dues · 1 nouvelle carte')
    expect(reviewSummaryText(0, 12)).toBe('0 carte due · 12 nouvelles cartes')
    expect(hasReviewWork(0, 1)).toBe(true)
    expect(hasReviewWork(2, 0)).toBe(true)
  })
})

describe('messages de dossier et de tag', () => {
  it('création et renommage', () => {
    expect(folderSavedMessage('Langues', false)).toBe('Dossier « Langues » créé.')
    expect(folderSavedMessage('Langues', true)).toBe('Dossier renommé.')
  })

  it('suppression de dossier et de tag', () => {
    expect(folderDeletedMessage('Langues')).toBe('Dossier « Langues » supprimé.')
    expect(deleteFolderConfirm('Langues')).toEqual({
      title: 'Supprimer le dossier « Langues » ?',
      message: 'Ses sets ne sont pas supprimés : ils repassent dans « Sans dossier ».',
    })
    expect(tagDeletedMessage('anglais')).toBe('Tag « anglais » supprimé.')
  })
})

describe('moveMessage', () => {
  it('range dans un dossier ou retire du dossier', () => {
    expect(moveMessage('Anglais', 'Langues')).toBe('« Anglais » rangé dans « Langues ».')
    expect(moveMessage('Anglais', undefined)).toBe('« Anglais » est maintenant sans dossier.')
  })
})

describe('pagination et annonces', () => {
  it('pageLabel', () => {
    expect(pageLabel(2, 5)).toBe('Page 2 sur 5')
  })

  it('resultsAnnouncement', () => {
    expect(resultsAnnouncement(0)).toBe('Aucun set trouvé.')
    expect(resultsAnnouncement(1)).toBe('1 set trouvé.')
    expect(resultsAnnouncement(12)).toBe('12 sets trouvés.')
  })
})

describe('emptyCopy', () => {
  it('un texte par variante, la recherche est citée', () => {
    expect(emptyCopy('search', 'zzz')).toEqual({
      title: 'Aucun résultat',
      description: 'Aucun de vos sets ne correspond à « zzz ».',
      actionLabel: 'Effacer la recherche',
    })
    expect(emptyCopy('filters', '')).toMatchObject({
      title: 'Aucun set ici',
      actionLabel: 'Afficher tous les sets',
    })
    expect(emptyCopy('library', '')).toMatchObject({
      title: 'Votre bibliothèque est vide',
      actionLabel: 'Créer un set',
    })
  })
})

describe('setCardLabel', () => {
  const updatedAt = '2026-10-09T12:00:00.000Z'

  it('résume titre, description, tags, cartes, visibilité et date', () => {
    const label = setCardLabel({
      title: 'Capitales',
      description: 'Pays et capitales',
      tags: [
        { id: 't1', name: 'géo' },
        { id: 't2', name: 'europe' },
      ],
      cardCount: 12,
      visibility: 'public',
      updatedAt,
    })
    expect(label).toBe(
      `Capitales. Pays et capitales. Tags : #géo #europe. 12 cartes. Public. Modifié le ${formatDate(updatedAt)}`,
    )
  })

  it('saute la description et les tags absents', () => {
    const label = setCardLabel({
      title: 'Chimie',
      description: null,
      tags: [],
      cardCount: 1,
      visibility: 'private',
      updatedAt,
    })
    expect(label).toBe(`Chimie. 1 carte. Privé. Modifié le ${formatDate(updatedAt)}`)
  })
})
