// Constantes sans dépendance : importables sans embarquer Zod dans le bundle du front.

export const VISIBILITIES = ['private', 'public'] as const
export type Visibility = (typeof VISIBILITIES)[number]

/** Limites partagées par la validation de l'API et celle des formulaires. */
export const LIMITS = {
  title: 120,
  description: 1000,
  term: 500,
  definition: 1000,
  cards: 500,
  search: 100,
} as const

/** Nombre minimal de cartes (aux définitions distinctes) pour générer un quiz. */
export const QUIZ_MIN_CARDS = 4

/** Suffixe ajouté au titre d'un set dupliqué. */
export const COPY_SUFFIX = ' (copie)'

export const MESSAGES = {
  titleRequired: 'Le titre est requis',
  titleTooLong: `Le titre ne peut pas dépasser ${LIMITS.title} caractères`,
  descriptionTooLong: `La description ne peut pas dépasser ${LIMITS.description} caractères`,
  termRequired: 'Le terme est requis',
  termTooLong: `Le terme ne peut pas dépasser ${LIMITS.term} caractères`,
  definitionRequired: 'La définition est requise',
  definitionTooLong: `La définition ne peut pas dépasser ${LIMITS.definition} caractères`,
  tooManyCards: `Un set ne peut pas contenir plus de ${LIMITS.cards} cartes`,
} as const
