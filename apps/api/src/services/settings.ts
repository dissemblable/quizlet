import { DEFAULT_SETTINGS, MESSAGES, type settingsSchema } from '@quizlet/shared'
import { eq, sql } from 'drizzle-orm'
import type { z } from 'zod'
import type { Db, Executor } from '../db/client'
import { type User, userSettings } from '../db/schema'
import { ApiError } from '../errors'

export type Settings = z.output<typeof settingsSchema>

/**
 * Paramètres enregistrés, ou valeurs par défaut. `timezone` vaut null tant que l'utilisateur (ou
 * son navigateur) n'en a pas choisi : le fuseau effectif est alors celui par défaut.
 */
export async function getSettings(db: Executor, user: User) {
  const [row] = await db.select().from(userSettings).where(eq(userSettings.userId, user.id))
  return {
    timezone: row?.timezone ?? null,
    newCardsPerDay: row?.newCardsPerDay ?? DEFAULT_SETTINGS.newCardsPerDay,
    reviewsPerDay: row?.reviewsPerDay ?? DEFAULT_SETTINGS.reviewsPerDay,
    desiredRetention: row?.desiredRetention ?? DEFAULT_SETTINGS.desiredRetention,
  }
}

/** Paramètres utilisés par la planification (fuseau par défaut si aucun n'est choisi). */
export async function effectiveSettings(db: Executor, user: User): Promise<Settings> {
  const settings = await getSettings(db, user)
  return { ...settings, timezone: settings.timezone ?? DEFAULT_SETTINGS.timezone }
}

/**
 * Début du jour courant et du lendemain dans le fuseau donné. Postgres fait le calcul : il gère
 * les changements d'heure (un jour peut durer 23 ou 25 heures).
 */
export async function dayBounds(db: Executor, now: Date, timezone: string) {
  const [row] = await db.execute<{ start: string; end: string }>(sql`
    SELECT extract(epoch FROM date_trunc('day', ${now.toISOString()}::timestamptz AT TIME ZONE ${timezone}) AT TIME ZONE ${timezone}) AS start,
           extract(epoch FROM (date_trunc('day', ${now.toISOString()}::timestamptz AT TIME ZONE ${timezone}) + interval '1 day') AT TIME ZONE ${timezone}) AS end`)
  if (!row) throw new Error('Calcul du jour sans résultat')
  return { start: new Date(Number(row.start) * 1000), end: new Date(Number(row.end) * 1000) }
}

export async function saveSettings(db: Db, user: User, settings: Settings): Promise<Settings> {
  // Le fuseau doit aussi être connu de Postgres, qui calcule les changements de jour.
  try {
    await dayBounds(db, new Date(), settings.timezone)
  } catch {
    throw new ApiError(400, 'VALIDATION_ERROR', MESSAGES.timezoneInvalid)
  }
  await db
    .insert(userSettings)
    .values({ userId: user.id, ...settings })
    .onConflictDoUpdate({
      target: userSettings.userId,
      set: { ...settings, updatedAt: sql`now()` },
    })
  return settings
}
