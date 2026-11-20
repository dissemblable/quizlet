import { LIMITS, MESSAGES } from '@quizlet/shared'

export type TagRefusal = 'duplicate' | 'full' | 'too-long'

export interface AddTagResult {
  /** Même tableau (même référence) quand rien n'est ajouté. */
  tags: string[]
  /** `empty` : saisie vide, à ignorer sans message. */
  refused?: 'empty' | TagRefusal
}

/** Doublon sans tenir compte de la casse (l'API est unique sur `lower(nom)`). */
export function hasTag(tags: readonly string[], name: string): boolean {
  const key = name.toLowerCase()
  return tags.some((tag) => tag.toLowerCase() === key)
}

/**
 * Ajoute `draft` (nettoyé des espaces) aux tags. Refus : vide, 10 tags déjà, plus de 30
 * caractères, doublon insensible à la casse.
 */
export function addTag(tags: string[], draft: string): AddTagResult {
  const name = draft.trim()
  if (name === '') return { tags, refused: 'empty' }
  if (tags.length >= LIMITS.tagsPerSet) return { tags, refused: 'full' }
  if (name.length > LIMITS.tagName) return { tags, refused: 'too-long' }
  if (hasTag(tags, name)) return { tags, refused: 'duplicate' }
  return { tags: [...tags, name] }
}

/** Ajoute plusieurs noms à la suite ; les refus (hors saisies vides) sont listés avec leur nom. */
export function addTags(tags: string[], names: readonly string[]) {
  let next = tags
  const refused: Array<{ name: string; reason: TagRefusal }> = []
  for (const name of names) {
    const result = addTag(next, name)
    next = result.tags
    if (result.refused && result.refused !== 'empty') {
      refused.push({ name: name.trim(), reason: result.refused })
    }
  }
  return { tags: next, refused }
}

/**
 * Saisie en cours : chaque virgule valide le texte qui la précède (« anglais,oral, » → deux tags),
 * le reste après la dernière virgule redevient le brouillon.
 */
export function splitDraft(text: string): { names: string[]; rest: string } {
  const parts = text.split(',')
  const rest = parts.pop() ?? ''
  return { names: parts, rest }
}

/** Message (affiché et annoncé) d'un ajout refusé. */
export function refusalMessage(reason: TagRefusal, name: string): string {
  switch (reason) {
    case 'duplicate':
      return `Le tag « ${name} » est déjà ajouté.`
    case 'full':
      return MESSAGES.tooManyTags
    case 'too-long':
      return MESSAGES.tagTooLong
  }
}

/**
 * Mes tags existants à proposer : sans ceux déjà choisis, filtrés par la saisie (sous-chaîne, sans
 * tenir compte de la casse), au plus `max` pour ne pas noyer l'écran.
 */
export function tagSuggestions(
  all: readonly string[],
  chosen: readonly string[],
  draft: string,
  max = 8,
): string[] {
  const needle = draft.trim().toLowerCase()
  return all
    .filter(
      (name) => !hasTag(chosen, name) && (needle === '' || name.toLowerCase().includes(needle)),
    )
    .slice(0, max)
}
