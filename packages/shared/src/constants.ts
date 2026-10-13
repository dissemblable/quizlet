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

/** Paramètres de révision par défaut (tant que l'utilisateur ne les a pas modifiés). */
export const DEFAULT_SETTINGS = {
  timezone: 'Europe/Paris',
  newCardsPerDay: 20,
  reviewsPerDay: 200,
  desiredRetention: 0.9,
} as const

/** Bornes des paramètres de révision. */
export const SETTINGS_LIMITS = {
  perDay: 9999,
  minRetention: 0.7,
  maxRetention: 0.99,
} as const

/** États FSRS d'une carte pour un utilisateur (`new` : jamais révisée). */
export const CARD_STATES = ['new', 'learning', 'review', 'relearning'] as const
export type CardState = (typeof CARD_STATES)[number]

/** Notes FSRS : 1 À revoir, 2 Difficile, 3 Bien, 4 Facile. */
export const RATINGS = [1, 2, 3, 4] as const
export type Rating = (typeof RATINGS)[number]

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
  timezoneInvalid: 'Fuseau horaire inconnu',
  perDayInvalid: `Choisissez un nombre entier entre 0 et ${SETTINGS_LIMITS.perDay}`,
  retentionInvalid: `La rétention cible doit être comprise entre ${SETTINGS_LIMITS.minRetention} et ${SETTINGS_LIMITS.maxRetention}`,
} as const
