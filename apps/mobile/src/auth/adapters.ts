/**
 * SEUL fichier de `src/auth` qui touche Expo et React Native : tout le reste est pur, testé sous
 * Node, avec ces fonctions injectées par `runtime.ts`.
 */
import * as Crypto from 'expo-crypto'
import * as SecureStore from 'expo-secure-store'
import * as WebBrowser from 'expo-web-browser'
import { Linking } from 'react-native'
import type { BrowserResult } from './login'
import type { SecureKv } from './store'

/** Stockage sécurisé (Android Keystore). Les jetons ne vont JAMAIS ailleurs (ni AsyncStorage, ni fichier). */
export const secureKv: SecureKv = {
  get: (key) => SecureStore.getItemAsync(key),
  set: (key, value) => SecureStore.setItemAsync(key, value),
  remove: (key) => SecureStore.deleteItemAsync(key),
}

export function randomBytes(count: number): Promise<Uint8Array> {
  return Crypto.getRandomBytesAsync(count)
}

export async function sha256(data: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(
    await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, new Uint8Array(data)),
  )
}

/**
 * Custom Tab. Sur Android le résultat est un indice (polyfill AppState + Linking) : `dismiss` peut
 * précéder un callback valide, `success` n'arrive que si l'évènement `url` passe le premier.
 */
export function openAuthSession(url: string, callbackUrl: string): Promise<BrowserResult> {
  return WebBrowser.openAuthSessionAsync(url, callbackUrl)
}

/** Liens profonds reçus pendant que l'app tourne (secours de la route /callback). */
export function addUrlListener(listener: (url: string) => void): () => void {
  const subscription = Linking.addEventListener('url', ({ url }) => listener(url))
  return () => subscription.remove()
}
