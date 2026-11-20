import { unwrap } from '@quizlet/shared'
import { useCallback, useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { api } from '@/lib/api'
import { type RuntimeCheck, runRuntimeChecks } from '@/lib/diagnostics'
import { Badge, Button, Card, ErrorState, LoadingState, Screen, spacing, Text } from '@/ui'

type State =
  | { status: 'running' }
  | { status: 'done'; checks: RuntimeCheck[] }
  | { status: 'failed'; error: unknown }

/** Diagnostic du moteur JS (Hermes) et d'un appel d'API, pour le développement. */
export function DiagnosticsScreen() {
  const [state, setState] = useState<State>({ status: 'running' })

  const run = useCallback(async () => {
    setState({ status: 'running' })
    try {
      // `unwrap` : une réponse 401 ou 5xx doit compter comme un échec du contrôle réseau.
      setState({
        status: 'done',
        checks: await runRuntimeChecks(() => unwrap(api.me.$get())),
      })
    } catch (error) {
      setState({ status: 'failed', error })
    }
  }, [])

  useEffect(() => {
    void run()
  }, [run])

  return (
    <Screen scroll padded contentContainerStyle={styles.page}>
      <Button
        label="Relancer"
        icon="refresh-cw"
        variant="outline"
        onPress={run}
        loading={state.status === 'running'}
        fullWidth
      />
      {state.status === 'running' && <LoadingState label="Contrôles en cours…" rows={4} />}
      {state.status === 'failed' && (
        <ErrorState error={state.error} title="Les contrôles ont échoué" onRetry={run} />
      )}
      {state.status === 'done' &&
        state.checks.map((check) => (
          <Card key={check.name}>
            <View
              accessible
              accessibilityLabel={`${check.name} : ${check.ok ? 'réussi' : 'échec'}. ${check.detail}`}
              style={styles.check}
            >
              <View style={styles.checkHead}>
                <Text weight="medium" style={styles.checkName}>
                  {check.name}
                </Text>
                <Badge
                  label={check.ok ? 'OK' : 'Échec'}
                  tone={check.ok ? 'success' : 'destructive'}
                />
              </View>
              <Text variant="caption" tone="muted" monospace selectable>
                {check.detail}
              </Text>
            </View>
          </Card>
        ))}
    </Screen>
  )
}

const styles = StyleSheet.create({
  page: { gap: spacing.md },
  check: { gap: spacing.xs },
  checkHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  checkName: { flex: 1 },
})
