import { useRouter } from 'expo-router'
import { routes } from '@/lib/routes'
import { Button, type ButtonVariant } from '@/ui'

/** « Retour au set » : revient à l'écran du set sans en empiler un second. */
export function BackToSetButton({
  setId,
  variant = 'ghost',
}: {
  setId: string
  variant?: ButtonVariant
}) {
  const router = useRouter()
  return (
    <Button
      label="Retour au set"
      variant={variant}
      fullWidth
      onPress={() => router.dismissTo(routes.set(setId))}
    />
  )
}
