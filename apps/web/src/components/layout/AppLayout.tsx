import { Outlet } from 'react-router'
import { ErrorState, LoadingState } from '@/components/states'
import { ApiError } from '@/lib/http'
import { useMe } from '@/lib/queries'
import { Header } from './Header'
import { SessionExpiredBanner } from './SessionExpiredBanner'

/** Structure commune : l'identité SSO (/api/me) est chargée avant d'afficher les pages. */
export function AppLayout() {
  const me = useMe()
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
