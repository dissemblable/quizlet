import { describe, expect, it } from 'vitest'
import { ConfigError, parseConfig } from './env'

/** Configuration de production minimale et valide. */
const prod = {
  DATABASE_URL: 'postgres://u:p@db:5432/quizlet',
  TRUSTED_PROXIES: 'nginx',
  APP_ORIGIN: 'https://quizlet.example.test',
  AUTH_LOGOUT_URL: 'https://auth.example.test/logout',
}
const dev = { NODE_ENV: 'development', DATABASE_URL: 'postgres://u:p@localhost:5433/quizlet' }

describe('parseConfig', () => {
  it('applique des valeurs par défaut sûres', () => {
    const config = parseConfig(prod)
    expect(config).toMatchObject({
      nodeEnv: 'production',
      host: '127.0.0.1',
      port: 3000,
      migrateOnStart: false,
      trustedProxies: ['nginx'],
      appOrigins: ['https://quizlet.example.test'],
      corsOrigins: [],
      logoutUrl: 'https://auth.example.test/logout',
      devIdentity: null,
    })
  })

  it('convertit le port, les booléens et les listes', () => {
    const config = parseConfig({
      ...prod,
      PORT: '8080',
      MIGRATE_ON_START: 'true',
      TRUSTED_PROXIES: 'nginx, 10.0.0.0/8 ,::1',
    })
    expect(config.port).toBe(8080)
    expect(config.migrateOnStart).toBe(true)
    expect(config.trustedProxies).toEqual(['nginx', '10.0.0.0/8', '::1'])
  })

  it('traite une variable vide comme absente', () => {
    const config = parseConfig({ ...prod, PORT: ' ', DEV_AUTH_USER: '', ANTHROPIC_API_KEY: '' })
    expect(config.port).toBe(3000)
    expect(config.devIdentity).toBeNull()
    expect(config.anthropicApiKey).toBeNull()
  })

  it("lit la clé de l'API Claude, facultative", () => {
    expect(parseConfig({ ...prod, ANTHROPIC_API_KEY: ' sk-ant-test ' }).anthropicApiKey).toBe(
      'sk-ant-test',
    )
  })

  it('refuse une URL de base de données absente ou invalide', () => {
    expect(() => parseConfig({ ...prod, DATABASE_URL: undefined })).toThrow(ConfigError)
    expect(() => parseConfig({ ...prod, DATABASE_URL: 'mysql://localhost/db' })).toThrow(
      /DATABASE_URL/,
    )
  })

  it('refuse un NODE_ENV inconnu', () => {
    expect(() => parseConfig({ ...prod, NODE_ENV: 'staging' })).toThrow(ConfigError)
  })

  it('refuse des proxys ou des origines mal formés', () => {
    expect(() => parseConfig({ ...prod, TRUSTED_PROXIES: 'nginx,10.0.0.0/99' })).toThrow(
      /TRUSTED_PROXIES/,
    )
    expect(() => parseConfig({ ...prod, APP_ORIGIN: 'https://quizlet.example.test/' })).toThrow(
      /APP_ORIGIN/,
    )
    expect(() => parseConfig({ ...prod, CORS_ORIGINS: 'quizlet.example.test' })).toThrow(
      /CORS_ORIGINS/,
    )
  })
})

describe('règles de production', () => {
  it.each(['DEV_AUTH_USER', 'DEV_AUTH_EMAIL', 'DEV_AUTH_NAME', 'DEV_AUTH_GROUPS'])(
    'refuse de démarrer si %s est défini avec NODE_ENV=production',
    (key) => {
      const value = key === 'DEV_AUTH_EMAIL' ? 'demo@example.com' : 'demo'
      expect(() => parseConfig({ ...prod, NODE_ENV: 'production', [key]: value })).toThrow(
        /interdit en production/,
      )
    },
  )

  it('refuse aussi le mode dev quand NODE_ENV est absent (production par défaut)', () => {
    expect(() => parseConfig({ ...prod, DEV_AUTH_USER: 'demo' })).toThrow(/interdit en production/)
  })

  it.each(['TRUSTED_PROXIES', 'APP_ORIGIN', 'AUTH_LOGOUT_URL'])('exige %s en production', (key) => {
    expect(() => parseConfig({ ...prod, [key]: undefined })).toThrow(new RegExp(key))
  })
})

describe('mode de développement', () => {
  it("construit l'identité de test depuis DEV_AUTH_*", () => {
    const config = parseConfig({
      ...dev,
      DEV_AUTH_USER: 'demo',
      DEV_AUTH_NAME: 'Utilisateur Démo',
      DEV_AUTH_EMAIL: 'demo@example.com',
      DEV_AUTH_GROUPS: 'users,admins',
    })
    expect(config.devIdentity).toEqual({
      username: 'demo',
      displayName: 'Utilisateur Démo',
      email: 'demo@example.com',
      groups: ['users', 'admins'],
    })
  })

  it('a des valeurs par défaut adaptées au poste local', () => {
    const config = parseConfig(dev)
    expect(config.trustedProxies).toEqual(['127.0.0.1', '::1'])
    expect(config.appOrigins).toEqual(['http://localhost:5180'])
    expect(config.logoutUrl).toBeNull()
  })

  it("exige une écoute en loopback quand l'authentification de dev est active", () => {
    expect(() => parseConfig({ ...dev, DEV_AUTH_USER: 'demo', HOST: '0.0.0.0' })).toThrow(
      /loopback/,
    )
    expect(parseConfig({ ...dev, HOST: '0.0.0.0' }).host).toBe('0.0.0.0')
  })

  it('refuse un identifiant de dev invalide', () => {
    expect(() => parseConfig({ ...dev, DEV_AUTH_USER: 'demo user' })).toThrow(/DEV_AUTH_USER/)
  })
})
