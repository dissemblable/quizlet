import { describe, expect, it } from 'vitest'
import { bannerText } from './banner-text'

describe('bannerText', () => {
  it('hors ligne sans note', () => {
    expect(bannerText({ online: false, pending: 0, slow: false })).toBe('Hors ligne')
  })

  it('hors ligne avec des notes en attente', () => {
    expect(bannerText({ online: false, pending: 1, slow: false })).toBe(
      'Hors ligne · 1 note en attente',
    )
    expect(bannerText({ online: false, pending: 7, slow: false })).toBe(
      'Hors ligne · 7 notes en attente',
    )
  })

  it('en ligne sans note : rien', () => {
    expect(bannerText({ online: true, pending: 0, slow: false })).toBeNull()
    expect(bannerText({ online: true, pending: 0, slow: true })).toBeNull()
  })

  it("en ligne : le bandeau n'apparaît que si les notes attendent depuis un moment", () => {
    expect(bannerText({ online: true, pending: 3, slow: false })).toBeNull()
    expect(bannerText({ online: true, pending: 3, slow: true })).toBe(
      'Synchronisation · 3 notes en attente',
    )
  })
})
