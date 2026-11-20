export interface RuntimeCheck {
  /** Libellé court (« Intl.supportedValuesOf », « \p{M} »…). */
  name: string
  ok: boolean
  /** Valeur observée ou message d'erreur. */
  detail: string
}

/**
 * CONTRAT : diagnostic du moteur Hermes (écran Diagnostics, visible en `__DEV__` seulement) :
 * `Intl` (supportedValuesOf, DateTimeFormat avec `timeZone`), `normalize('NFD')`, `\p{M}` / `\p{P}`,
 * `toLocale*`, ES2023 absent (`toSorted`)… Chaque contrôle est isolé (try/catch) : un échec ne
 * masque pas les autres. `probe` : appel d'API injecté par l'écran (`() => unwrap(api.me.$get())`),
 * sans quoi ce module importerait `api` et ne serait plus testable sous Node ; absent = contrôle
 * réseau omis.
 */
export function runRuntimeChecks(_probe?: () => Promise<unknown>): Promise<RuntimeCheck[]> {
  throw new Error('non implémenté')
}
