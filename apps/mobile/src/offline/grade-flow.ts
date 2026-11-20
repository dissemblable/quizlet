import type { CardState, Rating } from '@quizlet/shared'
import { MutationObserver, type QueryClient } from '@tanstack/react-query'
import {
  buildGradeVariables,
  GRADE_WAIT_MS,
  type GradeResponse,
  type GradeVariables,
} from './grade-policy'
import { GRADE_MUTATION_KEY } from './keys'
import type { GradeOutcome } from './types'

export interface SubmitGradeDeps {
  client: QueryClient
  isOnline(): boolean
  /** Écriture immédiate du cache persisté (la note doit survivre à la mort de l'app). */
  flush(): Promise<void> | void
  waitMs?: number
}

type Raced<T> = { timedOut: true } | { timedOut: false; value: T }

/** Attend `promise` au plus `ms` ; un rejet avant le délai est propagé. */
export async function raceTimeout<T>(promise: Promise<T>, ms: number): Promise<Raced<T>> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<Raced<T>>((resolve) => {
    timer = setTimeout(() => resolve({ timedOut: true }), ms)
  })
  try {
    return await Promise.race([
      promise.then((value): Raced<T> => ({ timedOut: false, value })),
      timeout,
    ])
  } finally {
    clearTimeout(timer)
  }
}

/**
 * L'UNIQUE chemin de note : crée la mutation `['review','grade']` (persistée, à `scope`), écrit le
 * cache, puis
 * - hors ligne : rend `queued` sans attendre ;
 * - en ligne : attend la réponse au plus `GRADE_WAIT_MS` → `synced`, ou `queued` (la note continue).
 * Ne rejette que pour un refus définitif (4xx) arrivé dans le délai ; passé le délai, ce refus
 * est compté dans le compte rendu de synchronisation.
 */
export async function submitGrade(
  deps: SubmitGradeDeps,
  card: { id: string; state: CardState },
  rating: Rating,
  now: Date = new Date(),
): Promise<GradeOutcome> {
  const variables: GradeVariables = buildGradeVariables(card, rating, now)
  const observer = new MutationObserver<GradeResponse, Error, GradeVariables>(deps.client, {
    mutationKey: GRADE_MUTATION_KEY,
  })
  // `mutate` crée la mutation et passe en `pending` de façon synchrone : le flush la voit.
  const request = observer.mutate(variables)
  request.then(
    () => observer.reset(),
    () => observer.reset(),
  )
  try {
    await deps.flush()
  } catch {
    // Le cache est aussi écrit par le persister temporisé.
  }

  if (!deps.isOnline()) return { kind: 'queued' }
  const raced = await raceTimeout(request, deps.waitMs ?? GRADE_WAIT_MS)
  if (raced.timedOut) return { kind: 'queued' }
  return { kind: 'synced', requeue: raced.value.card, ignored: raced.value.ignored }
}
