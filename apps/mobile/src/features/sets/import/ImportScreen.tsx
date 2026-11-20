/**
 * CONTRAT : import de cartes, sans props. Servi par `/import` (nouveau set : pas d'`id`) ET
 * `/sets/[id]/import` (set existant : `useIdParam()` non vide → `SetGate ownerOnly` avec le titre
 * « Import réservé à l'auteur »). Parité avec `ImportPage`.
 */
export function ImportScreen() {
  return null
}
