/** Octets aléatoires sûrs (expo-crypto en production, `node:crypto` dans les tests). */
export type RandomBytes = (count: number) => Promise<Uint8Array>
/** SHA-256 binaire. */
export type Sha256 = (data: Uint8Array) => Promise<Uint8Array>

const BASE64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

/** Base64 URL-safe sans remplissage (RFC 4648 §5). Maison : ni `Buffer` ni `btoa` garantis sur Hermes. */
export function base64url(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i] ?? 0
    const b1 = bytes[i + 1]
    const b2 = bytes[i + 2]
    out += BASE64URL.charAt(b0 >> 2)
    out += BASE64URL.charAt(((b0 & 3) << 4) | ((b1 ?? 0) >> 4))
    if (b1 !== undefined) out += BASE64URL.charAt(((b1 & 15) << 2) | ((b2 ?? 0) >> 6))
    if (b2 !== undefined) out += BASE64URL.charAt(b2 & 63)
  }
  return out
}

export function toHex(bytes: Uint8Array): string {
  let out = ''
  for (const byte of bytes) out += (byte < 16 ? '0' : '') + byte.toString(16)
  return out
}

/** Octets d'une chaîne ASCII (le verifier PKCE est en base64url : pas besoin de `TextEncoder`). */
function asciiBytes(text: string): Uint8Array {
  const bytes = new Uint8Array(text.length)
  for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i) & 0xff
  return bytes
}

async function randomOf(random: RandomBytes, count: number): Promise<Uint8Array> {
  const bytes = await random(count)
  // Une source qui renverrait moins d'octets affaiblirait silencieusement le secret.
  if (bytes.length !== count) throw new Error("Source d'aléa invalide.")
  return bytes
}

/** challenge = base64url(SHA-256(verifier)) (RFC 7636, méthode S256). */
export async function challengeFor(verifier: string, sha256: Sha256): Promise<string> {
  return base64url(await sha256(asciiBytes(verifier)))
}

/** verifier = base64url de 48 octets aléatoires (64 caractères, entre 43 et 128 exigés par la RFC). */
export async function createPkce(
  random: RandomBytes,
  sha256: Sha256,
): Promise<{ verifier: string; challenge: string }> {
  const verifier = base64url(await randomOf(random, 48))
  return { verifier, challenge: await challengeFor(verifier, sha256) }
}

/** `state` : 16 octets aléatoires en hexadécimal (32 caractères). */
export async function createState(random: RandomBytes): Promise<string> {
  return toHex(await randomOf(random, 16))
}

/** Comparaison à temps constant (en fonction de la longueur de la plus longue chaîne). */
export function safeEqual(a: string, b: string): boolean {
  const length = Math.max(a.length, b.length)
  let diff = a.length ^ b.length
  for (let i = 0; i < length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}
