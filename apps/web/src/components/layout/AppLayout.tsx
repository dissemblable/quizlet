import { useEffect, useRef } from 'react'
import { Outlet, useLocation } from 'react-router'
import { ErrorState, LoadingState } from '@/components/states'
import { ApiError } from '@/lib/http'
import { useMe, useSaveSettings, useSettings } from '@/lib/queries'
import { Header } from './Header'
import { SessionExpiredBanner } from './SessionExpiredBanner'

/**
 * À chaque changement de page (chemin, pas paramètres de recherche), le focus passe au contenu
 * principal : un lecteur d'écran repart du début de la nouvelle page.
 */
function useFocusMainOnNavigation() {
  const main = useRef<HTMLElement>(null)
  const { pathname } = useLocation()
  const previous = useRef(pathname)

  useEffect(() => {
    if (previous.current === pathname) return
    previous.current = pathname
    main.current?.focus({ preventScroll: true })
    window.scrollTo({ top: 0 })
  }, [pathname])

  return main
}

/**
 * Fuseau horaire du navigateur, enregistré une seule fois tant que l'utilisateur n'en a choisi
 * aucun (Europe/Paris s'applique d'ici là). Il reste modifiable dans les paramètres.
 */
function useDetectTimeZone() {
  const settings = useSettings()
  const { mutate } = useSaveSettings()
  const sent = useRef(false)

  useEffect(() => {
    if (sent.current || !settings.data || settings.data.timezone !== null) return
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (!timezone) return
    sent.current = true
    mutate({ ...settings.data, timezone })
  }, [settings.data, mutate])
}

/** Structure commune : l'identité SSO (/api/me) est chargée avant d'afficher les pages. */
export function AppLayout() {
  const me = useMe()
  const main = useFocusMainOnNavigation()
  useDetectTimeZone()
  const needsLogin = me.error instanceof ApiError && me.error.needsLogin

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#contenu"
        className="sr-only rounded-md bg-background px-3 py-2 text-sm font-medium shadow focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50"
      >
        Aller au contenu
      </a>
      <Header />
      <SessionExpiredBanner />
      <main
        ref={main}
        id="contenu"
        tabIndex={-1}
        className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 outline-none sm:py-10"
      >
        {me.isPending ? (
          <LoadingState label="Chargement de votre profil…" />
        ) : me.isError ? (
          // Session expirée : la bannière ci-dessus propose déjà de se reconnecter.
          !needsLogin && (
            <ErrorState
              error={me.error}
              title="Impossible de charger votre profil"
              onRetry={() => me.refetch()}
            />
          )
        ) : (
          <Outlet />
        )}
      </main>
    </div>
  )
}
