import { pluralize } from '@quizlet/shared'

interface NetworkStatus {
  online: boolean
  /** Notes de révision en attente d'envoi. */
  pendingGrades: number
}

/** Ligne d'état réseau du compte ; `null` quand tout est en ordre (rien à afficher). */
export function offlineStatusText({ online, pendingGrades }: NetworkStatus): string | null {
  const pending =
    pendingGrades > 0 ? `${pluralize(pendingGrades, 'note')} en attente de synchronisation` : null
  if (online) return pending
  return pending ? `Hors ligne · ${pending}` : 'Hors ligne'
}

/** Confirmation avant déconnexion : plus appuyée s'il reste des notes que la déconnexion effacerait. */
export function signOutConfirmation(pendingGrades: number): {
  title: string
  message: string
  confirmLabel: string
} {
  const lost =
    pendingGrades > 0
      ? `${pluralize(pendingGrades, 'note')} en attente de synchronisation ${pendingGrades > 1 ? 'seront perdues' : 'sera perdue'}. Reconnectez-vous à Internet pour les envoyer avant de vous déconnecter.`
      : null
  return {
    title: 'Se déconnecter ?',
    message: lost ?? 'Vous devrez vous reconnecter pour accéder à vos sets.',
    confirmLabel: lost ? 'Se déconnecter quand même' : 'Se déconnecter',
  }
}
