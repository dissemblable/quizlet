import { IMPORT_MAX_BYTES, LIMITS, MESSAGES } from '@quizlet/shared'
import { describe, expect, it } from 'vitest'
import {
  appendPasted,
  buildPreview,
  canImport,
  INITIAL_CHOICES,
  INVALID_TEXT_MAX,
  importButtonLabel,
  importHeading,
  importProblem,
  importSuccessMessage,
  PREVIEW_ROWS,
  resolveSeparators,
  separatorError,
  termOptions,
  unescapeSeparator,
} from './import-form'

const TAB_NEWLINE = { term: '\t', card: '\n' }

describe('unescapeSeparator', () => {
  it('convertit « \\n » et « \\t » littéraux', () => {
    expect(unescapeSeparator('\\n')).toBe('\n')
    expect(unescapeSeparator('\\t')).toBe('\t')
    expect(unescapeSeparator('\\n\\n')).toBe('\n\n')
    expect(unescapeSeparator(' - ')).toBe(' - ')
    expect(unescapeSeparator('')).toBe('')
  })
})

describe('resolveSeparators', () => {
  it('suit la détection automatique du terme', () => {
    expect(resolveSeparators(INITIAL_CHOICES, ';')).toEqual({ term: ';', card: '\n' })
  })

  it('traduit les choix prédéfinis', () => {
    const choose = (term: 'tab' | 'comma' | 'semicolon') =>
      resolveSeparators({ ...INITIAL_CHOICES, term }, ';').term
    expect(choose('tab')).toBe('\t')
    expect(choose('comma')).toBe(',')
    expect(choose('semicolon')).toBe(';')
  })

  it('décode les séparateurs personnalisés et ignore le champ personnalisé sinon', () => {
    expect(
      resolveSeparators(
        { term: 'custom', customTerm: '\\t', card: 'custom', customCard: '\\n\\n' },
        ',',
      ),
    ).toEqual({ term: '\t', card: '\n\n' })
    expect(
      resolveSeparators({ ...INITIAL_CHOICES, customTerm: 'x', customCard: 'y' }, ',').card,
    ).toBe('\n')
    expect(resolveSeparators({ ...INITIAL_CHOICES, term: 'custom' }, ',').term).toBe('')
  })
})

describe('separatorError', () => {
  it('refuse un séparateur vide puis des séparateurs identiques', () => {
    expect(separatorError({ term: '', card: '\n' })).toBe(MESSAGES.separatorRequired)
    expect(separatorError({ term: ';', card: '' })).toBe(MESSAGES.separatorRequired)
    expect(separatorError({ term: '\n', card: '\n' })).toBe(MESSAGES.separatorsMustDiffer)
    expect(separatorError(TAB_NEWLINE)).toBeNull()
  })
})

describe('termOptions', () => {
  it('nomme le séparateur détecté', () => {
    const label = (term: string) => termOptions(term)[0]?.label
    expect(label('\t')).toBe('Détection automatique (tabulation)')
    expect(label(',')).toBe('Détection automatique (virgule)')
    expect(label(';')).toBe('Détection automatique (point-virgule)')
  })

  it('propose les cinq choix du web, dans l’ordre', () => {
    expect(termOptions('\t').map((option) => option.value)).toEqual([
      'auto',
      'tab',
      'comma',
      'semicolon',
      'custom',
    ])
  })
})

describe('buildPreview', () => {
  const text = 'cat - chat\ndog - chien\nbird'

  it('sans séparateur reconnu : tout est ignoré (parité avec le test web)', () => {
    expect(buildPreview(text, TAB_NEWLINE)?.summary).toBe('0 carte détectée · 3 lignes ignorées')
  })

  it('avec le bon séparateur : cartes et lignes ignorées', () => {
    const preview = buildPreview(text, { term: ' - ', card: '\n' })
    expect(preview?.summary).toBe('2 cartes détectées · 1 ligne ignorée')
    expect(preview?.cards.map((card) => card.definition)).toEqual(['chat', 'chien'])
    expect(preview?.invalid).toEqual([{ line: 3, text: 'bird', reason: 'Définition vide' }])
    expect(preview?.more).toBeNull()
  })

  it('renvoie null quand les séparateurs sont inutilisables', () => {
    expect(buildPreview(text, { term: '', card: '\n' })).toBeNull()
    expect(buildPreview(text, { term: '\n', card: '\n' })).toBeNull()
  })

  it('borne le tableau à 100 lignes mais compte toutes les cartes', () => {
    const many = Array.from({ length: 150 }, (_, i) => `t${i}\td${i}`).join('\n')
    const preview = buildPreview(many, TAB_NEWLINE)
    expect(preview?.count).toBe(150)
    expect(preview?.cards).toHaveLength(PREVIEW_ROWS)
    expect(preview?.more).toBe('… et 50 autres cartes.')
    const one = buildPreview(
      Array.from({ length: 101 }, (_, i) => `t${i}\td`).join('\n'),
      TAB_NEWLINE,
    )
    expect(one?.more).toBe('… et 1 autre carte.')
  })

  it('borne les lignes ignorées à 100 et en tronque le texte', () => {
    const lines = Array.from({ length: 120 }, (_, i) => `seul${i}`).join('\n')
    expect(buildPreview(lines, TAB_NEWLINE)?.invalid).toHaveLength(PREVIEW_ROWS)

    const long = buildPreview('x'.repeat(INVALID_TEXT_MAX + 50), TAB_NEWLINE)
    expect(long?.invalid[0]?.text).toBe(`${'x'.repeat(INVALID_TEXT_MAX)}…`)
  })

  it('reprend les raisons du web', () => {
    const preview = buildPreview(
      [
        '\tdef',
        'terme\t',
        `${'t'.repeat(LIMITS.term + 1)}\td`,
        `t\t${'d'.repeat(LIMITS.definition + 1)}`,
      ].join('\n'),
      TAB_NEWLINE,
    )
    expect(preview?.invalid.map((line) => line.reason)).toEqual([
      'Terme vide',
      'Définition vide',
      'Terme trop long (500 caractères au plus)',
      'Définition trop longue (1000 caractères au plus)',
    ])
  })
})

