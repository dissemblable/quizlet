import { useEffect, useRef } from 'react'

/** Le raccourci doit-il être ignoré pour cet événement clavier ? (logique pure, testée) */
export function shouldIgnoreShortcut(event: {
  key: string
  altKey: boolean
  ctrlKey: boolean
  metaKey: boolean
  defaultPrevented: boolean
  target: EventTarget | null
}): boolean {
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return true
  const target = event.target instanceof Element ? event.target : null
  // Saisie de texte : les touches gardent leur sens habituel.
  if (target?.closest('input, textarea, select, [contenteditable="true"]')) return true
  // Espace ou Entrée sur un bouton ou un lien : on laisse l'élément s'activer (évite une double action).
  if (
    (event.key === ' ' || event.key === 'Enter') &&
    target?.closest('button, a, [role="button"]')
  ) {
    return true
  }
  return false
}

/** Raccourcis clavier globaux de la page (clé = `KeyboardEvent.key`). */
export function useShortcuts(handlers: Record<string, () => void>, enabled = true) {
  const latest = useRef(handlers)
  useEffect(() => {
    latest.current = handlers
  })

  useEffect(() => {
    if (!enabled) return
    const onKeyDown = (event: KeyboardEvent) => {
      const handler = latest.current[event.key]
      if (!handler || shouldIgnoreShortcut(event)) return
      event.preventDefault()
      handler()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [enabled])
}
