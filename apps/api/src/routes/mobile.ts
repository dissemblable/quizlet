import { Hono } from 'hono'
import { z } from 'zod'
import type { AppEnv } from '../types'

/** Schéma d'URL de l'app mobile (`scheme` de `app.json`) : cible fixe du relais. */
const APP_CALLBACK_URL = 'quizlet://callback'

/** Champs de la réponse OAuth transmis à l'app, dans cet ordre ; tout le reste est ignoré. */
const RELAYED_FIELDS = ['code', 'state', 'iss', 'error', 'error_description'] as const

const field = z.string().max(2048).optional()
const callbackSchema = z.object({
  code: field,
  state: field,
  iss: field,
  error: field,
  error_description: field,
})

/**
 * Redirection vers l'app. Les valeurs sont encodées avec `encodeURIComponent` : un espace devient
 * `%20` (`URLSearchParams` l'écrirait `+`, ambigu pour l'app). Une entrée invalide (ni `code` et
 * `state`, ni `error`, valeur trop longue, corps illisible) renvoie `error=invalid_request`.
 */
function callbackLocation(body: unknown): string {
  const parsed = callbackSchema.safeParse(body)
  const fields = parsed.success ? parsed.data : {}
  const query = RELAYED_FIELDS.flatMap((name) => {
    const value = fields[name]
    return value ? [`${name}=${encodeURIComponent(value)}`] : []
  })
  const complete = (fields.code && fields.state) || fields.error
  return `${APP_CALLBACK_URL}?${complete ? query.join('&') : 'error=invalid_request'}`
}

/**
 * Relais du `form_post` d'Authelia vers l'app mobile. Authelia n'accepte que `https` en
 * `redirect_uri` et poste le code OAuth dans un formulaire HTML : cette route le transmet à l'app
 * par un 302 vers `quizlet://callback`. Elle n'a aucun effet de bord. Réponse toujours en
 * redirection, même en cas d'erreur : un JSON laisserait la personne bloquée dans le Custom Tab.
 *
 * Montée après `identity`. Le POST vient du portail Authelia : `csrfGuard` accepte son origine sur
 * ce chemin seulement (voir `app.ts`).
 */
export function mobileRoutes() {
  return new Hono<AppEnv>().post('/callback', async (c) => {
    const body = await c.req.parseBody().catch(() => null)
    return c.redirect(callbackLocation(body), 302)
  })
}
