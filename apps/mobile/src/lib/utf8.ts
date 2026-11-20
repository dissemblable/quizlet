/**
 * CONTRAT : décode des octets UTF-8 en mode STRICT, à parité avec
 * `new TextDecoder('utf-8', { fatal: true })` de Node (le test le vérifie) :
 * `null` si les octets sont invalides (octet isolé, séquence tronquée, sur-encodage, substitut
 * UTF-16, point de code > U+10FFFF). Le BOM UTF-8 (EF BB BF) en tête est retiré.
 * Pas de `TextDecoder` (option `fatal` non fiable sur Hermes) : décodeur maison.
 */
export function decodeUtf8Strict(_bytes: Uint8Array): string | null {
  throw new Error('non implémenté')
}
