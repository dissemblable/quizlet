import { describe, expect, it } from 'vitest'
import { ConfigError, parseConfig } from './env'

const base = { DATABASE_URL: 'postgres://u:p@localhost:5432/db' }

describe('parseConfig', () => {
  it('applique des valeurs par défaut sûres', () => {
    const config = parseConfig(base)
    expect(config.nodeEnv).toBe('production')
    expect(config.host).toBe('127.0.0.1')
    expect(config.port).toBe(3000)
    expect(config.migrateOnStart).toBe(false)
  })

  it('convertit le port et les booléens', () => {
    const config = parseConfig({ ...base, PORT: '8080', MIGRATE_ON_START: 'true' })
    expect(config.port).toBe(8080)
    expect(config.migrateOnStart).toBe(true)
  })

  it('traite une variable vide comme absente', () => {
    const config = parseConfig({ ...base, NODE_ENV: '', PORT: ' ' })
    expect(config.nodeEnv).toBe('production')
    expect(config.port).toBe(3000)
  })

  it('refuse une URL de base de données absente ou invalide', () => {
    expect(() => parseConfig({})).toThrow(ConfigError)
    expect(() => parseConfig({ DATABASE_URL: 'mysql://localhost/db' })).toThrow(/DATABASE_URL/)
  })

  it('refuse un NODE_ENV inconnu', () => {
    expect(() => parseConfig({ ...base, NODE_ENV: 'staging' })).toThrow(ConfigError)
  })
})
