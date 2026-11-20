import type { GradeApi } from './types'

/**
 * CONTRAT : l'UNIQUE chemin de note de l'app (mutation `['review','grade']`, file persistée).
 * Provisoire : `grade` lève « non implémenté ».
 */
export function useGrade(): GradeApi {
  return {
    grade: async () => {
      throw new Error('non implémenté')
    },
    pending: false,
  }
}
