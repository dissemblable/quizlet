import { describe, expect, it } from 'vitest'
import { decodeUtf8Strict } from './utf8'

const reference = new TextDecoder('utf-8', { fatal: true })

/** Référence : le décodeur strict de Node (BOM retiré, comme par défaut). */
function nodeDecode(bytes: Uint8Array): string | null {
  try {
    return reference.decode(bytes)
  } catch {
    return null
  }
}

const bytesOf = (...values: number[]) => new Uint8Array(values)
const encode = (text: string) => new TextEncoder().encode(text)

/** Générateur pseudo-aléatoire déterministe (mulberry32). */
function prng(seed: number): () => number {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function expectParity(bytes: Uint8Array) {
  const expected = nodeDecode(bytes)
  const actual = decodeUtf8Strict(bytes)
  if (actual !== expected) {
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(' ')
    expect.fail(
      `octets [${hex}] : attendu ${JSON.stringify(expected)}, obtenu ${JSON.stringify(actual)}`,
    )
  }
}

describe('decodeUtf8Strict : cas valides', () => {
  it('vide, ASCII, accents, CJK, emoji', () => {
    for (const text of [
      '',
      'abc',
      'Été, déjà vu ! À côté.',
      '日本語のテキスト',
      '😀 𝄞 🇫🇷',
      'a\u0000b',
    ]) {
      expect(decodeUtf8Strict(encode(text))).toBe(text)
    }
  })

  it('bornes de chaque longueur de séquence', () => {
    for (const codePoint of [0x7f, 0x80, 0x7ff, 0x800, 0xd7ff, 0xe000, 0xffff, 0x10000, 0x10ffff]) {
      const text = String.fromCodePoint(codePoint)
      expect(decodeUtf8Strict(encode(text))).toBe(text)
    }
  })

  it('retire le BOM UTF-8 de tête, une seule fois', () => {
    expect(decodeUtf8Strict(bytesOf(0xef, 0xbb, 0xbf, 0x61))).toBe('a')
    expect(decodeUtf8Strict(bytesOf(0xef, 0xbb, 0xbf))).toBe('')
    expect(decodeUtf8Strict(bytesOf(0xef, 0xbb, 0xbf, 0xef, 0xbb, 0xbf, 0x61))).toBe('﻿a')
    expect(decodeUtf8Strict(bytesOf(0x61, 0xef, 0xbb, 0xbf))).toBe('a﻿')
  })

  it('texte de plus de 4096 unités (paquets) et d’un million d’octets', () => {
    const text = 'Éléphant 😀 '.repeat(100_000)
    const bytes = encode(text)
    expect(bytes.length).toBeGreaterThan(1_000_000)
    expect(decodeUtf8Strict(bytes)).toBe(text)
  })
})

describe('decodeUtf8Strict : cas invalides', () => {
  const invalid: Array<[string, number[]]> = [
    ['continuation isolée', [0x80]],
    ['continuation isolée après ASCII', [0x61, 0xbf]],
    ['octet C0 (sur-encodage)', [0xc0, 0x80]],
    ['octet C1 (sur-encodage)', [0xc1, 0xbf]],
    ['octets F5 à FF', [0xf5, 0x80, 0x80, 0x80]],
    ['octet FF', [0xff]],
    ['octet FE', [0xfe]],
    ['sur-encodage sur 3 octets (E0 80 80)', [0xe0, 0x80, 0x80]],
    ['sur-encodage sur 3 octets (E0 9F BF)', [0xe0, 0x9f, 0xbf]],
    ['sur-encodage sur 4 octets (F0 80 80 80)', [0xf0, 0x80, 0x80, 0x80]],
    ['sur-encodage sur 4 octets (F0 8F BF BF)', [0xf0, 0x8f, 0xbf, 0xbf]],
    ['substitut U+D800 (ED A0 80)', [0xed, 0xa0, 0x80]],
    ['substitut U+DFFF (ED BF BF)', [0xed, 0xbf, 0xbf]],
    ['> U+10FFFF (F4 90 80 80)', [0xf4, 0x90, 0x80, 0x80]],
    ['> U+10FFFF (F5 80 80 80)', [0xf5, 0x80, 0x80, 0x80]],
    ['séquence tronquée à 2 octets', [0xc3]],
    ['séquence tronquée à 3 octets', [0xe2, 0x82]],
    ['séquence tronquée à 4 octets', [0xf0, 0x9f, 0x98]],
    ['séquence interrompue par de l’ASCII', [0xe2, 0x82, 0x61]],
    ['séquence interrompue par un octet de tête', [0xc3, 0xc3, 0xa9]],
    ['Latin-1 (« é » = E9)', [0x63, 0x61, 0x66, 0xe9]],
    ['Windows-1252 (« œ » = 9C)', [0x9c]],
    ['BOM seul tronqué', [0xef, 0xbb]],
  ]

  for (const [name, values] of invalid) {
    it(`renvoie null : ${name}`, () => {
      expect(decodeUtf8Strict(new Uint8Array(values))).toBeNull()
      expectParity(new Uint8Array(values))
    })
  }
})

describe('decodeUtf8Strict : parité avec TextDecoder fatal de Node', () => {
  it('tous les octets isolés et toutes les paires d’octets', () => {
    for (let a = 0; a < 256; a++) {
      expectParity(bytesOf(a))
      for (let b = 0; b < 256; b++) expectParity(bytesOf(a, b))
    }
  })

  it('triplets et quadruplets aux valeurs charnières', () => {
    const pivots = [
      0x00, 0x41, 0x7f, 0x80, 0x8f, 0x90, 0x9f, 0xa0, 0xbf, 0xc0, 0xc2, 0xdf, 0xe0, 0xe1,
    ]
    const heads = [0xe0, 0xe1, 0xec, 0xed, 0xee, 0xef, 0xf0, 0xf1, 0xf3, 0xf4, 0xf5, 0xc2, 0xdf]
    for (const head of heads) {
      for (const b of pivots) {
        for (const c of pivots) {
          expectParity(bytesOf(head, b, c))
          expectParity(bytesOf(head, b, c, 0x80))
          expectParity(bytesOf(head, b, c, 0xbf))
          expectParity(bytesOf(head, b, c, 0x61))
          for (const d of pivots) expectParity(bytesOf(head, b, c, d))
        }
      }
    }
  })

  it('tous les points de code (un par un), avec et sans BOM', () => {
    for (let codePoint = 0; codePoint <= 0x10ffff; codePoint += codePoint < 0x3000 ? 1 : 17) {
      if (codePoint >= 0xd800 && codePoint <= 0xdfff) continue
      const bytes = encode(String.fromCodePoint(codePoint))
      expectParity(bytes)
      expect(decodeUtf8Strict(bytes)).toBe(String.fromCodePoint(codePoint))
    }
    expectParity(bytesOf(0xef, 0xbb, 0xbf, 0xc3, 0xa9))
  })

  it('textes valides aléatoires (points de code tirés dans tout le plan)', () => {
    const random = prng(20261120)
    for (let n = 0; n < 300; n++) {
      let text = ''
      const length = Math.floor(random() * 60)
      for (let i = 0; i < length; i++) {
        let codePoint = Math.floor(random() * 0x110000)
        if (codePoint >= 0xd800 && codePoint <= 0xdfff) codePoint = 0x41 + (codePoint % 26)
        text += String.fromCodePoint(codePoint)
      }
      const bytes = encode(text)
      expectParity(bytes)
      expect(decodeUtf8Strict(bytes)).toBe(text)
    }
  })

  it('textes valides mutés (octet remplacé, supprimé, inséré ou tronqué)', () => {
    const random = prng(42)
    const sample = encode('Éléphant à l’école, 日本語 😀 𝄞 — fin')
    for (let n = 0; n < 2000; n++) {
      const bytes = Array.from(sample)
      const position = Math.floor(random() * bytes.length)
      const kind = n % 4
      if (kind === 0) bytes[position] = Math.floor(random() * 256)
      else if (kind === 1) bytes.splice(position, 1)
      else if (kind === 2) bytes.splice(position, 0, Math.floor(random() * 256))
      else bytes.length = position
      expectParity(new Uint8Array(bytes))
    }
  })

  it('octets entièrement aléatoires', () => {
    const random = prng(7)
    for (let n = 0; n < 3000; n++) {
      const bytes = new Uint8Array(Math.floor(random() * 12))
      for (let i = 0; i < bytes.length; i++) {
        // Biais vers les octets de tête et de continuation pour atteindre les états intermédiaires.
        bytes[i] = random() < 0.5 ? 0x80 + Math.floor(random() * 0x80) : Math.floor(random() * 256)
      }
      expectParity(bytes)
    }
  })
})
