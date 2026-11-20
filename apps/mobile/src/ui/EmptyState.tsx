import type { ReactNode } from 'react'
import type { IconName } from './Icon'

export interface EmptyStateProps {
  icon?: IconName
  title: string
  description?: string
  /** Bouton d'action (un `<Button …/>`). */
  action?: ReactNode
}

/** CONTRAT : état vide centré (icône dans un disque, titre, description, action). Titre = en-tête TalkBack. */
export function EmptyState(_props: EmptyStateProps) {
  return null
}
