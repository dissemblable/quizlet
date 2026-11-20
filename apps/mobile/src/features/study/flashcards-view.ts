import { type FlashcardMark, type FlashcardsProgress, pluralize } from '@quizlet/shared'
import { flipAnnouncement } from '@/ui/logic'

export function positionLabel(progress: FlashcardsProgress, finished: boolean): string {
  return finished ? 'Session terminée' : `Carte ${progress.position} sur ${progress.total}`
}

export function countsLabel({ known, review }: FlashcardsProgress): string {
  return `Je sais : ${known} · À revoir : ${review}`
}

export function markLabel(mark: FlashcardMark): string {
  return mark === 'known' ? 'Marquée « Je sais »' : 'Marquée « À revoir »'
}

/** Face annoncée à TalkBack (le web la place dans une zone `aria-live`). */
export function faceAnnouncement(
  card: { term: string; definition: string },
  flipped: boolean,
): string {
  return flipAnnouncement(flipped, card.term, card.definition)
}

export function recapSubtitle(total: number): string {
  return `Vous avez parcouru ${pluralize(total, 'carte')}.`
}

export function recapAnnouncement(total: number): string {
  return `Session terminée. ${recapSubtitle(total)}`
}

export function reviewAgainLabel(review: number): string {
  return review === 1 ? 'Réviser la carte à revoir' : `Réviser les ${review} cartes à revoir`
}

/** Les cartes d'`ids` (dans cet ordre), en ignorant celles qui ont disparu du set. */
export function pickCards<T extends { id: string }>(
  ids: readonly string[],
  cards: readonly T[],
): T[] {
  const byId = new Map(cards.map((card) => [card.id, card]))
  return ids.flatMap((id) => {
    const card = byId.get(id)
    return card ? [card] : []
  })
}
