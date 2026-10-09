import type { AppType } from '@quizlet/api'
import { hc } from 'hono/client'
import { apiFetch } from './http'

/** Client RPC typé de bout en bout : les types viennent directement des routes Hono. */
export const api = hc<AppType>(window.location.origin, { fetch: apiFetch }).api
