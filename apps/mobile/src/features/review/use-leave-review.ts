import { useRouter } from 'expo-router'
import type { SetDetail } from '@/lib/queries'
import { reviewTarget } from './session'

/**
 * Quitte la révision. Un set est dans la pile : `dismissTo` y revient. L'onglet Révision, lui, n'y
 * est pas : `navigate` vers la bibliothèque (un `dismissTo` n'y dépile rien).
 */
export function useLeaveReview(set?: SetDetail): () => void {
  const router = useRouter()
  const { route } = reviewTarget(set)
  return () => (set ? router.dismissTo(route) : router.navigate(route))
}
