export interface AvatarProps {
  /** Nom affiché de l'utilisateur : les initiales viennent de `initials` de `@quizlet/shared`. */
  name: string
  /** Diamètre en dp. Défaut : 40. */
  size?: number
}

/** CONTRAT : pastille d'initiales (compte). Décorative : le nom est lu à côté. */
export function Avatar(_props: AvatarProps) {
  return null
}
