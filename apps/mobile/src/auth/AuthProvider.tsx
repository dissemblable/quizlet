import type { ReactNode } from 'react'
import type { AuthApi } from './types'

/**
 * CONTRAT : fournit l'état d'authentification à l'arbre. Lit les jetons au montage (`loading` →
 * `signedOut` | `signedIn`), écoute `Linking 'url'` en secours de la route `/callback`.
 * `onSignedOut` : appelé APRÈS l'effacement de la session (purge du cache, annulation du rappel) ;
 * son identité doit être stable (fonction de module).
 */
export function AuthProvider({
  children,
}: {
  children: ReactNode
  onSignedOut?: () => void | Promise<void>
}) {
  return <>{children}</>
}

/** CONTRAT : état et actions d'authentification (valeurs provisoires tant que le lot B n'a pas fini). */
export function useAuth(): AuthApi {
  return {
    status: 'loading',
    signIn: async () => ({ kind: 'error', message: 'non implémenté' }),
    signOut: async () => {},
  }
}
