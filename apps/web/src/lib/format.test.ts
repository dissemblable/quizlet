import { describe, expect, it } from 'vitest'
import { formatDate, initials, pluralize } from './format'

describe('formatDate', () => {
  it('formate une date ISO en français', () => {
    expect(formatDate('2026-10-09T12:00:00.000Z')).toBe('9 octobre 2026')
  })
})

describe('initials', () => {
  it('prend la première lettre du prénom et du nom', () => {
    expect(initials('Utilisateur Démo')).toBe('UD')
    expect(initials('  Jean  Pierre   Martin ')).toBe('JM')
  })

  it('gère un nom simple et les lettres accentuées', () => {
    expect(initials('alice')).toBe('A')
    expect(initials('éloïse')).toBe('É')
  })

  it('renvoie une chaîne vide pour un nom vide', () => {
    expect(initials('   ')).toBe('')
  })
})

describe('pluralize', () => {
  it('accorde selon la règle française (0 et 1 au singulier)', () => {
    expect(pluralize(0, 'carte')).toBe('0 carte')
    expect(pluralize(1, 'carte')).toBe('1 carte')
    expect(pluralize(2, 'carte')).toBe('2 cartes')
  })

  it('accepte un pluriel irrégulier', () => {
    expect(pluralize(3, 'travail', 'travaux')).toBe('3 travaux')
  })
})
