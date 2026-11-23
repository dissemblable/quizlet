import { errorMessage } from '@quizlet/shared'
import { StyleSheet, View } from 'react-native'
import { Banner } from './Banner'
import { Button } from './Button'
import { spacing } from './tokens'

export interface ErrorStateProps {
  /** Erreur affichée via `errorMessage(error)` de `@quizlet/shared`. */
  error: unknown
  /** Défaut : « Impossible de charger les données ». */
  title?: string
  /** Présent : bouton « Réessayer ». */
  onRetry?: () => void
}

/** CONTRAT : erreur de chargement (bannière destructive + « Réessayer »), annoncée à TalkBack. */
export function ErrorState({
  error,
  title = 'Impossible de charger les données',
  onRetry,
}: ErrorStateProps) {
  return (
    <View style={styles.root}>
      <Banner
        tone="destructive"
        title={title}
        description={errorMessage(error)}
        action={
          onRetry !== undefined ? (
            <Button
              label="Réessayer"
              icon="refresh-cw"
              variant="outline"
              size="sm"
              onPress={onRetry}
            />
          ) : undefined
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({ root: { padding: spacing.lg } })
