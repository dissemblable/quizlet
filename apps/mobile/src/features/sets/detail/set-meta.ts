/** « Créé par Alice » pour un set dont on n'est pas l'auteur, sinon `null`. */
export function createdByLabel(set: {
  isOwner: boolean
  owner: { displayName: string }
}): string | null {
  return set.isOwner ? null : `Créé par ${set.owner.displayName}`
}

/** « #anglais #oral » ; `null` sans tag (l'API ne renvoie les tags qu'à l'auteur). */
export function tagsLabel(tags: ReadonlyArray<{ name: string }>): string | null {
  return tags.length > 0 ? tags.map((tag) => `#${tag.name}`).join(' ') : null
}

/** Lien web d'un set public : `webUrl` est `config.webUrl`, sans « / » final. */
export function setWebUrl(webUrl: string, setId: string): string {
  return `${webUrl}/sets/${setId}`
}
