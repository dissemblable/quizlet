/** Configuration de l'app : variables `EXPO_PUBLIC_*`, incluses dans le bundle (aucun secret). */
export interface AppConfig {
  /** Origine de l'API (https, sans « / » final). */
  apiUrl: string
  /** Origine du site web (lien copié d'un set) : même hôte que l'API. */
  webUrl: string
  /** Origine du portail Authelia (OIDC). */
  authUrl: string
  /** Identifiant du client OIDC public enregistré chez Authelia. */
  clientId: string
  scope: string
  /** Ressource / audience demandée au jeton : `${apiUrl}/api`. */
  resource: string
  /** URL https enregistrée chez Authelia : le relais de l'API y reçoit le `form_post`. */
  redirectUri: string
  /** Lien profond de l'app, vers lequel le relais renvoie (`quizlet://callback`). */
  callbackUrl: string
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConfigError'
  }
}

const SCOPE = 'authelia.bearer.authz offline_access'
const CALLBACK_URL = 'quizlet://callback'

function readRequired(env: Record<string, string | undefined>, name: string): string {
  const value = env[name]?.trim()
  if (!value) {
    throw new ConfigError(
      `Variable d'environnement manquante : ${name}. Copiez .env.example vers .env et renseignez-la.`,
    )
  }
  return value
}

// Chaînes et regex, pas `URL` : ses accesseurs sont incomplets sur Hermes.
function readHttpsUrl(env: Record<string, string | undefined>, name: string): string {
  const value = readRequired(env, name)
  if (!/^https:\/\/[^\s/?#]+(\/[^\s?#]*)?$/.test(value)) {
    throw new ConfigError(
      `${name} doit être une URL https sans requête ni fragment (reçu : « ${value} »).`,
    )
  }
  return value.replace(/\/+$/, '')
}

/** Valide l'environnement et calcule la configuration. Pure : l'environnement est injecté. */
export function buildConfig(env: Record<string, string | undefined>): AppConfig {
  const apiUrl = readHttpsUrl(env, 'EXPO_PUBLIC_API_URL')
  const authUrl = readHttpsUrl(env, 'EXPO_PUBLIC_AUTH_URL')
  const clientId = readRequired(env, 'EXPO_PUBLIC_OIDC_CLIENT_ID')
  return {
    apiUrl,
    webUrl: apiUrl,
    authUrl,
    clientId,
    scope: SCOPE,
    resource: `${apiUrl}/api`,
    redirectUri: `${apiUrl}/api/mobile/callback`,
    callbackUrl: CALLBACK_URL,
  }
}

// Références STATIQUES : Metro n'inline `process.env.EXPO_PUBLIC_*` que sous cette forme.
export const config: AppConfig = buildConfig({
  EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
  EXPO_PUBLIC_AUTH_URL: process.env.EXPO_PUBLIC_AUTH_URL,
  EXPO_PUBLIC_OIDC_CLIENT_ID: process.env.EXPO_PUBLIC_OIDC_CLIENT_ID,
})
