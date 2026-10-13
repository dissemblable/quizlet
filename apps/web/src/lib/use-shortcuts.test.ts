// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { shouldIgnoreShortcut } from './use-shortcuts'

function keyEvent(key: string, target: EventTarget | null, extra: Partial<KeyboardEvent> = {}) {
  return {
    key,
    target,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    defaultPrevented: false,
    ...extra,
  }
}

describe('shouldIgnoreShortcut', () => {
  it('accepte les flèches et Espace quand le focus est sur la page', () => {
    expect(shouldIgnoreShortcut(keyEvent('ArrowRight', document.body))).toBe(false)
    expect(shouldIgnoreShortcut(keyEvent(' ', document.body))).toBe(false)
  })

  it('ignore les touches tapées dans un champ de saisie', () => {
    const input = document.createElement('input')
    const textarea = document.createElement('textarea')
    expect(shouldIgnoreShortcut(keyEvent(' ', input))).toBe(true)
    expect(shouldIgnoreShortcut(keyEvent('ArrowLeft', textarea))).toBe(true)
  })

  it('laisse Espace activer un bouton, mais garde les flèches', () => {
    const button = document.createElement('button')
    const icon = document.createElement('span')
    button.append(icon)
    expect(shouldIgnoreShortcut(keyEvent(' ', icon))).toBe(true)
    expect(shouldIgnoreShortcut(keyEvent('ArrowRight', button))).toBe(false)
  })

  it('ignore les touches pressées dans une fenêtre ou un menu ouvert', () => {
    const dialog = document.createElement('div')
    dialog.setAttribute('role', 'dialog')
    const close = document.createElement('button')
    dialog.append(close)
    expect(shouldIgnoreShortcut(keyEvent('1', close))).toBe(true)
  })

  it('ignore les combinaisons avec une touche de modification', () => {
    expect(shouldIgnoreShortcut(keyEvent('ArrowLeft', document.body, { altKey: true }))).toBe(true)
    expect(shouldIgnoreShortcut(keyEvent('ArrowLeft', document.body, { metaKey: true }))).toBe(true)
  })
})