describe('importProblem', () => {
  const base = { size: 10, separators: TAB_NEWLINE, count: 3, existing: 0 }

  it('ne signale rien quand tout va bien', () => {
    expect(importProblem(base)).toBeNull()
    expect(importProblem({ ...base, count: LIMITS.cards })).toBeNull()
  })

  it('priorité 1 : texte de plus de 1 Mo', () => {
    expect(
      importProblem({
        ...base,
        size: IMPORT_MAX_BYTES + 1,
        separators: { term: '', card: '\n' },
        count: LIMITS.cards + 1,
      }),
    ).toBe('Le texte à importer ne peut pas dépasser 1 Mo')
    expect(importProblem({ ...base, size: IMPORT_MAX_BYTES })).toBeNull()
  })

  it('priorité 2 : séparateur vide ou identiques', () => {
    expect(importProblem({ ...base, separators: { term: '', card: '\n' } })).toBe(
      'Choisissez un séparateur',
    )
    expect(
      importProblem({ ...base, separators: { term: '\n', card: '\n' }, count: LIMITS.cards + 1 }),
    ).toBe('Les séparateurs de terme et de carte doivent être différents')
  })

  it('priorité 3 : plus de 2000 cartes au total', () => {
    expect(importProblem({ ...base, count: LIMITS.cards + 1 })).toBe(
      'Le set dépasserait 2000 cartes (0 déjà présentes).',
    )
    expect(importProblem({ ...base, existing: 1999, count: 2 })).toBe(
      'Le set dépasserait 2000 cartes (1999 déjà présentes).',
    )
    expect(importProblem({ ...base, existing: 1999, count: 1 })).toBeNull()
  })
})

describe('canImport', () => {
  const ok = { pending: false, count: 2, problem: null, isNewSet: false, title: '' }

  it('exige des cartes, aucun problème et rien en cours', () => {
    expect(canImport(ok)).toBe(true)
    expect(canImport({ ...ok, pending: true })).toBe(false)
    expect(canImport({ ...ok, count: 0 })).toBe(false)
    expect(canImport({ ...ok, problem: 'x' })).toBe(false)
  })

  it('exige un titre non vide pour un nouveau set seulement', () => {
    expect(canImport({ ...ok, isNewSet: true, title: '   ' })).toBe(false)
    expect(canImport({ ...ok, isNewSet: true, title: 'Anglais' })).toBe(true)
  })
})

describe('textes', () => {
  it('libellé du bouton', () => {
    expect(importButtonLabel(0)).toBe('Importer')
    expect(importButtonLabel(1)).toBe('Importer 1 carte')
    expect(importButtonLabel(2)).toBe('Importer 2 cartes')
  })

  it('toast de succès', () => {
    expect(importSuccessMessage(1, 0)).toBe('1 carte importée.')
    expect(importSuccessMessage(2, 1)).toBe('2 cartes importées (1 ligne ignorée).')
    expect(importSuccessMessage(12, 3)).toBe('12 cartes importées (3 lignes ignorées).')
  })

  it('titre d’en-tête', () => {
    expect(importHeading()).toBe('Importer des cartes')
    expect(importHeading('Anglais')).toBe('Importer des cartes dans « Anglais »')
  })
})

describe('appendPasted', () => {
  it('colle tel quel dans un champ vide ou terminé par un retour à la ligne', () => {
    expect(appendPasted('', 'a\tb')).toBe('a\tb')
    expect(appendPasted('a\tb\n', 'c\td')).toBe('a\tb\nc\td')
  })

  it('passe à la ligne avant d’ajouter à un texte existant', () => {
    expect(appendPasted('a\tb', 'c\td')).toBe('a\tb\nc\td')
  })
})
