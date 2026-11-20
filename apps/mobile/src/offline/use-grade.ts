import { onlineManager, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo, useState } from 'react'
import { submitGrade } from './grade-flow'
import { flushPersistedCache } from './persistence'
import type { GradeApi } from './types'

/**
 * CONTRAT : l'UNIQUE chemin de note de l'app (mutation `['review','grade']`, file persistée). Voir
 * `submitGrade`. `pending` n'est vrai que pendant l'attente de la réponse (au plus 3 s) : une note
 * mise en attente ne bloque pas les boutons.
 */
export function useGrade(): GradeApi {
  const client = useQueryClient()
  const [pending, setPending] = useState(false)

  const grade = useCallback<GradeApi['grade']>(
    async (card, rating) => {
      const online = onlineManager.isOnline()
      if (online) setPending(true)
      try {
        return await submitGrade(
          { client, isOnline: () => onlineManager.isOnline(), flush: flushPersistedCache },
          card,
          rating,
        )
      } finally {
        if (online) setPending(false)
      }
    },
    [client],
  )

  return useMemo(() => ({ grade, pending }), [grade, pending])
}
