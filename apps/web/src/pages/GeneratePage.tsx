import { AI_FILE_TYPES, AI_LIMITS } from '@quizlet/shared'
import { Loader2Icon, SparklesIcon } from 'lucide-react'
import { type FormEvent, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { pageTitle } from '@/config'
import { pluralize } from '@/lib/format'
import { filesProblem, generateDraft } from '@/lib/generate'
import { errorMessage } from '@/lib/http'
import { useMe } from '@/lib/queries'

export function GeneratePage() {
  const me = useMe()
  if (me.isPending) return <LoadingState />
  if (me.isError) return <ErrorState error={me.error} onRetry={() => void me.refetch()} />
  if (!me.data.aiEnabled) {
    return (
      <EmptyState
        icon={<SparklesIcon />}
        title="Génération par IA indisponible"
        description="Aucune clé d'API Claude n'est configurée sur ce serveur."
        action={
          <Button asChild>
            <Link to="/sets/new">Créer un set à la main</Link>
          </Button>
        }
      />
    )
  }
  return <GenerateForm />
}

function GenerateForm() {
  const navigate = useNavigate()
  const [prompt, setPrompt] = useState('')
  const [text, setText] = useState('')
  const [files, setFiles] = useState<File[]>([])
  // null : aucune génération en cours ; sinon le nombre de cartes déjà écrites.
  const [progress, setProgress] = useState<number | null>(null)
  const controller = useRef<AbortController | null>(null)

  // Quitter la page interrompt la génération (et sa facturation).
  useEffect(() => () => controller.current?.abort(), [])

  const pending = progress !== null
  const problem = filesProblem(files)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const abort = new AbortController()
    controller.current = abort
    setProgress(0)
    try {
      const { draft, skipped } = await generateDraft(
        { prompt, text, files },
        { signal: abort.signal, onProgress: setProgress },
      )
      const ignored = skipped ? ` (${pluralize(skipped, 'carte écartée', 'cartes écartées')})` : ''
      toast.success(
        `${pluralize(draft.cards.length, 'carte générée', 'cartes générées')}${ignored}. Relisez-les avant d'enregistrer.`,
      )
      navigate('/sets/new', { state: { draft } })
    } catch (error) {
      if (!abort.signal.aborted) toast.error(errorMessage(error))
    } finally {
      controller.current = null
      setProgress(null)
    }
  }

  return (
    <form onSubmit={submit} noValidate aria-labelledby="generate-title">
      <title>{pageTitle('Générer avec l’IA')}</title>
      <h1 id="generate-title" className="text-2xl font-semibold tracking-tight">
        Générer des cartes avec l'IA
      </h1>
      <p className="mt-2 mb-8 max-w-prose text-muted-foreground">
        Décrivez les cartes voulues, et joignez votre cours si elles doivent s'appuyer dessus. Vous
        relirez les cartes dans l'éditeur avant de créer le set.
      </p>

      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="generate-prompt">Votre demande</FieldLabel>
          <Textarea
            id="generate-prompt"
            rows={3}
            value={prompt}
            maxLength={AI_LIMITS.prompt}
            disabled={pending}
            placeholder={
              'Ex. : 100 mots de vocabulaire anglais courant, terme en anglais et définition en français\nou : une fiche de révision du chapitre 1 de mon cours'
            }
            onChange={(event) => setPrompt(event.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="generate-text">
            Cours à coller <span className="font-normal text-muted-foreground">(facultatif)</span>
          </FieldLabel>
          <Textarea
            id="generate-text"
            rows={6}
            value={text}
            disabled={pending}
            onChange={(event) => setText(event.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="generate-files">
            Ou des fichiers <span className="font-normal text-muted-foreground">(facultatifs)</span>
          </FieldLabel>
          <Input
            id="generate-files"
            type="file"
            multiple
            accept={AI_FILE_TYPES.join(',')}
            disabled={pending}
            aria-describedby="generate-files-help"
            onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
          />
          <FieldDescription id="generate-files-help">
            PDF, photos (PNG, JPEG, WebP, GIF) ou texte : {AI_LIMITS.files} fichiers et 20 Mo au
            total, 5 Mo par photo.
          </FieldDescription>
        </Field>
      </FieldGroup>

      <p aria-live="polite" className="mt-6 text-sm text-muted-foreground">
        {pending &&
          (progress > 0
            ? `${pluralize(progress, 'carte générée', 'cartes générées')}…`
            : 'Lecture de la demande… La génération peut prendre une à deux minutes.')}
      </p>

      <div className="sticky bottom-0 -mx-4 mt-8 flex flex-wrap items-center justify-end gap-2 border-t bg-background/90 px-4 py-3 backdrop-blur">
        {problem && (
          <p role="alert" className="mr-auto text-sm text-destructive">
            {problem}
          </p>
        )}
        {pending ? (
          <Button type="button" variant="ghost" onClick={() => controller.current?.abort()}>
            Annuler
          </Button>
        ) : (
          <Button asChild variant="ghost">
            <Link to="/sets/new">Annuler</Link>
          </Button>
        )}
        <Button type="submit" disabled={pending || problem !== null || !prompt.trim()}>
          {pending ? <Loader2Icon className="animate-spin" /> : <SparklesIcon />}
          Générer
        </Button>
      </div>
    </form>
  )
}
