import { afterEach, describe, expect, it, vi } from 'vitest'
import { runRuntimeChecks } from './diagnostics'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('runRuntimeChecks', () => {
  it('sous Node, tous les contrôles passent (sans sonde : aucun contrôle réseau)', async () => {
    const checks = await runRuntimeChecks()
    expect(checks.filter((check) => !check.ok)).toEqual([])
    const names = checks.map((check) => check.name)
    expect(names).toEqual(
      expect.arrayContaining([
        'Intl.supportedValuesOf',
        'Intl.DateTimeFormat (timeZone)',
        'isValidTimeZone',
        'normalize(NFD) + \\p{M}',
        '\\p{P}',
        'normalizeForComparison',
        'formatDate',
        'formatNumber',
        'toLocaleString (fr-FR)',
        'URL / URLSearchParams',
        'structuredClone',
      ]),
    )
    expect(names).not.toContain('Appel API')
    for (const check of checks) expect(check.detail).not.toBe('')
  })

  it('montre les espaces insécables dans le détail', async () => {
    const checks = await runRuntimeChecks()
    expect(checks.find((check) => check.name === 'formatNumber')?.detail).toBe('"1\\u202f200"')
  })

  it('exécute la sonde injectée et rend sa durée', async () => {
    const probe = vi.fn(async () => ({ id: 'demo' }))
    const checks = await runRuntimeChecks(probe)
    expect(probe).toHaveBeenCalledOnce()
    const api = checks.at(-1)
    expect(api).toMatchObject({ name: 'Appel API', ok: true })
    expect(api?.detail).toMatch(/^réponse en \d+ ms$/)
  })

  it('une sonde qui échoue donne ok: false avec son message, sans rejeter', async () => {
    const checks = await runRuntimeChecks(() => Promise.reject(new Error('Réseau indisponible.')))
    expect(checks.at(-1)).toEqual({
      name: 'Appel API',
      ok: false,
      detail: 'Réseau indisponible.',
    })
    expect(checks.slice(0, -1).every((check) => check.ok)).toBe(true)
  })

  it('une exception non-Error est convertie en texte', async () => {
    const checks = await runRuntimeChecks(() => Promise.reject('boum'))
    expect(checks.at(-1)).toMatchObject({ ok: false, detail: 'boum' })
  })

  it('isole chaque contrôle : une exception ne masque pas les autres', async () => {
    const total = (await runRuntimeChecks()).length
    vi.spyOn(Intl, 'supportedValuesOf').mockImplementation(() => {
      throw new TypeError('Intl.supportedValuesOf is not a function')
    })
    const checks = await runRuntimeChecks()
    expect(checks).toHaveLength(total)
    expect(checks.filter((check) => !check.ok)).toEqual([
      {
        name: 'Intl.supportedValuesOf',
        ok: false,
        detail: 'Intl.supportedValuesOf is not a function',
      },
    ])
  })

  it('une valeur inattendue (pas une exception) est un échec avec le détail', async () => {
    vi.spyOn(Number.prototype, 'toLocaleString').mockReturnValue('1,200')
    const checks = await runRuntimeChecks()
    expect(checks.find((check) => check.name === 'toLocaleString (fr-FR)')).toEqual({
      name: 'toLocaleString (fr-FR)',
      ok: false,
      detail: 'obtenu "1,200", attendu "1\\u202f200"',
    })
  })
})
