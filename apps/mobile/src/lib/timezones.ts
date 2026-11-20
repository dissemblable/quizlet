/**
 * CONTRAT : fuseaux IANA proposés dans les paramètres, triés. `Intl.supportedValuesOf('timeZone')`
 * si disponible (dans un try/catch : absent ou incomplet sur Hermes), sinon une liste statique.
 * `current` (fuseau déjà enregistré, éventuellement absent de la liste) est toujours inclus.
 * Pas de doublon.
 */
export function listTimeZones(_current?: string | null): string[] {
  throw new Error('non implémenté')
}
