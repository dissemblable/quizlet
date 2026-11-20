import type { CallbackParams } from './types'

const KEYS = ['code', 'state', 'iss', 'error', 'error_description'] as const

/**
 * Le relais de l'API encode avec `encodeURIComponent` : un espace devient `%20`, jamais `+`. On
 * accepte quand même `+` (= espace dans un formulaire) par tolérance : un `+` littéral est toujours
 * envoyé sous la forme `%2B` par le relais, donc la lecture reste sans ambiguïté.
 */
function decode(part: string): string {
  const text = part.replace(/\+/g, ' ')
  try {
    return decodeURIComponent(text)
  } catch {
    return text
  }
}

/**
 * Paramètres d'un lien `quizlet://callback?…` (relais de l'API). `null` si l'URL n'est pas celle du
 * callback ; `{}` si elle l'est sans paramètre. Seuls les cinq champs du relais sont lus, la première
 * occurrence l'emporte. À la main : `URL` est incomplet sur Hermes.
 */
export function parseCallbackUrl(url: string, callbackUrl: string): CallbackParams | null {
  if (!url.startsWith(callbackUrl)) return null
  let rest = url.slice(callbackUrl.length)
  const hash = rest.indexOf('#')
  if (hash !== -1) rest = rest.slice(0, hash)
  const question = rest.indexOf('?')
  const path = question === -1 ? rest : rest.slice(0, question)
  // `quizlet://callbackevil` ou `quizlet://callback/autre` ne sont pas le callback.
  if (path !== '' && path !== '/') return null

  const params: CallbackParams = {}
  if (question === -1) return params
  for (const pair of rest.slice(question + 1).split('&')) {
    if (pair === '') continue
    const equals = pair.indexOf('=')
    const key = decode(equals === -1 ? pair : pair.slice(0, equals))
    const value = equals === -1 ? '' : decode(pair.slice(equals + 1))
    const known = KEYS.find((name) => name === key)
    if (known && params[known] === undefined) params[known] = value
  }
  return params
}
