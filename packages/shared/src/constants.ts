// Constantes sans dépendance : importables sans embarquer Zod dans le bundle du front.

export const VISIBILITIES = ['private', 'public'] as const
export type Visibility = (typeof VISIBILITIES)[number]

/** Limites partagées par la validation de l'API et celle des formulaires. */
export const LIMITS = {
  title: 120,
  description: 1000,
  term: 500,
  definition: 1000,
  cards: 2000,
  search: 100,
  folderName: 60,
  tagName: 30,
  tagsPerSet: 10,
} as const

/** Taille maximale d'un texte ou d'un fichier importé, en octets UTF-8 (1 Mo). */
export const IMPORT_MAX_BYTES = 1_000_000

/** Nombre de sets par page dans la bibliothèque. */
export const LIBRARY_PAGE_SIZE = 24

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
  folderNameRequired: 'Le nom du dossier est requis',
  folderNameTooLong: `Le nom du dossier ne peut pas dépasser ${LIMITS.folderName} caractères`,
  tagRequired: 'Un tag ne peut pas être vide',
  tagTooLong: `Un tag ne peut pas dépasser ${LIMITS.tagName} caractères`,
  tooManyTags: `Un set ne peut pas avoir plus de ${LIMITS.tagsPerSet} tags`,
  importTooLarge: 'Le texte à importer ne peut pas dépasser 1 Mo',
  separatorRequired: 'Choisissez un séparateur',
  separatorTooLong: 'Un séparateur ne peut pas dépasser 10 caractères',
  separatorsMustDiffer: 'Les séparateurs de terme et de carte doivent être différents',
  noCardToImport: 'Aucune carte valide à importer',
} as const
