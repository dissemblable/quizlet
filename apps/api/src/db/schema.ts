import { sql } from 'drizzle-orm'
import {
  doublePrecision,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

// Horodatages toujours produits par l'horloge de Postgres (jamais celle de l'app).
const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => sql`now()`),
}

export const visibilityEnum = pgEnum('visibility', ['private', 'public'])

/** États FSRS, dans l'ordre de l'énumération `State` de ts-fsrs (0 à 3). */
export const cardStateEnum = pgEnum('card_state', ['new', 'learning', 'review', 'relearning'])

/** Utilisateurs connus via le SSO. `username` (en-tête Remote-User) est l'identifiant stable. */
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: text('username').notNull().unique(),
  email: text('email'),
  displayName: text('display_name').notNull(),
  ...timestamps,
})

/** Paramètres de révision. Pas de ligne : valeurs par défaut (DEFAULT_SETTINGS de @quizlet/shared). */
export const userSettings = pgTable('user_settings', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  timezone: text('timezone').notNull(),
  newCardsPerDay: integer('new_cards_per_day').notNull(),
  reviewsPerDay: integer('reviews_per_day').notNull(),
  desiredRetention: doublePrecision('desired_retention').notNull(),
  ...timestamps,
})

/** Dossiers d'un utilisateur, à plat (un seul niveau). */
export const folders = pgTable(
  'folders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    ...timestamps,
  },
  (table) => [index('folders_owner_idx').on(table.ownerId)],
)

export const sets = pgTable(
  'sets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // Supprimer un dossier ne supprime pas ses sets : ils repassent « sans dossier ».
    folderId: uuid('folder_id').references(() => folders.id, { onDelete: 'set null' }),
    title: text('title').notNull(),
    description: text('description'),
    visibility: visibilityEnum('visibility').notNull().default('private'),
    ...timestamps,
  },
  (table) => [
    index('sets_owner_updated_idx').on(table.ownerId, table.updatedAt),
    index('sets_folder_idx').on(table.folderId),
    // Recherche ILIKE '%…%' (extension pg_trgm).
    index('sets_title_trgm_idx').using('gin', table.title.op('gin_trgm_ops')),
    index('sets_description_trgm_idx').using('gin', table.description.op('gin_trgm_ops')),
  ],
)

/** Tags d'un utilisateur. Le nom est unique par utilisateur, sans tenir compte de la casse. */
export const tags = pgTable(
  'tags',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('tags_owner_name_idx').on(table.ownerId, sql`lower(${table.name})`),
    index('tags_name_trgm_idx').using('gin', table.name.op('gin_trgm_ops')),
  ],
)

export const setTags = pgTable(
  'set_tags',
  {
    setId: uuid('set_id')
      .notNull()
      .references(() => sets.id, { onDelete: 'cascade' }),
    tagId: uuid('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({ columns: [table.setId, table.tagId] }),
    index('set_tags_tag_idx').on(table.tagId),
  ],
)

export const cards = pgTable(
  'cards',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    setId: uuid('set_id')
      .notNull()
      .references(() => sets.id, { onDelete: 'cascade' }),
    term: text('term').notNull(),
    definition: text('definition').notNull(),
    position: integer('position').notNull(),
    ...timestamps,
  },
  (table) => [
    index('cards_set_position_idx').on(table.setId, table.position),
    index('cards_term_trgm_idx').using('gin', table.term.op('gin_trgm_ops')),
    index('cards_definition_trgm_idx').using('gin', table.definition.op('gin_trgm_ops')),
  ],
)

/**
 * Progression FSRS d'un utilisateur sur une carte (champs de `Card` de ts-fsrs).
 * Pas de ligne : la carte n'a jamais été révisée par cet utilisateur (nouvelle carte).
 */
export const cardReviews = pgTable(
  'card_reviews',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    cardId: uuid('card_id')
      .notNull()
      .references(() => cards.id, { onDelete: 'cascade' }),
    due: timestamp('due', { withTimezone: true }).notNull(),
    stability: doublePrecision('stability').notNull(),
    difficulty: doublePrecision('difficulty').notNull(),
    elapsedDays: integer('elapsed_days').notNull(),
    scheduledDays: integer('scheduled_days').notNull(),
    learningSteps: integer('learning_steps').notNull(),
    reps: integer('reps').notNull(),
    lapses: integer('lapses').notNull(),
    state: cardStateEnum('state').notNull(),
    lastReview: timestamp('last_review', { withTimezone: true }),
    updatedAt: timestamps.updatedAt,
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.cardId] }),
    // Cartes dues d'un utilisateur.
    index('card_reviews_user_due_idx').on(table.userId, table.due),
    index('card_reviews_card_idx').on(table.cardId),
  ],
)

/** Historique des révisions (champs de `ReviewLog` de ts-fsrs), pour les statistiques. */
export const reviewLogs = pgTable(
  'review_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    cardId: uuid('card_id')
      .notNull()
      .references(() => cards.id, { onDelete: 'cascade' }),
    /** 1 À revoir, 2 Difficile, 3 Bien, 4 Facile. */
    rating: smallint('rating').notNull(),
    /** État de la carte avant cette révision (sert aux compteurs du jour). */
    state: cardStateEnum('state').notNull(),
    due: timestamp('due', { withTimezone: true }).notNull(),
    stability: doublePrecision('stability').notNull(),
    difficulty: doublePrecision('difficulty').notNull(),
    elapsedDays: integer('elapsed_days').notNull(),
    lastElapsedDays: integer('last_elapsed_days').notNull(),
    scheduledDays: integer('scheduled_days').notNull(),
    learningSteps: integer('learning_steps').notNull(),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    index('review_logs_user_reviewed_idx').on(table.userId, table.reviewedAt),
    index('review_logs_card_idx').on(table.cardId),
  ],
)

export type User = typeof users.$inferSelect
export type SetRow = typeof sets.$inferSelect
export type CardRow = typeof cards.$inferSelect
export type CardReviewRow = typeof cardReviews.$inferSelect
export type UserSettingsRow = typeof userSettings.$inferSelect
