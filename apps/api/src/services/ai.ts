import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import { AI_LIMITS, type AiDraft, cardInputSchema, LIMITS } from '@quizlet/shared'
import { z } from 'zod'

const MODEL = 'claude-opus-5-5'

export interface GenerateInput {
  prompt: string
  text?: string
  files: File[]
}

export interface GenerateOptions {
  signal: AbortSignal
  /** Nombre de cartes déjà écrites par le modèle (approximatif, pour la progression). */
  onProgress: (cards: number) => void
}

export interface GenerateResult {
  draft: AiDraft
  /** Cartes écartées : terme ou définition vide ou trop long, ou au-delà de la limite du set. */
  skipped: number
}

/** Produit un brouillon de set ; l'API ne l'enregistre jamais (relu dans l'éditeur du front). */
export type CardGenerator = (
  input: GenerateInput,
  options: GenerateOptions,
) => Promise<GenerateResult>

/** Échec de génération dont le message, en français, peut être montré à l'utilisateur. */
export class GenerationError extends Error {
  override name = 'GenerationError'
}

/** Sortie structurée imposée au modèle ; les limites de longueur sont vérifiées par `toDraft`. */
const outputSchema = z.object({
  title: z.string(),
  description: z.string(),
  cards: z.array(z.object({ term: z.string(), definition: z.string() })),
})

// Sans `parse` : le SDK n'analyse pas la réponse lui-même, ce qui lèverait une exception sur une
// réponse tronquée avant qu'on puisse lire `stop_reason`.
const { type: formatType, schema: formatSchema } = betaZodOutputFormat(outputSchema)

const SYSTEM_PROMPT = `Tu crées des cartes de révision (flashcards) pour une application d'apprentissage francophone. Chaque carte a un recto (« term ») et un verso (« definition »).

- Suis la consigne de l'utilisateur : nombre de cartes, langues, niveau, type de cartes (vocabulaire, questions-réponses, dates, formules…).
- Si un cours est fourni (documents, images ou texte), appuie-toi uniquement sur son contenu et sur la partie demandée (par exemple un chapitre). N'invente pas d'information absente du cours.
- Sans précision de langue, rédige en français.
- Une carte = une seule notion. Recto court ; verso clair et autonome, sans renvoyer aux autres cartes.
- Recto : ${LIMITS.term} caractères au plus. Verso : ${LIMITS.definition} caractères au plus.
- ${AI_LIMITS.cards} cartes au plus, même si la consigne en demande davantage.
- Pas de numérotation ni de puces au début des cartes.
- « title » : titre court du set (${LIMITS.title} caractères au plus). « description » : une phrase qui résume le set.`

/** Valide la sortie du modèle et écarte les cartes invalides plutôt que d'échouer. */
export function toDraft(raw: unknown): GenerateResult {
  const output = outputSchema.safeParse(raw)
  if (!output.success) throw new GenerationError("Réponse inattendue de l'IA. Réessayez.")

  const cards: AiDraft['cards'] = []
  let skipped = 0
  for (const card of output.data.cards) {
    const valid = cardInputSchema.safeParse(card)
    if (valid.success && cards.length < LIMITS.cards) {
      cards.push({ term: valid.data.term, definition: valid.data.definition })
    } else {
      skipped++
    }
  }
  if (cards.length === 0) {
    throw new GenerationError("L'IA n'a produit aucune carte. Reformulez la demande.")
  }
  return {
    draft: {
      title: output.data.title.trim().slice(0, LIMITS.title) || 'Set généré',
      description: output.data.description.trim().slice(0, LIMITS.description) || null,
      cards,
    },
    skipped,
  }
}

async function fileBlock(file: File): Promise<Anthropic.Beta.BetaContentBlockParam> {
  if (file.type === 'text/plain') {
    return {
      type: 'document',
      title: file.name,
      source: { type: 'text', media_type: 'text/plain', data: await file.text() },
    }
  }
  const data = Buffer.from(await file.arrayBuffer()).toString('base64')
  if (file.type === 'application/pdf') {
    return {
      type: 'document',
      title: file.name,
      source: { type: 'base64', media_type: 'application/pdf', data },
    }
  }
  return {
    type: 'image',
    // Types vérifiés par `aiGenerateSchema` (AI_FILE_TYPES).
    source: { type: 'base64', media_type: file.type as 'image/png', data },
  }
}

/** Nombre de cartes commencées dans le JSON partiel (une par clé « term »). */
export function countCards(partialJson: string): number {
  return partialJson.match(/"term"\s*:/g)?.length ?? 0
}

export function createClaudeGenerator(apiKey: string): CardGenerator {
  const client = new Anthropic({ apiKey })

  return async ({ prompt, text, files }, { signal, onProgress }) => {
    // Documents d'abord, consigne en dernier.
    const content: Anthropic.Beta.BetaContentBlockParam[] = await Promise.all(files.map(fileBlock))
    if (text?.trim()) {
      content.push({
        type: 'document',
        title: 'Cours collé',
        source: { type: 'text', media_type: 'text/plain', data: text },
      })
    }
    content.push({ type: 'text', text: `Consigne : ${prompt}` })

    let message: Anthropic.Beta.BetaMessage
    try {
      const stream = client.beta.messages.stream(
        {
          model: MODEL,
          max_tokens: 64_000,
          // Si le modèle refuse la demande, l'API la rejoue sur son modèle de repli par défaut.
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
          output_config: { effort: 'medium', format: { type: formatType, schema: formatSchema } },
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content }],
        },
        { signal },
      )
      let last = 0
      stream.on('text', (_delta, snapshot) => {
        const count = countCards(snapshot)
        if (count === last) return
        last = count
        onProgress(count)
      })
      message = await stream.finalMessage()
    } catch (error) {
      if (
        error instanceof Anthropic.RateLimitError ||
        error instanceof Anthropic.InternalServerError
      ) {
        throw new GenerationError("Le service d'IA est surchargé. Réessayez dans quelques minutes.")
      }
      if (error instanceof Anthropic.BadRequestError) {
        console.error(error)
        throw new GenerationError(
          "L'IA n'a pas pu lire la demande : fichier illisible ou cours trop long ?",
        )
      }
      throw error
    }

    if (message.stop_reason === 'refusal') {
      throw new GenerationError("L'IA a refusé cette demande. Reformulez-la.")
    }
    if (message.stop_reason === 'max_tokens') {
      throw new GenerationError('Réponse trop longue : demandez moins de cartes.')
    }
    const json = message.content.flatMap((block) => (block.type === 'text' ? [block.text] : []))
    try {
      return toDraft(JSON.parse(json.join('')))
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new GenerationError("Réponse inattendue de l'IA. Réessayez.")
      }
      throw error
    }
  }
}
