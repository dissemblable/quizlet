import { describe, expect, it } from 'vitest'
import { buildConfig, ConfigError, config } from './config'

const ENV = {
  EXPO_PUBLIC_API_URL: 'https://quizlet.example.com',
  EXPO_PUBLIC_AUTH_URL: 'https://auth.example.com',
  EXPO_PUBLIC_OIDC_CLIENT_ID: 'quizlet-mobile',
}

describe('buildConfig', () => {
  it('calcule la configuration à partir de variables valides', () => {
    expect(buildConfig(ENV)).toEqual({
      apiUrl: 'https://quizlet.example.com',
      webUrl: 'https://quizlet.example.com',
      authUrl: 'https://auth.example.com',
      clientId: 'quizlet-mobile',
      scope: 'authelia.bearer.authz offline_access',
      resource: 'https://quizlet.example.com/api',
      redirectUri: 'https://quizlet.example.com/api/mobile/callback',
      callbackUrl: 'quizlet://callback',
    })
  })

  it('refuse une URL http', () => {
    expect(() =>
      buildConfig({ ...ENV, EXPO_PUBLIC_API_URL: 'http://quizlet.example.com' }),
    ).toThrow(ConfigError)
    expect(() => buildConfig({ ...ENV, EXPO_PUBLIC_AUTH_URL: 'http://auth.example.com' })).toThrow(
      /https/,
    )
  })

  it('refuse une URL sans hôte ou avec requête', () => {
    expect(() => buildConfig({ ...ENV, EXPO_PUBLIC_API_URL: 'https://' })).toThrow(ConfigError)
    expect(() => buildConfig({ ...ENV, EXPO_PUBLIC_API_URL: 'https://a.example.com?x=1' })).toThrow(
      ConfigError,
    )
  })

  it.each(['EXPO_PUBLIC_API_URL', 'EXPO_PUBLIC_AUTH_URL', 'EXPO_PUBLIC_OIDC_CLIENT_ID'])(
    'signale la variable absente %s',
    (name) => {
      expect(() => buildConfig({ ...ENV, [name]: undefined })).toThrow(
        new RegExp(`manquante : ${name}`),
      )
      expect(() => buildConfig({ ...ENV, [name]: '  ' })).toThrow(ConfigError)
    },
  )

  it('retire le « / » final', () => {
    const result = buildConfig({
      ...ENV,
      EXPO_PUBLIC_API_URL: 'https://quizlet.example.com/',
      EXPO_PUBLIC_AUTH_URL: 'https://auth.example.com//',
    })
    expect(result.apiUrl).toBe('https://quizlet.example.com')
    expect(result.authUrl).toBe('https://auth.example.com')
    expect(result.resource).toBe('https://quizlet.example.com/api')
  })
})

describe('config', () => {
  it("lit l'environnement de test (vitest.config.mts)", () => {
    expect(config.apiUrl).toBe('https://quizlet.example.com')
    expect(config.clientId).toBe('quizlet-mobile')
  })
})
