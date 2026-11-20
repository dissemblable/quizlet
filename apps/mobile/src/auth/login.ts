import type { CallbackParams, LoginResult } from './types'

/**
 * CONTRAT : termine la connexion à partir des paramètres reçus par `quizlet://callback`.
 * Idempotent : le `pending` (`state`, verifier) est consommé une seule fois, un second appel avec le
 * même `state` rejoint l'échange en vol (une seule requête de jetons). Vérifie `state` et `iss`
 * (RFC 9207), échange le code avec le `redirect_uri` https, enregistre les jetons, passe l'état à
 * `signedIn`. `error` / `error_description` (relayés par l'API) → `{ kind: 'error' }`. Ne rejette
 * jamais.
 */
export function completeLogin(_params: CallbackParams): Promise<LoginResult> {
  throw new Error('non implémenté')
}
