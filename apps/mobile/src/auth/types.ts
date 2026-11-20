/**
 * CONTRAT : types purs de l'authentification (importables par les modules purs et les tests).
 * - `loading` : état initial, avant la lecture du stockage sécurisé (splash maintenu) ;
 * - `signedOut` : pas de session (écran de connexion) ;
 * - `signedIn` : session valide ;
 * - `expired` : session morte (refresh refusé) : l'app reste affichée, bannière « Se reconnecter ».
 */
export type AuthStatus = 'loading' | 'signedOut' | 'signedIn' | 'expired'

/** Résultat d'une tentative de connexion (`signIn`, `completeLogin`). */
export type LoginResult =
  | { kind: 'signedIn' }
  | { kind: 'cancelled' }
  | { kind: 'error'; message: string }

/** Ce que le relais de l'API renvoie à `quizlet://callback` (paramètres de requête, tous facultatifs). */
export interface CallbackParams {
  code?: string
  state?: string
  iss?: string
  error?: string
  error_description?: string
}

/** Valeur de `useAuth()`. */
export interface AuthApi {
  status: AuthStatus
  /** Lance le parcours OIDC (Custom Tab). Ne rejette jamais : les échecs sont dans le résultat. */
  signIn(): Promise<LoginResult>
  /** Révoque le refresh token (au mieux), efface la session locale, puis `onSignedOut`. */
  signOut(): Promise<void>
}
