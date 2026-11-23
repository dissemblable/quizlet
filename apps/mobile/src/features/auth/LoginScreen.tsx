import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useAuth, useLoginPhase } from '@/auth'
import { Banner, Button, Screen, Text } from '@/ui'

type Outcome = { kind: 'error'; message: string } | { kind: 'cancelled' } | null

const BUTTON_LABELS = {
  idle: 'Se connecter',
  opening: 'Ouverture du navigateur…',
  exchanging: 'Connexion en cours…',
} as const

/**
 * Écran de connexion (`/login`). Passif : il est monté derrière le splash pendant `loading`, donc
 * aucun effet de bord au montage (pas de connexion automatique).
 */
export function LoginScreen() {
  const { signIn } = useAuth()
  const phase = useLoginPhase()
  const [busy, setBusy] = useState(false)
  const [outcome, setOutcome] = useState<Outcome>(null)

  async function connect() {
    if (busy) return
    setBusy(true)
    setOutcome(null)
    try {
      const result = await signIn()
      // `signedIn` : la garde de navigation quitte cet écran toute seule.
      if (result.kind === 'error') setOutcome({ kind: 'error', message: result.message })
      else if (result.kind === 'cancelled') setOutcome({ kind: 'cancelled' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen padded edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.center}>
        <Text variant="display" weight="bold" accessibilityRole="header" align="center">
          Quizlet
        </Text>
        <Text tone="muted" align="center">
          Connectez-vous avec votre compte pour retrouver vos sets et réviser vos cartes.
        </Text>
        {outcome?.kind === 'error' ? (
          <Banner tone="destructive" title="Connexion impossible" description={outcome.message} />
        ) : null}
        {outcome?.kind === 'cancelled' ? <Banner tone="info" title="Connexion annulée" /> : null}
        <Button
          label={busy ? BUTTON_LABELS[phase === 'idle' ? 'opening' : phase] : BUTTON_LABELS.idle}
          accessibilityLabel="Se connecter"
          size="lg"
          fullWidth
          loading={busy}
          onPress={connect}
        />
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
})
