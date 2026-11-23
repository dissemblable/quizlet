import { useEffect, useRef } from 'react'
import { announce } from '@/ui'

/**
 * Annonce `message` à TalkBack à chaque changement (rien pour `null`). Équivalent des zones
 * `aria-live` du web : le message repasse par `null` entre deux séries identiques (« Bonne
 * réponse ! » deux fois de suite) pour être ré-annoncé. `skipInitial` : pas d'annonce au montage.
 */
export function useAnnounce(message: string | null, skipInitial = false): void {
  const first = useRef(true)
  useEffect(() => {
    const skip = skipInitial && first.current
    first.current = false
    if (message !== null && !skip) announce(message)
  }, [message, skipInitial])
}
