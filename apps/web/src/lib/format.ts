/** Initiales pour l'avatar : « Utilisateur Démo » → « UD », « alice » → « A ». */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const letters = parts.length > 1 ? [parts[0], parts[parts.length - 1]] : parts.slice(0, 1)
  return letters
    .map((part) => Array.from(part ?? '')[0] ?? '')
    .join('')
    .toLocaleUpperCase('fr-FR')
}

/** « 0 carte », « 1 carte », « 12 cartes ». */
export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count.toLocaleString('fr-FR')} ${Math.abs(count) >= 2 ? plural : singular}`
}
