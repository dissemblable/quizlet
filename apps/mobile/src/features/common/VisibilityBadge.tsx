import { Badge } from '@/ui'

/** « Public » (globe, ton secondaire) ou « Privé » (cadenas, contour) : carte de set et détail. */
export function VisibilityBadge({ visibility }: { visibility: string }) {
  return visibility === 'public' ? (
    <Badge label="Public" icon="globe" tone="secondary" />
  ) : (
    <Badge label="Privé" icon="lock" tone="outline" />
  )
}
