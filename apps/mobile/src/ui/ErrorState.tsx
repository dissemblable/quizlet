export interface ErrorStateProps {
  /** Erreur affichée via `errorMessage(error)` de `@quizlet/shared`. */
  error: unknown
  /** Défaut : « Impossible de charger les données ». */
  title?: string
  /** Présent : bouton « Réessayer ». */
  onRetry?: () => void
}

/** CONTRAT : erreur de chargement (bannière destructive + « Réessayer »), annoncée à TalkBack. */
export function ErrorState(_props: ErrorStateProps) {
  return null
}
