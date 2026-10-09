import { lookup } from 'node:dns/promises'
import { BlockList, isIP } from 'node:net'

export type HostResolver = (hostname: string) => Promise<string[]>

export interface TrustedProxyMatcher {
  /** Vrai si l'adresse du pair TCP correspond à un proxy de confiance. */
  isTrusted(address: string | undefined): Promise<boolean>
}

interface MatcherOptions {
  resolve?: HostResolver
  /** Durée de validité des noms résolus. */
  ttlMs?: number
  /** Délai minimal entre deux résolutions déclenchées par une adresse inconnue. */
  missRefreshMs?: number
  now?: () => number
  onResolveError?: (hostname: string, error: unknown) => void
}

const HOSTNAME_RE =
  /^(?=.{1,253}$)[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/i

const defaultResolver: HostResolver = async (hostname) =>
  (await lookup(hostname, { all: true })).map((entry) => entry.address)

/** Ramène une adresse IPv4 encapsulée (`::ffff:10.0.0.1`) à sa forme IPv4. */
export function normalizeIp(address: string): string {
  const lower = address.trim().toLowerCase()
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(lower)
  return mapped?.[1] ?? lower
}

function family(ip: string): 'ipv4' | 'ipv6' | null {
  const version = isIP(ip)
  return version === 4 ? 'ipv4' : version === 6 ? 'ipv6' : null
}

type ParsedEntry =
  | { kind: 'address'; ip: string; family: 'ipv4' | 'ipv6' }
  | { kind: 'subnet'; ip: string; prefix: number; family: 'ipv4' | 'ipv6' }
  | { kind: 'hostname'; hostname: string }

/** Analyse une entrée de TRUSTED_PROXIES : IP, CIDR ou nom d'hôte. Renvoie null si invalide. */
export function parseTrustedProxyEntry(raw: string): ParsedEntry | null {
  const entry = raw.trim()
  const slash = entry.indexOf('/')
  if (slash !== -1) {
    const ip = normalizeIp(entry.slice(0, slash))
    const prefixText = entry.slice(slash + 1)
    const ipFamily = family(ip)
    if (!ipFamily || !/^\d{1,3}$/.test(prefixText)) return null
    const prefix = Number(prefixText)
    if (prefix > (ipFamily === 'ipv4' ? 32 : 128)) return null
    return { kind: 'subnet', ip, prefix, family: ipFamily }
  }
  const ip = normalizeIp(entry)
  const ipFamily = family(ip)
  if (ipFamily) return { kind: 'address', ip, family: ipFamily }
  if (HOSTNAME_RE.test(entry)) return { kind: 'hostname', hostname: entry.toLowerCase() }
  return null
}

export function createTrustedProxyMatcher(
  entries: readonly string[],
  options: MatcherOptions = {},
): TrustedProxyMatcher {
  const {
    resolve = defaultResolver,
    ttlMs = 30_000,
    missRefreshMs = 5_000,
    now = Date.now,
    onResolveError = (hostname, error) =>
      console.warn(`Proxy de confiance « ${hostname} » non résolu :`, error),
  } = options

  const blockList = new BlockList()
  const hostnames: string[] = []
  for (const raw of entries) {
    const entry = parseTrustedProxyEntry(raw)
    if (!entry) throw new Error(`Entrée TRUSTED_PROXIES invalide : « ${raw} »`)
    if (entry.kind === 'address') blockList.addAddress(entry.ip, entry.family)
    else if (entry.kind === 'subnet') blockList.addSubnet(entry.ip, entry.prefix, entry.family)
    else hostnames.push(entry.hostname)
  }

  // Adresses des noms d'hôte (ex. le conteneur `nginx`, dont l'IP change à chaque recréation).
  let resolved = new Set<string>()
  let resolvedAt = Number.NEGATIVE_INFINITY
  let pending: Promise<void> | null = null

  async function refresh(): Promise<void> {
    const next = new Set<string>()
    await Promise.all(
      hostnames.map(async (hostname) => {
        try {
          for (const address of await resolve(hostname)) next.add(normalizeIp(address))
        } catch (error) {
          // Échec de résolution : ce nom n'autorise aucune adresse (fail-closed).
          onResolveError(hostname, error)
        }
      }),
    )
    resolved = next
    resolvedAt = now()
  }

  function refreshOnce(): Promise<void> {
    pending ??= refresh().finally(() => {
      pending = null
    })
    return pending
  }

  return {
    async isTrusted(address) {
      if (!address) return false
      const ip = normalizeIp(address)
      const ipFamily = family(ip)
      if (!ipFamily) return false
      if (blockList.check(ip, ipFamily)) return true
      if (hostnames.length === 0) return false

      const age = now() - resolvedAt
      if (age > ttlMs || (!resolved.has(ip) && age > missRefreshMs)) await refreshOnce()
      return resolved.has(ip)
    },
  }
}
