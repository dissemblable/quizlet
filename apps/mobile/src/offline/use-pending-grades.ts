import { useMutationState } from '@tanstack/react-query'
import { useMemo } from 'react'
import { type GradeVariables, isGradeVariables } from './grade-policy'
import { GRADE_MUTATION_KEY } from './keys'

/** Notes en cours d'envoi ou en attente (persistées comprises), dans l'ordre de leur création. */
export function usePendingGrades(): GradeVariables[] {
  const variables = useMutationState({
    filters: { mutationKey: GRADE_MUTATION_KEY, status: 'pending' },
    select: (mutation) => mutation.state.variables,
  })
  return useMemo(() => variables.filter(isGradeVariables), [variables])
}
