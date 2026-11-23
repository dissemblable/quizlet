import { errorMessage } from '@quizlet/shared'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useAuth } from '@/auth'
import { useMe } from '@/lib/queries'
import { routes } from '@/lib/routes'
import { useOfflineStatus } from '@/offline'
import { Avatar, Banner, Button, Card, confirm, ListItem, Screen, spacing, Text, toast } from '@/ui'
import { AppearanceSection } from './AppearanceSection'
import { offlineStatusText, signOutConfirmation } from './account-text'

/** Onglet Compte : identité, Paramètres, état du réseau, apparence, déconnexion. */
export function AccountScreen() {
  const router = useRouter()
  const { signOut } = useAuth()
  const { data } = useMe()
  const { online, pendingGrades } = useOfflineStatus()
  const [signingOut, setSigningOut] = useState(false)
  const status = offlineStatusText({ online, pendingGrades })

  async function onSignOut() {
    const confirmed = await confirm({
      ...signOutConfirmation(pendingGrades),
      destructive: pendingGrades > 0,
    })
    if (!confirmed) return
    setSigningOut(true)
    try {
      await signOut()
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <Screen scroll padded contentContainerStyle={styles.page}>
      {data && (
        <Card>
          <View style={styles.identity}>
            <Avatar name={data.user.displayName} size={48} />
            <View style={styles.identityText}>
              <Text variant="heading" numberOfLines={1}>
                {data.user.displayName}
              </Text>
              {data.user.email ? (
                <Text variant="label" tone="muted" numberOfLines={1}>
                  {data.user.email}
                </Text>
              ) : null}
            </View>
          </View>
        </Card>
      )}
      {status !== null && <Banner tone={online ? 'info' : 'warning'} title={status} />}
      <View style={styles.rows}>
        <ListItem title="Paramètres" icon="settings" onPress={() => router.push(routes.settings)} />
        {__DEV__ && (
          <ListItem
            title="Diagnostics"
            icon="activity"
            onPress={() => router.push(routes.diagnostics)}
          />
        )}
      </View>
      <AppearanceSection />
      <Button
        label="Se déconnecter"
        variant="outline"
        icon="log-out"
        onPress={onSignOut}
        loading={signingOut}
        fullWidth
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  page: { gap: spacing.lg },
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  identityText: { flex: 1 },
  rows: { gap: spacing.xs },
})
