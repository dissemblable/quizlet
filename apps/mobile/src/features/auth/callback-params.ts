import type { AuthStatus, CallbackParams } from '@/auth/types'

/** Ce que `useLocalSearchParams` renvoie : une valeur, ou un tableau si le paramètre est répété. */
export type RawCallbackParams = Record<string, string | string[] | undefined>

const KEYS = ['code', 'state', 'iss', 'error', 'error_description'] as const

/**
 * Paramètres du callback, `null` si la route est ouverte sans aucun (lien manuel, rechargement).
 * Seuls les cinq champs du relais sont lus ; un paramètre répété garde sa première valeur.
 */
export function readCallbackParams(raw: RawCallbackParams): CallbackParams | null {
  const params: CallbackParams = {}
  for (const key of KEYS) {
    const value = raw[key]
    const first = Array.isArray(value) ? value[0] : value
    if (first !== undefined && first !== '') params[key] = first
  }
  return Object.keys(params).length > 0 ? params : null
}

export type NoParamsAction = 'wait' | 'home' | 'login'

/** Route ouverte SANS paramètre : où aller selon la session (`loading` : attendre la lecture). */
export function noParamsAction(status: AuthStatus): NoParamsAction {
  if (status === 'loading') return 'wait'
  return status === 'signedOut' ? 'login' : 'home'
}
