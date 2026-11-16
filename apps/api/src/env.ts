import { z } from 'zod'
import { type Identity, isValidUsername } from './middleware/identity'
import { parseTrustedProxyEntry } from './middleware/trusted-proxies'

const LOOPBACK_HOSTS = new Set(['127.0.0.1', '::1', 'localhost'])
const DEV_AUTH_KEYS = [
  'DEV_AUTH_USER',
  'DEV_AUTH_EMAIL',
  'DEV_AUTH_NAME',
  'DEV_AUTH_GROUPS',
] as const

const commaList = z.string().transform((value) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item !== ''),
)

function isOrigin(value: string): boolean {
  try {
    const url = new URL(value)
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.origin === value
  } catch {
    return false
  }
}

const envSchema = z
  .object({
    // Par défaut « production » : un oubli de configuration ne doit jamais assouplir la sécurité.
    NODE_ENV: z.enum(['development', 'test', 'production']).default('production'),
    HOST: z.string().default('127.0.0.1'),
    PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
    DATABASE_URL: z.url({
      protocol: /^postgres(ql)?$/,
      error: 'doit être une URL postgres:// ou postgresql://',
    }),
    MIGRATE_ON_START: z.stringbool().default(false),
    TRUSTED_PROXIES: commaList.optional(),
    APP_ORIGIN: commaList.optional(),
    CORS_ORIGINS: commaList.optional(),
    AUTH_LOGOUT_URL: z.url({ protocol: /^https?$/, error: 'doit être une URL http(s)' }).optional(),
    DEV_AUTH_USER: z.string().optional(),
    DEV_AUTH_EMAIL: z.email({ error: 'doit être une adresse email' }).optional(),
    DEV_AUTH_NAME: z.string().optional(),
    DEV_AUTH_GROUPS: commaList.optional(),
  })
  .superRefine((env, ctx) => {
    const production = env.NODE_ENV === 'production'

    if (production) {
      for (const key of DEV_AUTH_KEYS) {
        if (env[key] !== undefined) {
          ctx.addIssue({
            code: 'custom',
            path: [key],
            message: "le mode d'authentification de développement est interdit en production",
          })
        }
      }
      for (const key of ['TRUSTED_PROXIES', 'APP_ORIGIN', 'AUTH_LOGOUT_URL'] as const) {
        const value = env[key]
        if (value === undefined || value.length === 0) {
          ctx.addIssue({ code: 'custom', path: [key], message: 'obligatoire en production' })
        }
      }
    }

    // Sans DEV_AUTH_USER, les autres DEV_AUTH_* sont ignorées (hors production).
    if (env.DEV_AUTH_USER !== undefined) {
      if (!isValidUsername(env.DEV_AUTH_USER.trim())) {
        ctx.addIssue({
          code: 'custom',
          path: ['DEV_AUTH_USER'],
          message: "nom d'utilisateur invalide",
        })
      }
      if (!LOOPBACK_HOSTS.has(env.HOST.trim())) {
        ctx.addIssue({
          code: 'custom',
          path: ['HOST'],
          message:
            'le mode DEV_AUTH_USER exige une écoute en loopback (127.0.0.1, ::1 ou localhost)',
        })
      }
    }

    for (const entry of env.TRUSTED_PROXIES ?? []) {
      if (!parseTrustedProxyEntry(entry)) {
        ctx.addIssue({
          code: 'custom',
          path: ['TRUSTED_PROXIES'],
          message: `« ${entry} » n'est ni une IP, ni un CIDR, ni un nom d'hôte`,
        })
      }
    }
    for (const key of ['APP_ORIGIN', 'CORS_ORIGINS'] as const) {
      for (const origin of env[key] ?? []) {
        if (!isOrigin(origin)) {
          ctx.addIssue({
            code: 'custom',
            path: [key],
            message: `« ${origin} » doit être une origine schéma://hôte[:port], sans chemin`,
          })
        }
      }
    }
  })

export interface Config {
  nodeEnv: 'development' | 'test' | 'production'
  host: string
  port: number
  databaseUrl: string
  migrateOnStart: boolean
  /** IP, CIDR ou noms d'hôte autorisés à transmettre les en-têtes Remote-*. */
  trustedProxies: string[]
  /** Origine(s) publique(s) de l'app : contrôle CSRF quand Sec-Fetch-Site est absent. */
  appOrigins: string[]
  /** Origines autorisées en CORS (vide par défaut : aucune). */
  corsOrigins: string[]
  logoutUrl: string | null
  /** Identité fixe injectée par le mode de dev ; toujours null en production. */
  devIdentity: Identity | null
}

export class ConfigError extends Error {
  override name = 'ConfigError'
}

/** Une variable définie mais vide (`FOO=`) est traitée comme absente. */
function withoutEmptyValues(env: Record<string, string | undefined>) {
  return Object.fromEntries(
    Object.entries(env).filter(([, value]) => value !== undefined && value.trim() !== ''),
  )
}

export function parseConfig(env: Record<string, string | undefined>): Config {
  const result = envSchema.safeParse(withoutEmptyValues(env))
  if (!result.success) {
    throw new ConfigError(`Configuration invalide :\n${z.prettifyError(result.error)}`)
  }
  const values = result.data
  const production = values.NODE_ENV === 'production'
  const devUser = values.DEV_AUTH_USER?.trim()

  return {
    nodeEnv: values.NODE_ENV,
    host: values.HOST.trim(),
    port: values.PORT,
    databaseUrl: values.DATABASE_URL,
    migrateOnStart: values.MIGRATE_ON_START,
    trustedProxies: values.TRUSTED_PROXIES ?? (production ? [] : ['127.0.0.1', '::1']),
    appOrigins: values.APP_ORIGIN ?? (production ? [] : ['http://localhost:5180']),
    corsOrigins: values.CORS_ORIGINS ?? [],
    logoutUrl: values.AUTH_LOGOUT_URL ?? null,
    devIdentity:
      devUser && !production
        ? {
            username: devUser,
            email: values.DEV_AUTH_EMAIL ?? null,
            displayName: values.DEV_AUTH_NAME?.trim() || devUser,
            groups: values.DEV_AUTH_GROUPS ?? [],
          }
        : null,
  }
}

/** Charge la configuration depuis `process.env` ou arrête le processus avec un message clair. */
export function loadConfigOrExit(): Config {
  try {
    return parseConfig(process.env)
  } catch (error) {
    if (error instanceof ConfigError) {
      console.error(error.message)
      process.exit(1)
    }
    throw error
  }
}
