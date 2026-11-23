/**
 * Garde de pureté. Vitest tourne dans Node : un test qui atteindrait `react-native` (même par un
 * import indirect) casserait toute la suite.
 *
 * - Règle 1 : les `.ts` de `src/{auth,offline,notifications,lib}` n'importent ni React, ni React
 *   Native, ni Expo, ni React Navigation, sauf les adaptateurs appareil et les hooks (voir
 *   `EXEMPT_FROM_RULE_1`).
 * - Règle 2 : tout fichier atteint (imports statiques et dynamiques, relatifs ou `@/`) depuis un
 *   `*.test.ts` doit être pur : ni `.tsx`, ni module interdit. Les barrels (`index.ts`) qui
 *   ré-exportent un `.tsx` sont donc impurs : un test importe le fichier précis.
 *
 * Les imports sont lus par regex sur les spécificateurs. Limites assumées : un `import(...)` dans une
 * annotation de type compte comme un import réel ; les gabarits `${…}` imbriqués ne sont pas analysés.
 */
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const SRC = resolve(fileURLToPath(new URL('.', import.meta.url)))
const SELF = 'architecture.test.ts'
const PURE_DIRS = ['auth', 'offline', 'notifications', 'lib']

const FORBIDDEN_MODULES = [
  /^react$/,
  /^react\//,
  /^react-native(?:$|[/-])/,
  /^expo(?:$|[/-])/,
  /^@expo\//,
  /^@react-native/,
  /^@react-navigation\//,
]

/**
 * Fichiers de `PURE_DIRS` autorisés à importer des modules interdits : hooks (`use-*.ts`,
 * `hooks.ts`), adaptateurs appareil (`*-adapter.ts`, `*-adapters.ts`, `adapters.ts`, `device.ts`),
 * `queries.ts` et `api.ts` (react-query, `authFetch`). Un fichier `adapter.ts` n'en fait PAS partie.
 */
const EXEMPT_FROM_RULE_1 = [
  /^use-.+\.ts$/,
  /-adapters?\.ts$/,
  /^adapters\.ts$/,
  /^(?:queries|api|device|hooks)\.ts$/,
]

function isForbidden(specifier: string): boolean {
  return FORBIDDEN_MODULES.some((pattern) => pattern.test(specifier))
}

function isExemptFromRule1(fileName: string): boolean {
  return EXEMPT_FROM_RULE_1.some((pattern) => pattern.test(fileName))
}

/** Remplace les commentaires par des blancs ; les chaînes sont conservées (les spécificateurs y vivent). */
function stripComments(source: string): string {
  let out = ''
  let i = 0
  while (i < source.length) {
    const char = source.charAt(i)
    const next = source.charAt(i + 1)
    if (char === '/' && next === '/') {
      while (i < source.length && source.charAt(i) !== '\n') i++
    } else if (char === '/' && next === '*') {
      const end = source.indexOf('*/', i + 2)
      const stop = end === -1 ? source.length : end + 2
      out += source.slice(i, stop).replace(/[^\n]/g, ' ')
      i = stop
    } else if (char === "'" || char === '"' || char === '`') {
      const start = i
      i++
      while (i < source.length && source.charAt(i) !== char) {
        if (source.charAt(i) === '\\') i++
        // Chaîne non terminée (guillemet dans un littéral de regex) : on s'arrête à la ligne.
        else if (char !== '`' && source.charAt(i) === '\n') break
        i++
      }
      i++
      out += source.slice(start, i)
    } else {
      out += char
      i++
    }
  }
  return out
}

