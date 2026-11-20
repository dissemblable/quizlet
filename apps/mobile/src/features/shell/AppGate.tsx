import { ApiError } from '@quizlet/shared'
import { type ReactNode, useEffect, useRef } from 'react'
import { getDeviceTimeZone } from '@/lib/device'
import { useMe, useSaveSettings, useSettings } from '@/lib/queries'
import { queryView } from '@/lib/query-state'
import { usePrefetchReviewData, useTrackUser } from '@/offline'
import { EmptyState, ErrorState, LoadingState, Screen } from '@/ui'
import { withDeviceTimeZone } from './timezone'

/**
 * Fuseau de l'appareil, enregistré une seule fois tant que l'utilisateur n'en a choisi aucun
 * (Europe/Paris s'applique d'ici là). Silencieux : pas de toast, l'échec sera retenté à la
 * prochaine ouverture. Il reste modifiable dans les paramètres.
 */
function useDetectTimeZone(enabled: boolean) {
  const settings = useSettings()
  const { mutate } = useSaveSettings()
  const sent = useRef(false)
  const current = settings.data

  useEffect(() => {
    if (!enabled || sent.current || !current) return
    const next = withDeviceTimeZone(current, getDeviceTimeZone())
    if (!next) return
    sent.current = true
    mutate(next)
  }, [enabled, current, mutate])
}

function GateScreen({ children }: { children: ReactNode }) {
  return (
    <Screen padded edges={['top', 'bottom', 'left', 'right']}>
      {children}
    </Screen>
  )
}

/**
 * Structure commune des écrans connectés : l'identité SSO (`/api/me`) est chargée avant de les
 * afficher. Des données en cache suffisent (hors ligne, l'app doit s'ouvrir).
 */
export function AppGate({ children }: { children: ReactNode }) {
  const me = useMe()
  useTrackUser(me.data?.user.id)
  usePrefetchReviewData()
  useDetectTimeZone(me.data !== undefined)

  if (me.data !== undefined) return <>{children}</>

  const view = queryView(me)
  if (view === 'loading') {
    return (
      <GateScreen>
        <LoadingState label="Chargement de votre profil…" />
      </GateScreen>
    )
  }
  if (view === 'offline') {
    return (
      <GateScreen>
        <EmptyState
          icon="wifi-off"
          title="Vous êtes hors ligne"
          description="Connectez-vous à Internet pour charger votre profil."
        />
      </GateScreen>
    )
  }
  // Session expirée : la bannière de session propose déjà de se reconnecter.
  if (me.error instanceof ApiError && me.error.needsLogin) return null
  return (
    <GateScreen>
      <ErrorState
        error={me.error}
        title="Impossible de charger votre profil"
        onRetry={() => me.refetch()}
      />
    </GateScreen>
  )
}
