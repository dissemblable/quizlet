// Petits calculs PURS des composants (testés sous Node).

/** Valeur d'une barre de progression ramenée à 0-100 (NaN ou infini = 0). */
export function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(100, Math.max(0, value))
}

/**
 * `ToastAndroid` n'affiche que quelques lignes pendant ~2 s (court) ou ~3,5 s (long) : un message
 * plus long est coupé par le système. On le tronque proprement.
 */
export function shortenToast(message: string, max = 120): string {
  const text = message.trim()
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`
}

/** « 12 / 200 », compteur d'un champ limité. */
export function counterText(length: number, max: number): string {
  return `${length} / ${max}`
}

/** Ce que TalkBack lit pour la face visible d'une carte retournable. */
export function flipAnnouncement(flipped: boolean, term: string, definition: string): string {
  return flipped ? `Définition : ${definition}` : `Terme : ${term}`
}

/** Taille du texte d'une face : plus le texte est long, plus il est petit (la face défile au-delà). */
export function faceFontSize(text: string): number {
  const length = text.length
  if (length <= 60) return 24
  if (length <= 160) return 20
  if (length <= 360) return 17
  return 15
}
