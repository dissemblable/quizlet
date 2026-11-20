import { DEFAULT_SETTINGS, formatNumber, MESSAGES, SETTINGS_LIMITS } from '@quizlet/shared'
import { z } from 'zod'
import type { Settings } from '@/lib/queries'

// Schéma LOCAL : celui de `@quizlet/shared` valide le fuseau avec `Intl`, peu fiable sur Hermes (le
// serveur le revalide). Les champs sont des chaînes (saisie au clavier) ; la sortie est numérique.

/** Entier en chiffres seuls (« 20 ») ; `Number('')`, `Number('0x10')`… ne conviennent pas. */
export function parsePerDay(text: string): number {
  const value = text.trim()
  return /^\d+$/.test(value) ? Number(value) : Number.NaN
}

/** Décimal avec virgule ou point (« 0,9 », « 0.9 », « .85 »), `NaN` sinon. */
export function parseRetention(text: string): number {
  const value = text.trim().replace(',', '.')
  return /^(?:\d+\.?\d*|\.\d+)$/.test(value) ? Number(value) : Number.NaN
}

const perDaySchema = z
  .string()
  .transform(parsePerDay)
  .pipe(
    z
      .number({ error: MESSAGES.perDayInvalid })
      .int(MESSAGES.perDayInvalid)
      .min(0, MESSAGES.perDayInvalid)
      .max(SETTINGS_LIMITS.perDay, MESSAGES.perDayInvalid),
  )

const retentionSchema = z
  .string()
  .transform(parseRetention)
  .pipe(
    z
      .number({ error: MESSAGES.retentionInvalid })
      .min(SETTINGS_LIMITS.minRetention, MESSAGES.retentionInvalid)
      .max(SETTINGS_LIMITS.maxRetention, MESSAGES.retentionInvalid),
  )

export const settingsFormSchema = z.object({
  timezone: z.string().trim().min(1, MESSAGES.timezoneInvalid).max(64, MESSAGES.timezoneInvalid),
  newCardsPerDay: perDaySchema,
  reviewsPerDay: perDaySchema,
  desiredRetention: retentionSchema,
})

/** Valeurs du formulaire : tout est texte. */
export type SettingsFormValues = z.input<typeof settingsFormSchema>
/** Valeurs validées : prêtes pour `PUT /api/settings`. */
export type SettingsFormOutput = z.output<typeof settingsFormSchema>

/**
 * Réglages du serveur → champs du formulaire. Entiers en chiffres seuls (le séparateur de milliers
 * de `formatNumber` ne passerait pas `parsePerDay`) ; rétention avec la virgule décimale.
 */
export function toFormValues(settings: Settings): SettingsFormValues {
  return {
    timezone: settings.timezone ?? DEFAULT_SETTINGS.timezone,
    newCardsPerDay: String(settings.newCardsPerDay),
    reviewsPerDay: String(settings.reviewsPerDay),
    desiredRetention: formatNumber(settings.desiredRetention),
  }
}

/** Libellés et textes d'aide : ceux de `SettingsPage` du web (sauf « navigateur » → « appareil »). */
export const SETTINGS_TEXT = {
  intro: 'Réglages de la répétition espacée.',
  timezone: {
    label: 'Fuseau horaire',
    help: 'Le jour change à minuit dans ce fuseau : les compteurs repartent à zéro et les cartes dues avant minuit sont proposées. Il est repris de votre appareil à la première ouverture.',
  },
  newCardsPerDay: {
    label: 'Nouvelles cartes par jour',
    help: `Cartes jamais révisées présentées chaque jour (${DEFAULT_SETTINGS.newCardsPerDay} par défaut).`,
  },
  reviewsPerDay: {
    label: 'Révisions par jour',
    help: `Cartes déjà apprises à réviser chaque jour au plus (${DEFAULT_SETTINGS.reviewsPerDay} par défaut). Les cartes en cours d'apprentissage ne sont jamais limitées.`,
  },
  desiredRetention: {
    label: 'Rétention cible',
    help: `Probabilité visée de se souvenir d'une carte quand elle revient (${formatNumber(DEFAULT_SETTINGS.desiredRetention)} par défaut, de ${formatNumber(SETTINGS_LIMITS.minRetention)} à ${formatNumber(SETTINGS_LIMITS.maxRetention)}). Plus elle est haute, plus les révisions sont fréquentes.`,
  },
} as const
