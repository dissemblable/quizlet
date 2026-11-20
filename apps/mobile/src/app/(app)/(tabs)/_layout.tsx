import { useRouter } from 'expo-router'
// `Tabs` exporté par 'expo-router' est déprécié : onglets JS.
import { Tabs } from 'expo-router/js-tabs'
import { useTabBadge } from '@/features/shell'
import { routes } from '@/lib/routes'
import { Icon, IconButton, useTheme } from '@/ui'

/** Quatre onglets : Bibliothèque (+ « + »), Révision (badge), Recherche, Compte. */
export default function TabsLayout() {
  const { colors } = useTheme()
  const router = useRouter()
  const badge = useTabBadge()

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.foreground,
        headerTitleStyle: { color: colors.foreground },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Bibliothèque',
          tabBarIcon: ({ color, size }) => <Icon name="book-open" color={color} size={size} />,
          headerRight: () => (
            <IconButton
              icon="plus"
              label="Nouveau set"
              onPress={() => router.push(routes.newSet)}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="review"
        options={{
          title: 'Révision',
          tabBarBadge: badge > 0 ? badge : undefined,
          tabBarIcon: ({ color, size }) => <Icon name="layers" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Recherche',
          tabBarIcon: ({ color, size }) => <Icon name="search" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Compte',
          tabBarIcon: ({ color, size }) => <Icon name="user" color={color} size={size} />,
        }}
      />
    </Tabs>
  )
}
