import { pluralize } from '@quizlet/shared'

/** Notes terminées depuis le dernier compte rendu (seules celles qui ont attendu comptent). */
export interface SyncTally {
  /** Appliquées par le serveur. */
  synced: number
  /** Reçues mais non appliquées (déjà connues, trop anciennes). */
  ignored: number
  /** Refus définitifs (carte supprimée…) : la note est perdue. */
  dropped: number
}

export interface SyncReport {
  message: string
  kind: 'info' | 'error'
}

export const emptyTally = (): SyncTally => ({ synced: 0, ignored: 0, dropped: 0 })

const agree = (count: number, word: string) => (count >= 2 ? `${word}s` : word)

/** Texte du toast de fin de synchronisation, ou `null` s'il n'y a rien à dire. */
export function syncReport(tally: SyncTally): SyncReport | null {
  const parts: string[] = []
  if (tally.synced > 0) {
    const ignored =
      tally.ignored > 0 ? ` (${tally.ignored} ${agree(tally.ignored, 'ignorée')})` : ''
    parts.push(
      `${pluralize(tally.synced, 'note')} ${agree(tally.synced, 'synchronisée')}${ignored}`,
    )
  } else if (tally.ignored > 0) {
    parts.push(`${pluralize(tally.ignored, 'note')} ${agree(tally.ignored, 'ignorée')}`)
  }
  if (tally.dropped > 0) {
    parts.push(
      `${pluralize(tally.dropped, 'note')} ${agree(tally.dropped, 'abandonnée')} (refus définitif du serveur)`,
    )
  }
  if (parts.length === 0) return null
  return { message: parts.join(' · '), kind: tally.dropped > 0 ? 'error' : 'info' }
}
