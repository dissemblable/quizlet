import Feather from '@expo/vector-icons/Feather'
import { useFonts } from 'expo-font'
import { type ErrorBoundaryProps, router, Stack } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'
import { View } from 'react-native'
import { AuthProvider, useAuth } from '@/auth'
import { SessionExpiredBanner } from '@/features/auth'
import { routes } from '@/lib/routes'
import { cancelReminder, NotificationTapHandler, useReminderSync } from '@/notifications'
import { AppQueryProvider, OfflineBanner, purgeUserData } from '@/offline'
import { Button, EmptyState, Screen, ThemeProvider, useTheme } from '@/ui'

// Le splash reste affiché jusqu'à `SplashScreen.hide()` (session lue ET police d'icônes chargée).
// Un échec ici ne ferait que masquer le splash plus tôt : on l'ignore.
SplashScreen.preventAutoHideAsync().catch(() => {})

// Fonction de module : identité stable (le fournisseur d'auth ne doit pas la voir changer).
async function onSignedOut() {
  await purgeUserData()
  await cancelReminder()
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider onSignedOut={onSignedOut}>
        <AppQueryProvider>
          <RootContent />
        </AppQueryProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}

/** Dans les fournisseurs : lit l'état d'auth, monte le rappel, le splash et la navigation. */
function RootContent() {
  const { status } = useAuth()
  const { colors } = useTheme()
  const [fontsLoaded, fontError] = useFonts(Feather.font)
  useReminderSync()

  // Une police qui échoue ne doit pas bloquer l'app : les icônes seraient seulement absentes.
  const ready = status !== 'loading' && (fontsLoaded || fontError !== null)
  useEffect(() => {
    if (ready) SplashScreen.hide()
  }, [ready])

  const signedIn = status === 'signedIn' || status === 'expired'

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style="auto" />
      <OfflineBanner />
      <SessionExpiredBanner />
      {/* Le `Stack` est monté dès le premier rendu (expo-router refuse une navigation avant).
          `loading` appartient à la garde de `login` : derrière le splash, `login` est la route
          active, jamais `callback` (seule route hors garde, qui resterait affichée ensuite). */}
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={signedIn} redirectTo={routes.login}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn} redirectTo={routes.home}>
          <Stack.Screen name="login" />
        </Stack.Protected>
        <Stack.Screen name="callback" />
      </Stack>
      <NotificationTapHandler />
    </View>
  )
}

/**
 * Remplace TOUT l'arbre racine (fournisseurs compris) : seuls les composants de `ui`, qui doivent
 * fonctionner sans `ThemeProvider`, sont utilisables ici.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    console.error(error)
    // Une erreur avant la fin du chargement laisserait le splash affiché pour toujours.
    SplashScreen.hide()
  }, [error])

  async function goHome() {
    try {
      await retry()
      router.replace(routes.home)
    } catch (retryError) {
      console.error(retryError)
    }
  }

  return (
    <Screen padded edges={['top', 'bottom', 'left', 'right']}>
      <EmptyState
        icon="alert-triangle"
        title="Quelque chose s'est mal passé"
        description="Une erreur inattendue a interrompu l'affichage de la page."
        action={<Button label="Revenir à l'accueil" onPress={goHome} />}
      />
    </Screen>
  )
}
