export interface LoadingStateProps {
  /** Texte annoncé à TalkBack (et affiché sous l'indicateur). Défaut : « Chargement… ». */
  label?: string
  /** Nombre de lignes de squelette (si le composant en dessine). Défaut : 3. */
  rows?: number
}

/** CONTRAT : état de chargement d'une page (`accessibilityLiveRegion="polite"`, `aria-busy`). */
export function LoadingState(_props: LoadingStateProps) {
  return null
}
