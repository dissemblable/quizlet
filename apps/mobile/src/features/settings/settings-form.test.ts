import { MESSAGES } from '@quizlet/shared'
import { describe, expect, it } from 'vitest'
import {
  parsePerDay,
  parseRetention,
  SETTINGS_TEXT,
  settingsFormSchema,
  toFormValues,
} from './settings-form'

const valid = {
  timezone: 'Europe/Paris',
  newCardsPerDay: '20',
  reviewsPerDay: '200',
  desiredRetention: '0,9',
}

function issues(overrides: Partial<typeof valid>): Record<string, string> {
  const result = settingsFormSchema.safeParse({ ...valid, ...overrides })
  if (result.success) return {}
  return Object.fromEntries(
    result.error.issues.map((issue) => [String(issue.path[0]), issue.message]),
  )
}

describe('parsePerDay', () => {
  it('accepte des chiffres seuls', () => {
    expect(parsePerDay('0')).toBe(0)
    expect(parsePerDay(' 20 ')).toBe(20)
    expect(parsePerDay('9999')).toBe(9999)
  })

  it('refuse tout le reste', () => {
    for (const text of ['', ' ', '1,5', '1.5', '-3', '1e3', '0x10', 'Infinity', '12a', '1 200']) {
      expect(parsePerDay(text), text).toBeNaN()
    }
  })
})

describe('parseRetention', () => {
  it('accepte la virgule comme le point', () => {
    expect(parseRetention('0,9')).toBe(0.9)
    expect(parseRetention('0.85')).toBe(0.85)
    expect(parseRetention(' 0,75 ')).toBe(0.75)
    expect(parseRetention('.8')).toBe(0.8)
    expect(parseRetention('1')).toBe(1)
  })

  it('refuse le non numérique et les séparateurs multiples', () => {
    for (const text of ['', ',', '.', '0,8,5', '0.8.5', '1e-1', '-0,9', 'abc', '0,9 %']) {
      expect(parseRetention(text), text).toBeNaN()
    }
  })
})

describe('settingsFormSchema', () => {
  it('convertit la saisie en nombres', () => {
    expect(settingsFormSchema.parse(valid)).toEqual({
      timezone: 'Europe/Paris',
      newCardsPerDay: 20,
      reviewsPerDay: 200,
      desiredRetention: 0.9,
    })
    expect(settingsFormSchema.parse({ ...valid, desiredRetention: '0.75' }).desiredRetention).toBe(
      0.75,
    )
  })

  it('retire les espaces du fuseau', () => {
    expect(settingsFormSchema.parse({ ...valid, timezone: ' Asia/Tokyo ' }).timezone).toBe(
      'Asia/Tokyo',
    )
  })

  it('accepte les bornes', () => {
    const edges = { newCardsPerDay: '0', reviewsPerDay: '9999', desiredRetention: '0,70' }
    expect(settingsFormSchema.parse({ ...valid, ...edges })).toMatchObject({
      newCardsPerDay: 0,
      reviewsPerDay: 9999,
      desiredRetention: 0.7,
    })
    expect(settingsFormSchema.parse({ ...valid, desiredRetention: '0,99' }).desiredRetention).toBe(
      0.99,
    )
  })

  it('signale une rétention hors bornes avec le message du web', () => {
    expect(MESSAGES.retentionInvalid).toBe(
      'La rétention cible doit être comprise entre 0,70 et 0,99',
    )
    for (const desiredRetention of ['0,5', '0.69', '1', '100', '', 'abc']) {
      expect(issues({ desiredRetention }), desiredRetention).toEqual({
        desiredRetention: MESSAGES.retentionInvalid,
      })
    }
  })

  it('signale un nombre par jour invalide avec le message du web', () => {
    expect(MESSAGES.perDayInvalid).toBe('Choisissez un nombre entier entre 0 et 9999')
    for (const newCardsPerDay of ['', '10000', '-1', '1,5', 'abc']) {
      expect(issues({ newCardsPerDay }), newCardsPerDay).toEqual({
        newCardsPerDay: MESSAGES.perDayInvalid,
      })
    }
    expect(issues({ reviewsPerDay: '12345' })).toEqual({ reviewsPerDay: MESSAGES.perDayInvalid })
  })

  it('refuse un fuseau vide ou trop long', () => {
    expect(issues({ timezone: '' })).toEqual({ timezone: MESSAGES.timezoneInvalid })
    expect(issues({ timezone: '   ' })).toEqual({ timezone: MESSAGES.timezoneInvalid })
    expect(issues({ timezone: 'A'.repeat(65) })).toEqual({ timezone: MESSAGES.timezoneInvalid })
  })

  it('rapporte toutes les erreurs à la fois', () => {
    expect(
      Object.keys(issues({ newCardsPerDay: 'x', reviewsPerDay: 'y', desiredRetention: 'z' })),
    ).toEqual(['newCardsPerDay', 'reviewsPerDay', 'desiredRetention'])
  })
})

describe('toFormValues', () => {
  it('formate les réglages du serveur pour la saisie', () => {
    const settings = {
      timezone: 'America/New_York',
      newCardsPerDay: 9999,
      reviewsPerDay: 0,
      desiredRetention: 0.85,
    }
    expect(toFormValues(settings)).toEqual({
      timezone: 'America/New_York',
      newCardsPerDay: '9999',
      reviewsPerDay: '0',
      desiredRetention: '0,85',
    })
  })

  it('prend le fuseau par défaut tant qu’aucun n’est choisi', () => {
    expect(
      toFormValues({
        timezone: null,
        newCardsPerDay: 20,
        reviewsPerDay: 200,
        desiredRetention: 0.9,
      }).timezone,
    ).toBe('Europe/Paris')
  })

  it('produit des valeurs que le schéma relit à l’identique', () => {
    const settings = {
      timezone: 'Europe/Paris',
      newCardsPerDay: 1200,
      reviewsPerDay: 5000,
      desiredRetention: 0.93,
    }
    expect(settingsFormSchema.parse(toFormValues(settings))).toEqual(settings)
  })
})

describe('textes d’aide', () => {
  it('reprennent ceux du web, avec la virgule décimale', () => {
    expect(SETTINGS_TEXT.newCardsPerDay.help).toBe(
      'Cartes jamais révisées présentées chaque jour (20 par défaut).',
    )
    expect(SETTINGS_TEXT.reviewsPerDay.help).toBe(
      "Cartes déjà apprises à réviser chaque jour au plus (200 par défaut). Les cartes en cours d'apprentissage ne sont jamais limitées.",
    )
    expect(SETTINGS_TEXT.desiredRetention.help).toBe(
      "Probabilité visée de se souvenir d'une carte quand elle revient (0,9 par défaut, de 0,7 à 0,99). Plus elle est haute, plus les révisions sont fréquentes.",
    )
  })
})
