import { sql } from 'drizzle-orm'
import { index, integer, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

// Horodatages toujours produits par l'horloge de Postgres (jamais celle de l'app).
const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => sql`now()`),
}

export const visibilityEnum = pgEnum('visibility', ['private', 'public'])

/** Utilisateurs connus via le SSO. `username` (en-tête Remote-User) est l'identifiant stable. */
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: text('username').notNull().unique(),
  email: text('email'),
  displayName: text('display_name').notNull(),
  ...timestamps,
})

export const sets = pgTable(
  'sets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    visibility: visibilityEnum('visibility').notNull().default('private'),
    ...timestamps,
  },
  (table) => [index('sets_owner_updated_idx').on(table.ownerId, table.updatedAt)],
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
  (table) => [index('cards_set_position_idx').on(table.setId, table.position)],
)

export type User = typeof users.$inferSelect
export type SetRow = typeof sets.$inferSelect
export type CardRow = typeof cards.$inferSelect
