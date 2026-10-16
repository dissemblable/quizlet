import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { secureHeaders } from 'hono/secure-headers'
import type { Db } from './db/client'
import type { Config } from './env'
import { errorBody, handleError } from './errors'
import { csrfGuard } from './middleware/csrf'
import { type ClientIpResolver, identity } from './middleware/identity'
import { createTrustedProxyMatcher, type TrustedProxyMatcher } from './middleware/trusted-proxies'
import { aiRoutes } from './routes/ai'
import { foldersRoutes } from './routes/folders'
import { meRoutes } from './routes/me'
import { reviewRoutes } from './routes/review'
import { setsRoutes } from './routes/sets'
import { settingsRoutes } from './routes/settings'
import { tagsRoutes } from './routes/tags'
import { type CardGenerator, createClaudeGenerator } from './services/ai'
import { createUserResolver } from './services/users'
import type { AppEnv } from './types'

export interface AppDeps {
  db: Db
  config: Config
  /** Remplaçables dans les tests ; par défaut dérivés de la configuration. */
  trustedProxies?: TrustedProxyMatcher
  clientIp?: ClientIpResolver
  /** Horloge de la planification des révisions (fixée dans les tests). */
  now?: () => Date
  /** Génération de cartes par IA ; null : désactivée. */
  generator?: CardGenerator | null
}

/** Route qui accepte des fichiers joints : elle applique sa propre limite de taille. */
const AI_GENERATE_PATH = '/api/ai/generate'

export function createApp({ db, config, trustedProxies, clientIp, now, generator }: AppDeps) {
  const app = new Hono<AppEnv>().basePath('/api')
  const cardGenerator =
    generator === undefined
      ? config.anthropicApiKey
        ? createClaudeGenerator(config.anthropicApiKey)
        : null
      : generator

  app.onError(handleError)
  app.notFound((c) => c.json(errorBody('NOT_FOUND', 'Ressource introuvable.'), 404))

  if (config.nodeEnv === 'development') app.use(logger())
  app.use(
    secureHeaders({
      contentSecurityPolicy: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
      xFrameOptions: 'DENY',
    }),
  )
  // Réponses propres à chaque utilisateur : jamais mises en cache.
  app.use(async (c, next) => {
    await next()
    c.header('Cache-Control', 'no-store')
  })
  // Pas de CORS par défaut : le front est servi sur la même origine que l'API.
  if (config.corsOrigins.length > 0) {
    app.use(cors({ origin: config.corsOrigins, credentials: true }))
  }
  const defaultBodyLimit = bodyLimit({
    maxSize: 1024 * 1024,
    onError: (c) =>
      c.json(errorBody('PAYLOAD_TOO_LARGE', 'Requête trop volumineuse (1 Mo maximum).'), 413),
  })
  app.use((c, next) => (c.req.path === AI_GENERATE_PATH ? next() : defaultBodyLimit(c, next)))

  return (
    app
      // Avant `identity` : le healthcheck Docker n'a pas d'en-têtes d'authentification.
      .get('/health', (c) => c.json({ status: 'ok' }))
      .use(csrfGuard([...config.appOrigins, ...config.corsOrigins]))
      .use(
        identity({
          devIdentity: config.devIdentity,
          trustedProxies: trustedProxies ?? createTrustedProxyMatcher(config.trustedProxies),
          resolveUser: createUserResolver(db),
          clientIp,
        }),
      )
      .route('/me', meRoutes(config.logoutUrl, cardGenerator !== null))
      .route('/sets', setsRoutes(db))
      .route('/folders', foldersRoutes(db))
      .route('/tags', tagsRoutes(db))
      .route('/review', reviewRoutes(db, now ?? (() => new Date())))
      .route('/settings', settingsRoutes(db))
      .route('/ai', aiRoutes(cardGenerator))
  )
}

/** Type de l'API consommé par le client RPC du front (`hc<AppType>`). */
export type AppType = ReturnType<typeof createApp>
