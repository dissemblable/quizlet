import { formatDate, pluralize } from '@quizlet/shared'
import type { SetSummary } from '@/lib/queries'
import type { EmptyVariant } from './filters'

/** Libellés identiques à ceux du web (`LibraryPage`, `ReviewBanner`, dialogues de dossiers et tags). */

export function reviewSummaryText(due: number, fresh: number): string {
  return due + fresh === 0
    ? 'Rien à réviser pour le moment.'
    : `${pluralize(due, 'carte due', 'cartes dues')} · ${pluralize(fresh, 'nouvelle carte', 'nouvelles cartes')}`
}

export function hasReviewWork(due: number, fresh: number): boolean {
  return due + fresh > 0
}

export function folderSavedMessage(name: string, renamed: boolean): string {
  return renamed ? 'Dossier renommé.' : `Dossier « ${name} » créé.`
}

export function folderDeletedMessage(name: string): string {
  return `Dossier « ${name} » supprimé.`
}

export function deleteFolderConfirm(name: string): { title: string; message: string } {
  return {
    title: `Supprimer le dossier « ${name} » ?`,
    message: 'Ses sets ne sont pas supprimés : ils repassent dans « Sans dossier ».',
  }
}

export function tagDeletedMessage(name: string): string {
  return `Tag « ${name} » supprimé.`
}

/** Toast après un déplacement ; `folderName` absent = le set est sorti de son dossier. */
export function moveMessage(title: string, folderName: string | undefined): string {
  return folderName === undefined
    ? `« ${title} » est maintenant sans dossier.`
    : `« ${title} » rangé dans « ${folderName} ».`
}

export function pageLabel(page: number, count: number): string {
  return `Page ${page} sur ${count}`
}

/** Annonce TalkBack après une recherche ou un filtre. */
export function resultsAnnouncement(total: number): string {
  return total === 0 ? 'Aucun set trouvé.' : `${pluralize(total, 'set trouvé', 'sets trouvés')}.`
}

export function emptyCopy(
  variant: EmptyVariant,
  q: string,
): { title: string; description: string; actionLabel: string } {
  switch (variant) {
    case 'search':
      return {
        title: 'Aucun résultat',
        description: `Aucun de vos sets ne correspond à « ${q} ».`,
        actionLabel: 'Effacer la recherche',
      }
    case 'filters':
      return {
        title: 'Aucun set ici',
        description: 'Aucun de vos sets ne correspond à ces filtres.',
        actionLabel: 'Afficher tous les sets',
      }
    case 'library':
      return {
        title: 'Votre bibliothèque est vide',
        description:
          'Créez votre premier set de cartes, ou dupliquez un set public partagé avec vous.',
        actionLabel: 'Créer un set',
      }
  }
}

/** Libellé TalkBack d'une carte de set : tout son contenu, lu d'une traite. */
export function setCardLabel(
  set: Pick<
    SetSummary,
    'title' | 'description' | 'tags' | 'cardCount' | 'visibility' | 'updatedAt'
  >,
): string {
  return [
    set.title,
    set.description,
    set.tags.length > 0 ? `Tags : ${set.tags.map((tag) => `#${tag.name}`).join(' ')}` : null,
    pluralize(set.cardCount, 'carte'),
    set.visibility === 'public' ? 'Public' : 'Privé',
    `Modifié le ${formatDate(set.updatedAt)}`,
  ]
    .filter(Boolean)
    .join('. ')
}
