import { useState } from 'react'
import { View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuth } from '@/auth'
import { Banner, Button, toast } from '@/ui'

/**
 * Bannière « Session expirée » (statut `expired`), montée au-dessus du `Stack` : l'app reste
 * affichée, relancer la connexion ne démonte aucun écran. `null` dans tous les autres états.
 */
export function SessionExpiredBanner() {
  const { status, signIn } = useAuth()
  const insets = useSafeAreaInsets()
  const [busy, setBusy] = useState(false)

  if (status !== 'expired') return null

  async function reconnect() {
    if (busy) return
    setBusy(true)
    try {
      const result = await signIn()
      if (result.kind === 'error') toast.error(result.message)
      else if (result.kind === 'cancelled') toast.info('Connexion annulée.')
    } finally {
      setBusy(false)
    }
  }

  return (
    // Au-dessus du `Stack` : personne d'autre ne protège le haut de l'écran.
    <View style={{ paddingTop: insets.top }}>
      <Banner
        tone="destructive"
        title="Session expirée"
        description="Reconnectez-vous pour continuer. Vos modifications non enregistrées sont conservées."
        action={
          <Button
            size="sm"
            variant="outline"
            label="Se reconnecter"
            loading={busy}
            onPress={reconnect}
          />
        }
      />
    </View>
  )
}
