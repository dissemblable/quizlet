import { type ReactNode, useEffect, useMemo, useSyncExternalStore } from 'react'
import { config } from '@/config'
import { addUrlListener } from './adapters'
import { parseCallbackUrl } from './callback-url'
import type { LoginPhase } from './login'
import { completeLogin, login, session, setSignedOutHandler } from './runtime'
import { getAuthStatus, subscribeAuthStatus } from './status'
import type { AuthApi } from './types'

const noop = () => {}

/**
 * Au montage : lit le stockage sécurisé (`loading` → `signedIn` | `signedOut`), réessaie une
 * révocation en attente, écoute `Linking 'url'` en secours de la route `/callback` (`completeLogin`
 * dédoublonne) et branche `onSignedOut`. L'état vit dans le module (`status.ts`) : `useAuth` n'a pas
 * besoin de contexte.
 */
export function AuthProvider({
  children,
  onSignedOut,
}: {
  children: ReactNode
  onSignedOut?: () => void | Promise<void>
}) {
  useEffect(() => {
    setSignedOutHandler(onSignedOut)
    return () => setSignedOutHandler(undefined)
  }, [onSignedOut])

  useEffect(() => {
    // `init` ne rejette jamais ; la révocation en attente ne doit pas retarder la sortie de `loading`.
    void session
      .init()
      .then(() => session.retryPendingRevocation())
      .catch(noop)
  }, [])

  useEffect(
    () =>
      addUrlListener((url) => {
        const params = parseCallbackUrl(url, config.callbackUrl)
        if (params) void completeLogin(params)
      }),
    [],
  )

  return <>{children}</>
}

/** État et actions d'authentification. */
export function useAuth(): AuthApi {
  const status = useSyncExternalStore(subscribeAuthStatus, getAuthStatus)
  return useMemo(
    () => ({
      status,
      signIn: () => login.startLogin(),
      signOut: () => session.signOut().catch(noop),
    }),
    [status],
  )
}

/** Avancement d'une connexion (`opening` : Custom Tab ; `exchanging` : échange du code). */
export function useLoginPhase(): LoginPhase {
  return useSyncExternalStore(login.phase.subscribe, login.phase.get)
}
