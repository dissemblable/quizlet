import { LogInIcon } from 'lucide-react'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { reconnect, useSessionExpired } from '@/lib/session'

/** Affiché dès qu'une requête révèle que la session Authelia a expiré. */
export function SessionExpiredBanner() {
  if (!useSessionExpired()) return null

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pt-4">
      <Alert variant="destructive">
        <LogInIcon />
        <AlertTitle>Session expirée</AlertTitle>
        <AlertDescription>
          Reconnectez-vous pour continuer. Les modifications non enregistrées de cette page seront
          perdues : copiez-les avant si besoin.
        </AlertDescription>
        <AlertAction>
          <Button size="sm" onClick={reconnect}>
            Se reconnecter
          </Button>
        </AlertAction>
      </Alert>
    </div>
  )
}
