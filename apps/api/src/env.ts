import { z } from 'zod'

const envSchema = z.object({
  // Par défaut « production » : un oubli de configuration ne doit jamais assouplir la sécurité.
  NODE_ENV: z.enum(['development', 'test', 'production']).default('production'),
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  DATABASE_URL: z.url({
    protocol: /^postgres(ql)?$/,
    error: 'doit être une URL postgres:// ou postgresql://',
  }),
  MIGRATE_ON_START: z.stringbool().default(false),
})

export interface Config {
  nodeEnv: 'development' | 'test' | 'production'
  host: string
  port: number
  databaseUrl: string
  migrateOnStart: boolean
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
  return {
    nodeEnv: values.NODE_ENV,
    host: values.HOST.trim(),
    port: values.PORT,
    databaseUrl: values.DATABASE_URL,
    migrateOnStart: values.MIGRATE_ON_START,
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
