import { describe, expect, it } from 'vitest'
import { offlineStatusText, signOutConfirmation } from './account-text'

describe('offlineStatusText', () => {
  it('ne dit rien quand tout est en ordre', () => {
    expect(offlineStatusText({ online: true, pendingGrades: 0 })).toBeNull()
  })

  it('signale l’absence de réseau', () => {
    expect(offlineStatusText({ online: false, pendingGrades: 0 })).toBe('Hors ligne')
  })

  it('compte les notes en attente, au singulier et au pluriel', () => {
    expect(offlineStatusText({ online: true, pendingGrades: 1 })).toBe(
      '1 note en attente de synchronisation',
    )
    expect(offlineStatusText({ online: true, pendingGrades: 12 })).toBe(
      '12 notes en attente de synchronisation',
    )
  })

  it('cumule hors ligne et notes en attente', () => {
    expect(offlineStatusText({ online: false, pendingGrades: 3 })).toBe(
      'Hors ligne · 3 notes en attente de synchronisation',
    )
  })
})

describe('signOutConfirmation', () => {
  it('reste sobre sans note en attente', () => {
    expect(signOutConfirmation(0)).toEqual({
      title: 'Se déconnecter ?',
      message: 'Vous devrez vous reconnecter pour accéder à vos sets.',
      confirmLabel: 'Se déconnecter',
    })
  })

  it('prévient que les notes en attente seraient perdues', () => {
    const one = signOutConfirmation(1)
    expect(one.message).toContain('1 note en attente de synchronisation sera perdue')
    expect(one.confirmLabel).toBe('Se déconnecter quand même')
    expect(signOutConfirmation(4).message).toContain(
      '4 notes en attente de synchronisation seront perdues',
    )
  })
})
