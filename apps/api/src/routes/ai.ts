import { AI_LIMITS, type AiEvent, aiGenerateSchema, MESSAGES } from '@quizlet/shared'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { stream } from 'hono/streaming'
import { ApiError, errorBody } from '../errors'
import { type CardGenerator, GenerationError } from '../services/ai'
import type { AppEnv } from '../types'
import { validate } from '../validation'

/** Une ligne au moins toutes les 15 s : nginx et Cloudflare ne coupent pas un flux actif. */
const PING_MS = 15_000

/**
 * Génération d'un brouillon de set par IA. La réponse est un flux NDJSON (`AiEvent`, une ligne par
 * événement) : une génération peut durer plusieurs minutes, plus que les délais des proxys.
 */
export function aiRoutes(generator: CardGenerator | null) {
  // shortcut: verrou en mémoire, propre au processus ; suffisant tant que l'API tourne en une
  // seule instance.
  const running = new Set<string>()

  return new Hono<AppEnv>().post(
    '/generate',
    bodyLimit({
      maxSize: AI_LIMITS.requestBytes,
      onError: (c) => c.json(errorBody('PAYLOAD_TOO_LARGE', `${MESSAGES.aiRequestTooLarge}.`), 413),
    }),
    validate('form', aiGenerateSchema),
    (c) => {
      if (!generator) {
        throw new ApiError(
          503,
          'AI_UNAVAILABLE',
          "La génération par IA n'est pas configurée sur ce serveur.",
        )
      }
      const userId = c.get('user').id
      if (running.has(userId)) {
        throw new ApiError(429, 'TOO_MANY_REQUESTS', 'Une génération est déjà en cours.')
      }
      running.add(userId)
      const input = c.req.valid('form')
      const controller = new AbortController()

      c.header('Content-Type', 'application/x-ndjson; charset=utf-8')
      // Pas de mise en tampon par nginx : la progression doit arriver au fil de l'eau.
      c.header('X-Accel-Buffering', 'no')
      return stream(c, async (out) => {
        const send = (event: AiEvent) => out.writeln(JSON.stringify(event))
        // Client parti (annulation, page fermée) : on arrête la génération, donc sa facturation.
        out.onAbort(() => controller.abort())
        const ping = setInterval(() => void send({ type: 'ping' }), PING_MS)
        try {
          const result = await generator(input, {
            signal: controller.signal,
            onProgress: (cards) => void send({ type: 'progress', cards }),
          })
          await send({ type: 'done', ...result })
        } catch (error) {
          if (controller.signal.aborted) return
          if (!(error instanceof GenerationError)) console.error(error)
          await send({
            type: 'error',
            message:
              error instanceof GenerationError
                ? error.message
                : 'La génération a échoué. Réessayez dans un instant.',
          })
        } finally {
          clearInterval(ping)
          running.delete(userId)
        }
      })
    },
  )
}
