/**
 * Décode des octets UTF-8 en mode STRICT, à parité avec `new TextDecoder('utf-8', { fatal: true })`
 * de Node (le test le vérifie) : `null` si les octets sont invalides (octet isolé, séquence
 * tronquée, sur-encodage, substitut UTF-16, point de code > U+10FFFF). Le BOM UTF-8 (EF BB BF) en
 * tête est retiré.
 * Pas de `TextDecoder` (option `fatal` non fiable sur Hermes) : décodeur maison, selon les plages
 * de la spécification WHATWG Encoding.
 */
export function decodeUtf8Strict(bytes: Uint8Array): string | null {
  // Unités UTF-16 accumulées puis converties par paquets : `fromCharCode` n'accepte pas un million
  // d'arguments.
  const units: number[] = []
  let out = ''
  let codePoint = 0
  let needed = 0
  let lower = 0x80
  let upper = 0xbf

  const hasBom = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf
  for (let i = hasBom ? 3 : 0; i < bytes.length; i++) {
    const byte = bytes[i] ?? 0
    if (needed === 0) {
      if (byte < 0x80) {
        units.push(byte)
      } else if (byte >= 0xc2 && byte <= 0xdf) {
        needed = 1
        codePoint = byte & 0x1f
      } else if (byte >= 0xe0 && byte <= 0xef) {
        if (byte === 0xe0) lower = 0xa0 // exclut le sur-encodage < U+0800
        if (byte === 0xed) upper = 0x9f // exclut les substituts U+D800–DFFF
        needed = 2
        codePoint = byte & 0x0f
      } else if (byte >= 0xf0 && byte <= 0xf4) {
        if (byte === 0xf0) lower = 0x90 // exclut le sur-encodage < U+10000
        if (byte === 0xf4) upper = 0x8f // exclut > U+10FFFF
        needed = 3
        codePoint = byte & 0x07
      } else {
        return null
      }
    } else {
      if (byte < lower || byte > upper) return null
      lower = 0x80
      upper = 0xbf
      codePoint = (codePoint << 6) | (byte & 0x3f)
      needed--
      if (needed === 0) {
        if (codePoint > 0xffff) {
          const offset = codePoint - 0x10000
          units.push(0xd800 + (offset >> 10), 0xdc00 + (offset & 0x3ff))
        } else {
          units.push(codePoint)
        }
      }
    }
    if (units.length >= 4096) {
      out += String.fromCharCode.apply(null, units)
      units.length = 0
    }
  }
  if (needed !== 0) return null
  return out + String.fromCharCode.apply(null, units)
}
