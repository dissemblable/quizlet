import { createMiddleware } from 'hono/factory'
import { ApiError } from '../errors'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/**
 * Le cookie de session Authelia (SameSite=Lax, domaine parent) part aussi avec les requêtes
 * venant d'un autre sous-domaine : elles sont « same-site » mais pas « same-origin ».
 * On refuse donc toute méthode non sûre qui ne vient pas de notre origine.
 */
export function csrfGuard(trustedOrigins: readonly string[]) {
  const allowed = new Set(trustedOrigins)

  return createMiddleware(async (c, next) => {
    if (!SAFE_METHODS.has(c.req.method)) {
      const site = c.req.header('sec-fetch-site')
      const origin = c.req.header('origin')
      const sameOrigin = site === 'same-origin' || site === 'none'
      // Sans Sec-Fetch-Site ni Origin : client non navigateur, qui ne porte pas le cookie d'un tiers.
      const nonBrowser = site === undefined && origin === undefined
      const trustedOrigin = origin !== undefined && allowed.has(origin)

      if (!sameOrigin && !nonBrowser && !trustedOrigin) {
        throw new ApiError(403, 'CSRF_REJECTED', 'Requête inter-sites refusée.')
      }
    }
    await next()
  })
}
