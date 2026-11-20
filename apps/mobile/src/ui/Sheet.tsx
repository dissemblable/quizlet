import type { ReactNode } from 'react'

export interface SheetProps {
  visible: boolean
  /** Appelé par le fond, la croix et le bouton Retour d'Android (`onRequestClose`). */
  onClose: () => void
  title?: string
  /** Pied collé en bas (boutons Annuler / Enregistrer). */
  footer?: ReactNode
  /** Occupe presque toute la hauteur (liste des fuseaux). Sinon hauteur du contenu. */
  fullHeight?: boolean
  /** Contenu dans un `ScrollView` (défaut : true). Mettre `false` pour y placer une `FlatList`. */
  scroll?: boolean
  children?: ReactNode
}

/**
 * CONTRAT : feuille modale du bas (`Modal` transparent, voile `colors.overlay`, clavier géré).
 * Le focus TalkBack passe dans la feuille à l'ouverture ; Retour la ferme.
 */
export function Sheet(_props: SheetProps) {
  return null
}
