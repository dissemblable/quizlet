import { AI_FILE_TYPES, AI_LIMITS, type AiDraft, type AiEvent, MESSAGES } from '@quizlet/shared'
import { api } from './api'
import { ApiError, toApiError } from './http'

/** Découpe un flux d'octets UTF-8 en lignes ; la dernière peut ne pas finir par « \n ». */
export async function* readLines(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    // `stream` : un caractère multi-octets coupé entre deux paquets est recollé.
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    yield* lines
  }
  if (buffer) yield buffer
}

/** Mêmes règles que `aiGenerateSchema` (côté API), vérifiées avant l'envoi. */
export function filesProblem(files: readonly File[]): string | null {
  if (files.length > AI_LIMITS.files) return MESSAGES.aiTooManyFiles
  const types: readonly string[] = AI_FILE_TYPES
  if (files.some((file) => !types.includes(file.type))) return MESSAGES.aiFileType
  if (files.some((file) => file.type.startsWith('image/') && file.size > AI_LIMITS.imageBytes)) {
    return MESSAGES.aiImageTooLarge
  }
  const total = files.reduce((sum, file) => sum + file.size, 0)
  return total > AI_LIMITS.requestBytes ? MESSAGES.aiRequestTooLarge : null
}

export interface GenerateRequest {
  prompt: string
  text: string
  files: File[]
}

/**
 * Lance la génération et attend le brouillon. L'API répond par un flux NDJSON : progression,
 * puis brouillon ou erreur. Annuler `signal` interrompt aussi la génération côté serveur.
 */
export async function generateDraft(
  { prompt, text, files }: GenerateRequest,
  { signal, onProgress }: { signal: AbortSignal; onProgress: (cards: number) => void },
): Promise<{ draft: AiDraft; skipped: number }> {
  const response = await api.ai.generate.$post(
    { form: { prompt, text, files } },
    { init: { signal } },
  )
  if (!response.ok) throw await toApiError(response)
  if (response.body) {
    for await (const line of readLines(response.body)) {
      if (!line.trim()) continue
      const event = JSON.parse(line) as AiEvent
      if (event.type === 'progress') onProgress(event.cards)
      else if (event.type === 'done') return event
      else if (event.type === 'error') throw new ApiError(response.status, 'UNKNOWN', event.message)
    }
  }
  throw new ApiError(0, 'NETWORK_ERROR', 'La génération a été interrompue. Réessayez.')
}
