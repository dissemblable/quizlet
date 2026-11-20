import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { completeLogin, useAuth } from '@/auth'
import { routes } from '@/lib/routes'
import { Button, LoadingState, Screen, Text } from '@/ui'
import { noParamsAction, type RawCallbackParams, readCallbackParams } from './callback-params'

function leave(wasExpired: boolean) {
  // CONTRAT : `replace(home)` détruirait la pile `(app)` (un éditeur non enregistré, par exemple)
  // que la bannière « Session expirée » promet de conserver. Le lien profond pousse `/callback`
  // PAR-DESSUS cette pile : `back()` la retrouve. Non vérifié sur appareil.
  if (wasExpired && router.canGoBack()) router.back()
  else router.replace(routes.home)
}

/** Nouvelle tentative : l'écran de connexion, ou (session `expired`) l'app, où la bannière relance. */
function retry(wasExpired: boolean) {
  if (wasExpired) leave(true)
  else router.replace(routes.login)
}

/**
 * Route `/callback` (cible de `quizlet://callback?…`), HORS garde d'auth. Chemin canonique de la
 * connexion : `completeLogin` est idempotent (par `state`), l'écouteur `Linking` de `AuthProvider`
 * et le résultat d'`openAuthSessionAsync` n'en sont que des doublons.
 */
export function CallbackScreen() {
  const raw = useLocalSearchParams<RawCallbackParams>()
  const { status } = useAuth()
  const params = readCallbackParams(raw)
  const [failure, setFailure] = useState<string | null>(null)
  // Re-connexion depuis la bannière : l'app est déjà affichée dessous (`expired`).
  const wasExpired = useRef(status === 'expired')

  const hasParams = params !== null
  const code = params?.code
  const state = params?.state
  const iss = params?.iss
  const error = params?.error
  const errorDescription = params?.error_description

  useEffect(() => {
    if (!hasParams) return
    let alive = true
    // Idempotent : la double exécution des effets (dev) rejoint la même connexion en cours.
    void completeLogin({ code, state, iss, error, error_description: errorDescription }).then(
      (result) => {
        if (!alive) return
        if (result.kind === 'signedIn') leave(wasExpired.current)
        else if (result.kind === 'error') setFailure(result.message)
        else retry(wasExpired.current)
      },
    )
    return () => {
      alive = false
    }
  }, [hasParams, code, state, iss, error, errorDescription])

  // Route ouverte sans paramètre (lien manuel, rechargement) : on suit la session.
  useEffect(() => {
    if (hasParams) return
    const action = noParamsAction(status)
    if (action === 'home') leave(wasExpired.current)
    else if (action === 'login') router.replace(routes.login)
  }, [hasParams, status])

  if (failure !== null) {
    return (
      <Screen padded edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.center}>
          <Text variant="heading" accessibilityRole="header" align="center">
            Connexion impossible
          </Text>
          <Text tone="muted" align="center" accessibilityLiveRegion="polite">
            {failure}
          </Text>
          <Button label="Réessayer" onPress={() => retry(wasExpired.current)} />
        </View>
      </Screen>
    )
  }
  return (
    <Screen padded edges={['top', 'bottom', 'left', 'right']}>
      <LoadingState label="Connexion en cours…" />
    </Screen>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
})
