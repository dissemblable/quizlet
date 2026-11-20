/**
 * CONTRAT : extrait l'identifiant d'un set d'une saisie de l'utilisateur (onglet Recherche) :
 * - un UUID nu (« 3f2b… ») ;
 * - une URL `…/sets/<uuid>` (n'importe quel hôte, suffixe `/edit`, `/quiz`…, requête ou fragment
 *   tolérés), telle que copiée par « Copier le lien ».
 * Espaces autour ignorés ; l'UUID est renvoyé en minuscules ; `null` si rien de reconnaissable.
 * Pas d'`URL` (accesseurs incomplets sur Hermes) : regex sur la chaîne.
 */
export function parseSetReference(_input: string): string | null {
  throw new Error('non implémenté')
}
