import { formatDate, formatNumber, isValidTimeZone, normalizeForComparison } from '@quizlet/shared'

export interface RuntimeCheck {
  /** Libellé court (« Intl.supportedValuesOf », « \p{M} »…). */
  name: string
  ok: boolean
  /** Valeur observée ou message d'erreur. */
  detail: string
}

/** Rend visibles les espaces insécables (U+00A0, U+2009, U+202F) du français. */
function show(value: unknown): string {
  return JSON.stringify(value).replace(
    /[   ]/g,
    (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`,
  )
}

/** Renvoie la valeur observée si elle est conforme, sinon lève (= contrôle en échec). */
function expectEqual<T>(actual: T, expected: T): string {
  if (actual !== expected) throw new Error(`obtenu ${show(actual)}, attendu ${show(expected)}`)
  return show(actual)
}

/** Contrôles synchrones ; chacun renvoie la valeur observée et lève s'il échoue. */
const CHECKS: Array<[name: string, run: () => string]> = [
  [
    'Intl.supportedValuesOf',
    () => {
      const zones = Intl.supportedValuesOf('timeZone')
      if (zones.length === 0) throw new Error('liste vide')
      return `${zones.length} fuseaux`
    },
  ],
  [
    'Intl.DateTimeFormat (timeZone)',
    () => {
      // 12 h UTC un jour d'octobre : Paris est alors en UTC+2.
      const format = new Intl.DateTimeFormat('fr-FR', {
        timeZone: 'Europe/Paris',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      })
      return expectEqual(format.format(new Date(Date.UTC(2026, 9, 9, 12, 0))), '14:00')
    },
  ],
  [
    'isValidTimeZone',
    () => {
      if (!isValidTimeZone('Europe/Paris')) throw new Error('Europe/Paris refusé')
      if (isValidTimeZone('Pas/UnFuseau')) throw new Error('fuseau inconnu accepté')
      return 'Europe/Paris accepté, Pas/UnFuseau refusé'
    },
  ],
  [
    'normalize(NFD) + \\p{M}',
    () => expectEqual('éàü'.normalize('NFD').replace(/\p{M}/gu, ''), 'eau'),
  ],
  ['\\p{P}', () => expectEqual('a,b!c?'.replace(/\p{P}/gu, ''), 'abc')],
  [
    'normalizeForComparison',
    () => expectEqual(normalizeForComparison('  Été, déjà ! '), 'ete deja'),
  ],
  ['formatDate', () => expectEqual(formatDate(new Date(2026, 9, 9)), '9 octobre 2026')],
  ['formatNumber', () => expectEqual(formatNumber(1200), '1 200')],
  ['toLocaleString (fr-FR)', () => expectEqual((1200).toLocaleString('fr-FR'), '1 200')],
  [
    'toLocaleDateString (fr-FR)',
    () => expectEqual(new Date(2026, 9, 9).toLocaleDateString('fr-FR'), '09/10/2026'),
  ],
  [
    'URL / URLSearchParams',
    () => {
      const url = new URL('https://example.com/sets/abc?x=1&y=a%20b#haut')
      return show([
        url.hostname,
        url.pathname,
        url.searchParams.get('x'),
        url.searchParams.get('y'),
      ])
    },
  ],
  [
    'structuredClone',
    () => {
      const source = { liste: [1, 2], date: new Date(0) }
      const copy = structuredClone(source)
      if (copy === source || copy.liste === source.liste) throw new Error('copie partagée')
      expectEqual(copy.date.getTime(), 0)
      return 'copie profonde'
    },
  ],
]

/**
 * Diagnostic du moteur Hermes (écran Diagnostics, visible en `__DEV__` seulement) : `Intl`
 * (supportedValuesOf, DateTimeFormat avec `timeZone`), `normalize('NFD')`, `\p{M}` / `\p{P}`,
 * `toLocale*`, fonctions de `@quizlet/shared`. Chaque contrôle est isolé (try/catch) : un échec ne
 * masque pas les autres. `probe` : appel d'API injecté par l'écran (`() => unwrap(api.me.$get())`),
 * sans quoi ce module importerait `api` et ne serait plus testable sous Node ; absent = contrôle
 * réseau omis.
 */
export async function runRuntimeChecks(probe?: () => Promise<unknown>): Promise<RuntimeCheck[]> {
  const results: RuntimeCheck[] = []
  const run = async (name: string, check: () => string | Promise<string>) => {
    try {
      results.push({ name, ok: true, detail: await check() })
    } catch (error) {
      results.push({
        name,
        ok: false,
        detail: error instanceof Error ? error.message : String(error),
      })
    }
  }
  for (const [name, check] of CHECKS) await run(name, check)
  if (probe) {
    await run('Appel API', async () => {
      const start = Date.now()
      await probe()
      return `réponse en ${Date.now() - start} ms`
    })
  }
  return results
}