// `import|export … from '…'` : la tête ne peut contenir ni quote ni autre `import`/`export`, pour ne
// pas enjamber l'instruction précédente (le style du dépôt n'a pas de point-virgule).
const FROM_STATEMENT =
  /\b(import|export)\b((?:(?!\b(?:import|export)\b)[\w\s,{}*$])*?)\bfrom\s*(['"])([^'"\n]+)\3/g
const SIDE_EFFECT_IMPORT = /\bimport\s*(['"])([^'"\n]+)\1/g
const DYNAMIC_IMPORT = /\b(?:import|require)\s*\(\s*(['"])([^'"\n]+)\1\s*\)/g

/**
 * Spécificateurs conservés À L'EXÉCUTION. `import type …` et `export type … from` (instruction
 * entière) sont effacés par le compilateur ; `import { type X } from` est conservé sous
 * `verbatimModuleSyntax` et compte.
 */
function runtimeImports(source: string): string[] {
  const code = stripComments(source)
  const specifiers = new Set<string>()
  for (const match of code.matchAll(FROM_STATEMENT)) {
    const head = match[2] ?? ''
    const specifier = match[4]
    if (specifier === undefined || /^\s+type\b(?!\s*,)/.test(head)) continue
    specifiers.add(specifier)
  }
  for (const pattern of [SIDE_EFFECT_IMPORT, DYNAMIC_IMPORT]) {
    for (const match of code.matchAll(pattern)) {
      if (match[2] !== undefined) specifiers.add(match[2])
    }
  }
  return [...specifiers]
}

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile()
  } catch {
    return false
  }
}

/** Fichier ciblé par un import relatif ou `@/` ; `null` pour un module externe ou introuvable. */
function resolveImport(specifier: string, from: string): string | null {
  let base: string
  if (specifier.startsWith('@/')) base = join(SRC, specifier.slice(2))
  else if (specifier.startsWith('.')) base = resolve(dirname(from), specifier)
  else return null
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    join(base, 'index.ts'),
    join(base, 'index.tsx'),
  ]
  return candidates.find(isFile) ?? null
}

function listFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const path = join(dir, entry.name)
      return entry.isDirectory() ? listFiles(path) : [path]
    })
    .sort()
}

const display = (path: string) => `src/${relative(SRC, path).split(sep).join('/')}`

/**
 * Règle 2 pour un fichier d'entrée : parcourt ses imports transitivement et décrit chaque
 * violation avec la chaîne d'imports (`a.test.ts → b.ts → c.tsx`).
 */
function findImpurities(entry: string, show: (path: string) => string = display): string[] {
  const parents = new Map<string, string | null>([[entry, null]])
  const queue = [entry]
  const violations: string[] = []
  const chainTo = (file: string): string => {
    const names: string[] = []
    for (let current: string | null | undefined = file; current; current = parents.get(current)) {
      names.unshift(show(current))
    }
    return names.join(' → ')
  }

  for (let file = queue.shift(); file !== undefined; file = queue.shift()) {
    if (file.endsWith('.tsx')) {
      violations.push(`${chainTo(file)} : composant .tsx atteint depuis un test`)
      continue
    }
    for (const specifier of runtimeImports(readFileSync(file, 'utf8'))) {
      if (isForbidden(specifier)) violations.push(`${chainTo(file)} → import de « ${specifier} »`)
      const target = resolveImport(specifier, file)
      if (target && /\.tsx?$/.test(target) && !parents.has(target)) {
        parents.set(target, file)
        queue.push(target)
      }
    }
  }
  return violations
}

describe('règle 1 : modules purs', () => {
  it('aucun .ts de auth, offline, notifications et lib n’importe React, React Native ou Expo', () => {
    const files = PURE_DIRS.flatMap((dir) => listFiles(join(SRC, dir))).filter(
      (file) =>
        file.endsWith('.ts') && !file.endsWith('.d.ts') && !isExemptFromRule1(basename(file)),
    )
    const violations = files.flatMap((file) =>
      runtimeImports(readFileSync(file, 'utf8'))
        .filter(isForbidden)
        .map((specifier) => `${display(file)} importe « ${specifier} »`),
    )
    expect(
      violations,
      'Module impur : le renommer en use-*.ts / *-adapter.ts / *.tsx, ou injecter la dépendance.',
    ).toEqual([])
  })
})

describe('règle 2 : les tests n’atteignent que des fichiers purs', () => {
  const tests = listFiles(SRC).filter(
    (file) => file.endsWith('.test.ts') && basename(file) !== SELF,
  )
  it.each(tests.map((file): [string, string] => [display(file), file]))('%s', (_name, file) => {
    expect(
      findImpurities(file),
      'Un test (même indirectement) charge du code React Native : importer le fichier pur précis, pas un barrel.',
    ).toEqual([])
  })
})

describe('helpers', () => {
  it('stripComments : retire les commentaires, garde les chaînes', () => {
    const code = [
      "// import a from 'a'",
      "const url = 'https://exemple.fr' // import b from 'b'",
      "/* import c from 'c'\n   import d from 'd' */",
      'import e from "e"',
    ].join('\n')
    expect(runtimeImports(code)).toEqual(['e'])
    expect(stripComments(code)).toContain("'https://exemple.fr'")
  })

  it('runtimeImports : instructions statiques, multi-lignes, ré-exports, effets de bord, dynamiques', () => {
    const code = `
import a from 'a'
import * as b from 'b'
import {
  c,
  d,
} from 'c'
export { e } from 'e'
export * from 'f'
import 'g'
const h = await import('h')
const i = require('i')
`
    expect(runtimeImports(code)).toEqual(['a', 'b', 'c', 'e', 'f', 'g', 'h', 'i'])
  })

  it('runtimeImports : ignore les imports de types, compte `{ type X }`', () => {
    const code = `
import type { A } from 'type-only'
import type B from 'type-default'
export type { C } from 'type-reexport'
import { type D } from 'inline-type'
export { type E } from 'inline-reexport'
import type, { f } from 'default-named-type'
`
    expect(runtimeImports(code)).toEqual(['inline-type', 'inline-reexport', 'default-named-type'])
  })

  it('runtimeImports : un import de type après une instruction sans point-virgule reste un type', () => {
    const code = `export const x = 1
import type { A } from 'type-only'
export default x
import { y } from 'runtime'
`
    expect(runtimeImports(code)).toEqual(['runtime'])
  })

  it('isForbidden : React, React Native, Expo, React Navigation', () => {
    for (const name of [
      'react',
      'react/jsx-runtime',
      'react-native',
      'react-native-screens',
      'expo',
      'expo/fetch',
      'expo-router',
      'expo-router/js-tabs',
      '@expo/vector-icons',
      '@expo/vector-icons/Feather',
      '@react-native-community/netinfo',
      '@react-native-async-storage/async-storage',
      '@react-navigation/native',
    ]) {
      expect(isForbidden(name), name).toBe(true)
    }
    for (const name of [
      'react-hook-form',
      '@tanstack/react-query',
      '@quizlet/shared',
      'zod',
      'vitest',
      'node:fs',
      './react',
      '@/lib/routes',
    ]) {
      expect(isForbidden(name), name).toBe(false)
    }
  })

  it('isExemptFromRule1 : hooks, adaptateurs, queries, api, device', () => {
    for (const name of [
      'use-id-param.ts',
      'reminder-adapter.ts',
      'file-adapters.ts',
      'adapters.ts',
      'queries.ts',
      'api.ts',
      'device.ts',
      'hooks.ts',
    ]) {
      expect(isExemptFromRule1(name), name).toBe(true)
    }
    for (const name of ['routes.ts', 'adapter.ts', 'plan-reminder.ts', 'user.ts', 'use.ts']) {
      expect(isExemptFromRule1(name), name).toBe(false)
    }
  })

  it('resolveImport : alias, relatif, index, externe, introuvable', () => {
    const self = join(SRC, SELF)
    expect(resolveImport('@/config', self)).toBe(join(SRC, 'config.ts'))
    expect(resolveImport('./config', self)).toBe(join(SRC, 'config.ts'))
    expect(resolveImport('@/ui', self)).toBe(join(SRC, 'ui', 'index.ts'))
    expect(resolveImport('@/ui/Screen', self)).toBe(join(SRC, 'ui', 'Screen.tsx'))
    expect(resolveImport('@quizlet/shared', self)).toBeNull()
    expect(resolveImport('./introuvable', self)).toBeNull()
  })

  it('findImpurities : suit la chaîne d’imports et signale .tsx et modules interdits', () => {
    const dir = mkdtempSync(join(tmpdir(), 'architecture-'))
    try {
      const write = (name: string, content: string) => writeFileSync(join(dir, name), content)
      const show = (path: string) => basename(path)
      write('entry.test.ts', "import { b } from './b'\nimport type { T } from './type-only.tsx'\n")
      write('b.ts', "export { c } from './c'\n")
      write('c.ts', "import { View } from 'react-native'\nimport { d } from './d.tsx'\n")
      write('d.tsx', "import 'react'\n")
      write('type-only.tsx', "import 'react'\n")
      expect(findImpurities(join(dir, 'entry.test.ts'), show)).toEqual([
        'entry.test.ts → b.ts → c.ts → import de « react-native »',
        'entry.test.ts → b.ts → c.ts → d.tsx : composant .tsx atteint depuis un test',
      ])
      write('c.ts', 'export const c = 1\n')
      expect(findImpurities(join(dir, 'entry.test.ts'), show)).toEqual([])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
