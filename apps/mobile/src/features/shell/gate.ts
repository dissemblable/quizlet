import { ApiError } from '@quizlet/shared'
import type { AuthStatus } from '@/auth/types'

/**
 * Lecture d'une erreur de `/api/me` selon l'état d'authentification :
 * - `stale` : 401 alors que la session est valide (requête partie avant la reconnexion) : relancer ;
 * - `expired` : session morte, la bannière « Se reconnecter » suffit ;
 * - `none` : pas une erreur de connexion (ou état d'auth sans rapport) : écran d'erreur.
 */
export function profileLoginState(
  error: unknown,
  status: AuthStatus,
): 'stale' | 'expired' | 'none' {
  if (!(error instanceof ApiError && error.needsLogin)) return 'none'
  if (status === 'signedIn') return 'stale'
  return status === 'expired' ? 'expired' : 'none'
}
