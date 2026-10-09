import { getConnInfo } from '@hono/node-server/conninfo'
import type { Context } from 'hono'
import { createMiddleware } from 'hono/factory'
import { z } from 'zod'
import type { User } from '../db/schema'
import { ApiError } from '../errors'
import type { AppEnv } from '../types'
import type { TrustedProxyMatcher } from './trusted-proxies'

/** Identité transmise par Authelia via nginx (ou injectée par le mode de dev). */
export interface Identity {
  username: string
  email: string | null
  displayName: string
  groups: string[]
}

// Ni espace, ni virgule (des en-têtes dupliqués seraient fusionnés avec « , »), ni caractère de contrôle.
const USERNAME_RE = /^[^\s,\p{C}]{1,128}$/u
const emailSchema = z.email().max(254)

export function isValidUsername(value: string): boolean {
  return USERNAME_RE.test(value)
}

/**
 * Node lit les en-têtes en latin1 alors qu'Authelia envoie de l'UTF-8 (« Jérôme »).
 * On réinterprète les octets en UTF-8 quand c'est valide, sinon on garde la valeur telle quelle.
 */
export function decodeHeaderValue(raw: string): string {
  let hasHighByte = false
  for (let i = 0; i < raw.length; i++) {
    const code = raw.charCodeAt(i)
    if (code > 0xff) return raw // déjà une vraie chaîne Unicode, pas des octets latin1
    if (code >= 0x80) hasHighByte = true
  }
  if (!hasHighByte) return raw
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(Buffer.from(raw, 'latin1'))
  } catch {
    return raw
  }
}

function cleanText(value: string | undefined, maxLength: number): string | null {
  if (value === undefined) return null
  const text = decodeHeaderValue(value)
    .replace(/\p{Cc}/gu, '')
    .trim()
  return text === '' ? null : text.slice(0, maxLength)
}

/** Construit l'identité depuis les en-têtes Remote-*. Renvoie null si Remote-User est absent ou invalide. */
export function parseIdentityHeaders(
  header: (name: string) => string | undefined,
): Identity | null {
  const username = header('remote-user')?.trim()
  if (!username || !isValidUsername(username)) return null

  const email = cleanText(header('remote-email'), 254)
  const groups = (cleanText(header('remote-groups'), 2000) ?? '')
    .split(',')
    .map((group) => group.trim())
    .filter((group, index, all) => group !== '' && all.indexOf(group) === index)

  return {
    username,
    email: email && emailSchema.safeParse(email).success ? email : null,
    displayName: cleanText(header('remote-name'), 200) ?? username,
    groups,
  }
}

export type ClientIpResolver = (c: Context<AppEnv>) => string | undefined

/** Adresse du pair TCP (le reverse proxy), jamais X-Forwarded-For qui est contrôlable par le client. */
export const socketAddress: ClientIpResolver = (c) => getConnInfo(c).remote.address

interface IdentityOptions {
  /** Identité fixe du mode de dev (DEV_AUTH_USER) ; null en production. */
  devIdentity: Identity | null
  trustedProxies: TrustedProxyMatcher
  resolveUser: (identity: Identity) => Promise<User>
  clientIp?: ClientIpResolver
}

export function identity({
  devIdentity,
  trustedProxies,
  resolveUser,
  clientIp = socketAddress,
}: IdentityOptions) {
  return createMiddleware<AppEnv>(async (c, next) => {
    let current = devIdentity

    if (!current) {
      const address = clientIp(c)
      if (!(await trustedProxies.isTrusted(address))) {
        console.warn(
          `Requête refusée : ${address ?? 'adresse inconnue'} n'est pas un proxy de confiance`,
        )
        throw new ApiError(
          403,
          'UNTRUSTED_PROXY',
          "Cette requête ne provient pas du reverse proxy d'authentification.",
        )
      }
      current = parseIdentityHeaders((name) => c.req.header(name))
      if (!current) {
        throw new ApiError(
          401,
          'UNAUTHENTICATED',
          'Identité absente ou invalide : reconnectez-vous.',
        )
      }
    }

    c.set('user', await resolveUser(current))
    c.set('groups', current.groups)
    await next()
  })
}
