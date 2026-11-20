import type { AppType } from '@quizlet/api'
import { hc } from 'hono/client'
import { authFetch } from '@/auth'
import { config } from '@/config'

/** Client RPC typé de bout en bout (types dérivés des routes Hono). Bearer ajouté par `authFetch`. */
export const api = hc<AppType>(config.apiUrl, { fetch: authFetch }).api
