/** Forme canonique d'une réponse : casse et espaces ignorés (« Paris », « paris  » → identiques). */
export function normalizeAnswer(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLocaleLowerCase('fr-FR')
}

/**
 * Nombre de définitions distinctes d'un set. Un quiz exige QUIZ_MIN_CARDS définitions
 * différentes : la bonne réponse et trois distracteurs qui ne lui ressemblent pas.
 */
export function countDistinctDefinitions(cards: ReadonlyArray<{ definition: string }>): number {
  return new Set(cards.map((card) => normalizeAnswer(card.definition))).size
}
