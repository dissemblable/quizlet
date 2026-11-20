const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const BARE = new RegExp(`^(${UUID})$`, 'i')
// Hôte et préfixe de chemin quelconques ; l'UUID doit être suivi de la fin, `/`, `?` ou `#`.
const URL_FORM = new RegExp(`^https?://[^/\\s?#]+(?:/[^\\s?#]*)?/sets/(${UUID})(?=[/?#]|$)`, 'i')

/**
 * Extrait l'identifiant d'un set d'une saisie de l'utilisateur (onglet Recherche) :
 * - un UUID nu (« 3f2b… ») ;
 * - une URL `…/sets/<uuid>` (n'importe quel hôte, suffixe `/edit`, `/quiz`…, requête ou fragment
 *   tolérés), telle que copiée par « Copier le lien ».
 * Espaces autour ignorés ; l'UUID est renvoyé en minuscules ; `null` si rien de reconnaissable.
 * Pas d'`URL` (accesseurs incomplets sur Hermes) : regex sur la chaîne.
 */
export function parseSetReference(input: string): string | null {
  const text = input.trim()
  const match = BARE.exec(text) ?? URL_FORM.exec(text)
  return match?.[1]?.toLowerCase() ?? null
}
