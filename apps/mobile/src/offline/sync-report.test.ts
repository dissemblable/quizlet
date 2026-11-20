import { describe, expect, it } from 'vitest'
import { emptyTally, syncReport } from './sync-report'

describe('syncReport', () => {
  it('ne dit rien sans note', () => {
    expect(syncReport(emptyTally())).toBeNull()
  })

  it('une note synchronisée (singulier)', () => {
    expect(syncReport({ synced: 1, ignored: 0, dropped: 0 })).toEqual({
      message: '1 note synchronisée',
      kind: 'info',
    })
  })

  it('plusieurs notes, accord au pluriel', () => {
    expect(syncReport({ synced: 12, ignored: 0, dropped: 0 })?.message).toBe(
      '12 notes synchronisées',
    )
  })

  it('mentionne les notes ignorées', () => {
    expect(syncReport({ synced: 8, ignored: 2, dropped: 0 })?.message).toBe(
      '8 notes synchronisées (2 ignorées)',
    )
    expect(syncReport({ synced: 3, ignored: 1, dropped: 0 })?.message).toBe(
      '3 notes synchronisées (1 ignorée)',
    )
  })

  it('seulement des notes ignorées', () => {
    expect(syncReport({ synced: 0, ignored: 1, dropped: 0 })?.message).toBe('1 note ignorée')
    expect(syncReport({ synced: 0, ignored: 4, dropped: 0 })?.message).toBe('4 notes ignorées')
  })

  it('les refus définitifs sont comptés et passent en erreur', () => {
    expect(syncReport({ synced: 2, ignored: 0, dropped: 1 })).toEqual({
      message: '2 notes synchronisées · 1 note abandonnée (refus définitif du serveur)',
      kind: 'error',
    })
    expect(syncReport({ synced: 0, ignored: 0, dropped: 3 })?.message).toBe(
      '3 notes abandonnées (refus définitif du serveur)',
    )
  })
})
