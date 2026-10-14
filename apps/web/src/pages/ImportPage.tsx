import {
  detectSeparators,
  IMPORT_MAX_BYTES,
  LIMITS,
  MESSAGES,
  parseCards,
  utf8Size,
} from '@quizlet/shared'
import { Loader2Icon, LockIcon, UploadIcon } from 'lucide-react'
import { type FormEvent, useDeferredValue, useId, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { EmptyState } from '@/components/states'
import { Button } from '@/components/ui/button'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Textarea } from '@/components/ui/textarea'
import { pageTitle } from '@/config'
import { pluralize } from '@/lib/format'
import { errorMessage } from '@/lib/http'
import { type SetDetail, useImportCards, useSet } from '@/lib/queries'
import { SetQueryStates } from '@/pages/SetPage'

/** Lignes affichées dans l'aperçu (le reste est seulement compté). */
const PREVIEW_ROWS = 100

const TERM_SEPARATORS = { tab: '\t', comma: ',', semicolon: ';' } as const
const SEPARATOR_NAMES: Record<string, string> = {
  '\t': 'tabulation',
  ',': 'virgule',
  ';': 'point-virgule',
}

/** « \n » et « \t » tapés dans un séparateur personnalisé : retour à la ligne et tabulation. */
function unescapeSeparator(value: string): string {
  return value.replace(/\\n/g, '\n').replace(/\\t/g, '\t')
}

export function ImportPage() {
  const { id } = useParams()
  return id ? <ImportIntoSet id={id} /> : <ImportForm />
}

function ImportIntoSet({ id }: { id: string }) {
  const query = useSet(id)
  if (!query.data) return <SetQueryStates query={query} />
  if (!query.data.isOwner) {
    return (
      <EmptyState
        icon={<LockIcon />}
        title="Import réservé à l'auteur"
        description="Dupliquez ce set pour en obtenir une copie modifiable dans votre bibliothèque."
        action={
          <Button asChild>
            <Link to={`/sets/${id}`}>Voir le set</Link>
          </Button>
        }
      />
    )
  }
  return <ImportForm set={query.data} />
}

function SeparatorChoice({
  legend,
  options,
  value,
  onValueChange,
  custom,
  onCustomChange,
}: {
  legend: string
  options: ReadonlyArray<{ value: string; label: string }>
  value: string
  onValueChange: (value: string) => void
  custom: string
  onCustomChange: (value: string) => void
}) {
  const id = useId()
  return (
    <FieldSet>
      <FieldLegend variant="label">{legend}</FieldLegend>
      <RadioGroup value={value} onValueChange={onValueChange} className="flex flex-wrap gap-x-5">
        {options.map((option) => (
          <Label key={option.value} className="font-normal">
            <RadioGroupItem value={option.value} />
            {option.label}
          </Label>
        ))}
      </RadioGroup>
      {value === 'custom' && (
        <Field className="max-w-xs">
          <FieldLabel htmlFor={`${id}-custom`}>Séparateur personnalisé</FieldLabel>
          <Input
            id={`${id}-custom`}
            value={custom}
            maxLength={10}
            onChange={(event) => onCustomChange(event.target.value)}
          />
          <FieldDescription>\n : retour à la ligne, \t : tabulation.</FieldDescription>
        </Field>
      )}
    </FieldSet>
  )
}

