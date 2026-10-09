import { GlobeIcon, LockIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export function VisibilityBadge({ visibility }: { visibility: string }) {
  return visibility === 'public' ? (
    <Badge variant="secondary">
      <GlobeIcon aria-hidden="true" />
      Public
    </Badge>
  ) : (
    <Badge variant="outline">
      <LockIcon aria-hidden="true" />
      Privé
    </Badge>
  )
}
