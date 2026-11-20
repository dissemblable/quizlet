import { SetGate } from '@/features/common'
import { useIdParam } from '@/lib/use-id-param'
import { ImportForm } from './ImportForm'

/**
 * Import de cartes, sans props. `/import` : nouveau set (pas d'`id`) ; `/sets/[id]/import` : set
 * existant, réservé à son auteur. Parité avec `ImportPage`.
 */
export function ImportScreen() {
  const id = useIdParam()
  if (!id) return <ImportForm />
  return (
    <SetGate id={id} ownerOnly ownerOnlyTitle="Import réservé à l'auteur">
      {(set) => <ImportForm set={set} />}
    </SetGate>
  )
}