function ImportForm({ set }: { set?: SetDetail }) {
  const navigate = useNavigate()
  const importCards = useImportCards(set?.id)
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [fileError, setFileError] = useState<string | null>(null)
  const [termChoice, setTermChoice] = useState('auto')
  const [customTerm, setCustomTerm] = useState('')
  const [cardChoice, setCardChoice] = useState('newline')
  const [customCard, setCustomCard] = useState('')

  // L'aperçu suit la saisie sans bloquer la frappe, même sur un gros collage.
  const source = useDeferredValue(text)
  const detected = useMemo(() => detectSeparators(source), [source])
  const size = useMemo(() => utf8Size(source), [source])
  const termSeparator =
    termChoice === 'auto'
      ? detected.term
      : termChoice === 'custom'
        ? unescapeSeparator(customTerm)
        : (TERM_SEPARATORS[termChoice as keyof typeof TERM_SEPARATORS] ?? '\t')
  const cardSeparator = cardChoice === 'custom' ? unescapeSeparator(customCard) : '\n'
  const separatorError =
    termSeparator === '' || cardSeparator === ''
      ? MESSAGES.separatorRequired
      : termSeparator === cardSeparator
        ? MESSAGES.separatorsMustDiffer
        : null
  const preview = useMemo(
    () =>
      separatorError ? null : parseCards(source, { term: termSeparator, card: cardSeparator }),
    [source, termSeparator, cardSeparator, separatorError],
  )
  const existing = set?.cards.length ?? 0
  const count = preview?.cards.length ?? 0
  const problem =
    size > IMPORT_MAX_BYTES
      ? MESSAGES.importTooLarge
      : (separatorError ??
        (existing + count > LIMITS.cards
          ? `Le set dépasserait ${LIMITS.cards} cartes (${existing} déjà présentes).`
          : null))

  async function loadFile(file: File) {
    setFileError(null)
    if (file.size > IMPORT_MAX_BYTES) {
      setFileError('Fichier trop volumineux : 1 Mo au maximum.')
      return
    }
    try {
      // `fatal` : un fichier qui n'est pas en UTF-8 est refusé plutôt que mal décodé.
      setText(new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer()))
    } catch {
      setFileError(
        "Ce fichier n'est pas encodé en UTF-8. Enregistrez-le au format « CSV UTF-8 » puis réessayez.",
      )
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    try {
      const result = await importCards.mutateAsync({
        title,
        text,
        separators: { term: termSeparator, card: cardSeparator },
      })
      const skipped = result.skipped
        ? ` (${pluralize(result.skipped, 'ligne ignorée', 'lignes ignorées')})`
        : ''
      toast.success(
        `${pluralize(result.imported, 'carte importée', 'cartes importées')}${skipped}.`,
      )
      navigate(`/sets/${result.set.id}`)
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  const heading = set ? `Importer des cartes dans « ${set.title} »` : 'Importer des cartes'
  return (
    <form onSubmit={submit} noValidate aria-labelledby="import-title">
      <title>{pageTitle(heading)}</title>
      <h1 id="import-title" className="text-2xl font-semibold tracking-tight wrap-break-word">
        {heading}
      </h1>
      <p className="mt-2 mb-8 max-w-prose text-muted-foreground">
        Collez des cartes copiées depuis Excel, Google Sheets ou Quizlet (une carte par ligne), ou
        choisissez un fichier .csv ou .txt en UTF-8. {LIMITS.cards} cartes et 1 Mo au maximum.
        {set && ' Les cartes sont ajoutées à la fin du set.'}
      </p>

      <FieldGroup>
        {!set && (
          <Field>
            <FieldLabel htmlFor="import-set-title">Titre du nouveau set</FieldLabel>
            <Input
              id="import-set-title"
              value={title}
              maxLength={LIMITS.title}
              placeholder="Ex. : Vocabulaire anglais"
              onChange={(event) => setTitle(event.target.value)}
            />
            <FieldDescription>
              Le set est créé en privé ; vous pourrez le modifier ensuite.
            </FieldDescription>
          </Field>
        )}
        <Field>
          <FieldLabel htmlFor="import-text">Cartes à importer</FieldLabel>
          <Textarea
            id="import-text"
            rows={8}
            value={text}
            spellCheck={false}
            className="font-mono text-sm"
            placeholder={'chat\tcat\nchien\tdog'}
            onChange={(event) => setText(event.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="import-file">Ou un fichier .csv / .txt</FieldLabel>
          <Input
            id="import-file"
            type="file"
            accept=".csv,.txt,text/csv,text/plain"
            aria-describedby={fileError ? 'import-file-error' : undefined}
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void loadFile(file)
            }}
          />
          {fileError && (
            <p id="import-file-error" role="alert" className="text-sm text-destructive">
              {fileError}
            </p>
          )}
        </Field>
        <SeparatorChoice
          legend="Entre le terme et la définition"
          options={[
            {
              value: 'auto',
              label: `Détection automatique (${SEPARATOR_NAMES[detected.term] ?? detected.term})`,
            },
            { value: 'tab', label: 'Tabulation' },
            { value: 'comma', label: 'Virgule' },
            { value: 'semicolon', label: 'Point-virgule' },
            { value: 'custom', label: 'Autre' },
          ]}
          value={termChoice}
          onValueChange={setTermChoice}
          custom={customTerm}
          onCustomChange={setCustomTerm}
        />
        <SeparatorChoice
          legend="Entre deux cartes"
          options={[
            { value: 'newline', label: 'Nouvelle ligne' },
            { value: 'custom', label: 'Autre' },
          ]}
          value={cardChoice}
          onValueChange={setCardChoice}
          custom={customCard}
          onCustomChange={setCustomCard}
        />
      </FieldGroup>

      <section aria-labelledby="preview-title" className="mt-10">
        <h2 id="preview-title" className="text-lg font-semibold">
          Aperçu
        </h2>
        <p aria-live="polite" className="mt-1 text-sm text-muted-foreground">
          {preview
            ? `${pluralize(count, 'carte détectée', 'cartes détectées')} · ${pluralize(preview.invalid.length, 'ligne ignorée', 'lignes ignorées')}`
            : separatorError}
        </p>
        {preview && count > 0 && (
          <div className="mt-4 overflow-x-auto rounded-xl border">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Cartes détectées</caption>
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th scope="col" className="w-16 px-3 py-2 font-medium">
                    Ligne
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Terme
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Définition
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {preview.cards.slice(0, PREVIEW_ROWS).map((card) => (
                  <tr key={card.line} className="align-top">
                    <td className="px-3 py-2 text-muted-foreground tabular-nums">{card.line}</td>
                    <td className="px-3 py-2 whitespace-pre-line wrap-break-word">{card.term}</td>
                    <td className="px-3 py-2 whitespace-pre-line wrap-break-word">
                      {card.definition}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {count > PREVIEW_ROWS && (
              <p className="border-t px-3 py-2 text-sm text-muted-foreground">
                … et {pluralize(count - PREVIEW_ROWS, 'autre carte', 'autres cartes')}.
              </p>
            )}
          </div>
        )}
        {preview && preview.invalid.length > 0 && (
          <div className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
            <h3 className="text-sm font-medium">Lignes ignorées à l'import</h3>
            <ul className="mt-2 space-y-1 text-sm">
              {preview.invalid.slice(0, PREVIEW_ROWS).map((line) => (
                <li key={line.line} className="wrap-break-word">
                  <span className="font-medium">Ligne {line.line}</span> ({line.reason}) :{' '}
                  <span className="text-muted-foreground">{line.text}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <div className="sticky bottom-0 -mx-4 mt-8 flex flex-wrap items-center justify-end gap-2 border-t bg-background/90 px-4 py-3 backdrop-blur">
        {problem && (
          <p role="alert" className="mr-auto text-sm text-destructive">
            {problem}
          </p>
        )}
        <Button asChild variant="ghost">
          <Link to={set ? `/sets/${set.id}` : '/sets/new'}>Annuler</Link>
        </Button>
        <Button
          type="submit"
          disabled={
            importCards.isPending || count === 0 || problem !== null || (!set && !title.trim())
          }
        >
          {importCards.isPending ? <Loader2Icon className="animate-spin" /> : <UploadIcon />}
          {count > 0 ? `Importer ${pluralize(count, 'carte')}` : 'Importer'}
        </Button>
      </div>
    </form>
  )
}
