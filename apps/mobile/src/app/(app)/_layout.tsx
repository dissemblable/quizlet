import { Stack } from 'expo-router'
import { AppGate } from '@/features/shell'
import { useTheme } from '@/ui'

// Un lien profond vers un écran (`/sets/…`) garde les onglets en bas de la pile (retour → accueil).
export const unstable_settings = { anchor: '(tabs)' }

/**
 * Pile des écrans connectés. Les titres ci-dessous sont des valeurs par défaut : un écran peut les
 * remplacer (titre du set…) avec `<Stack.Screen options={{ title }} />` dans son propre rendu.
 */
export default function AppLayout() {
  const { colors } = useTheme()
  return (
    <AppGate>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.card },
          headerTintColor: colors.foreground,
          headerTitleStyle: { color: colors.foreground },
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ title: 'Paramètres' }} />
        <Stack.Screen name="diagnostics" options={{ title: 'Diagnostics' }} />
        <Stack.Screen name="import" options={{ title: 'Importer des cartes' }} />
        <Stack.Screen name="sets/new" options={{ title: 'Nouveau set' }} />
        <Stack.Screen name="sets/[id]/index" options={{ title: 'Set' }} />
        <Stack.Screen name="sets/[id]/edit" options={{ title: 'Modifier le set' }} />
        <Stack.Screen name="sets/[id]/import" options={{ title: 'Importer des cartes' }} />
        <Stack.Screen name="sets/[id]/flashcards" options={{ title: 'Flashcards' }} />
        <Stack.Screen name="sets/[id]/quiz" options={{ title: 'Quiz' }} />
        <Stack.Screen name="sets/[id]/write" options={{ title: 'Mode écrit' }} />
        <Stack.Screen name="sets/[id]/review" options={{ title: 'Révision' }} />
      </Stack>
    </AppGate>
  )
}
