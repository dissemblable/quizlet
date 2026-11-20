import { SetGate } from '@/features/common'
import { useIdParam } from '@/lib/use-id-param'
import { SetEditor } from './SetEditor'

/** Édition d'un set (`/sets/[id]/edit`), réservée à l'auteur. */
export function EditSetScreen() {
  const id = useIdParam()
  return (
    <SetGate id={id} ownerOnly ownerOnlyTitle="Modification réservée à l'auteur">
      {(set) => <SetEditor key={set.id} set={set} />}
    </SetGate>
  )
}
