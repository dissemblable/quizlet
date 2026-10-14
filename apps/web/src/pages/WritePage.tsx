import { ChevronLeftIcon, PenLineIcon, RotateCcwIcon, Settings2Icon } from 'lucide-react'
import { type FormEvent, useEffect, useReducer, useRef, useState } from 'react'
import { Link } from 'react-router'
import { EmptyState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { FieldLegend, FieldSet } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { pageTitle } from '@/config'
import { pluralize } from '@/lib/format'
import { errorMessage } from '@/lib/http'
import { type SetDetail, useDueCardIds } from '@/lib/queries'
import { verdict } from '@/lib/quiz'
import {
  buildQuestions,
  initWrite,
  isCorrect,
  scoreOf,
  type WriteDirection,
  type WriteOptions,
  type WriteQuestion,
  type WriteState,
  writeReducer,
} from '@/lib/write'
import { SetQueryStates, useSetFromRoute } from '@/pages/SetPage'

export function WritePage() {
  const query = useSetFromRoute()
  if (!query.data) return <SetQueryStates query={query} />

  const set = query.data
  if (set.cards.length === 0) {
    return (
      <EmptyState
        title="Ce set ne contient aucune carte"
        description="Ajoutez des cartes au set pour pouvoir l'étudier."
        action={
          <Button asChild>
            <Link to={`/sets/${set.id}`}>Retour au set</Link>
          </Button>
        }
      />
    )
  }
  return <WriteMode key={set.id} set={set} />
}

const DIRECTIONS: ReadonlyArray<{ value: WriteDirection; label: string }> = [
  { value: 'term', label: 'Le terme : j’écris la définition' },
  { value: 'definition', label: 'La définition : j’écris le terme' },
  { value: 'mixed', label: 'Les deux, mélangés' },
]

function WriteMode({ set }: { set: SetDetail }) {
  const [options, setOptions] = useState<WriteOptions>({ direction: 'term', shuffle: false })
  // « À revoir » : cartes dues aujourd'hui selon FSRS, lues sans modifier la planification.
  const [onlyDue, setOnlyDue] = useState(false)
  const due = useDueCardIds(set.id, onlyDue)
  const pool = onlyDue ? set.cards.filter((card) => due.data?.includes(card.id)) : set.cards
  // Un nouveau tirage (ordre, sens) à chaque départ ; `round` remonte la session.
  const [session, setSession] = useState<{ round: number; questions: WriteQuestion[] } | null>(null)

  function start() {
    setSession((previous) => ({
      round: (previous?.round ?? 0) + 1,
      questions: buildQuestions(pool, options),
    }))
  }

  return (
    <div className="mx-auto max-w-2xl">
      <title>{pageTitle(`Mode écrit · ${set.title}`)}</title>
      <h1 className="sr-only">Mode écrit : {set.title}</h1>
      <div className="mb-4">
        <Button asChild variant="ghost" size="sm" className="max-w-full">
          <Link to={`/sets/${set.id}`}>
            <ChevronLeftIcon />
            <span className="truncate">{set.title}</span>
          </Link>
        </Button>
      </div>
      {session ? (
        <WriteSession
          key={session.round}
          set={set}
          questions={session.questions}
          onRestart={start}
          onChangeOptions={() => setSession(null)}
        />
      ) : (
        <WriteSetup
          options={options}
          onChange={setOptions}
          onlyDue={onlyDue}
          onOnlyDueChange={setOnlyDue}
          due={due}
          count={pool.length}
          onStart={start}
        />
      )}
    </div>
  )
}

function WriteSetup({
  options,
  onChange,
  onlyDue,
  onOnlyDueChange,
  due,
  count,
  onStart,
}: {
  options: WriteOptions
  onChange: (options: WriteOptions) => void
  onlyDue: boolean
  onOnlyDueChange: (onlyDue: boolean) => void
  due: ReturnType<typeof useDueCardIds>
  /** Cartes retenues pour la session. */
  count: number
  onStart: () => void
}) {
  const loadingDue = onlyDue && due.isPending
  return (
    <section aria-labelledby="write-setup-title" className="rounded-2xl border bg-card p-6 sm:p-8">
      <h2 id="write-setup-title" className="text-xl font-semibold tracking-tight">
        Mode écrit
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Tapez la réponse. La casse, les accents et la ponctuation sont ignorés, et quelques fautes
        de frappe sont tolérées. Ce mode ne modifie pas votre planification de révision.
      </p>

      <FieldSet className="mt-6">
        <FieldLegend variant="label">Je vois…</FieldLegend>
        <RadioGroup
          value={options.direction}
          onValueChange={(direction) =>
            onChange({ ...options, direction: direction as WriteDirection })
          }
        >
          {DIRECTIONS.map((direction) => (
            <Label key={direction.value} className="font-normal">
              <RadioGroupItem value={direction.value} />
              {direction.label}
            </Label>
          ))}
        </RadioGroup>
      </FieldSet>
      <Label className="mt-6 font-normal">
        <Checkbox
          checked={options.shuffle}
          onCheckedChange={(checked) => onChange({ ...options, shuffle: checked === true })}
        />
        Mélanger les cartes
      </Label>
      <Label className="mt-3 font-normal">
        <Checkbox
          checked={onlyDue}
          onCheckedChange={(checked) => onOnlyDueChange(checked === true)}
        />
        Seulement les cartes à revoir aujourd'hui (répétition espacée)
      </Label>
      <p aria-live="polite" className="mt-2 text-sm text-muted-foreground">
        {!onlyDue
          ? null
          : due.isError
            ? errorMessage(due.error)
            : loadingDue
              ? 'Recherche des cartes à revoir…'
              : count === 0
                ? "Aucune carte de ce set n'est à revoir aujourd'hui."
                : `${pluralize(count, 'carte à revoir', 'cartes à revoir')} aujourd'hui.`}
      </p>

      <Button className="mt-6" onClick={onStart} disabled={loadingDue || count === 0}>
        <PenLineIcon />
        Commencer ({pluralize(count, 'carte')})
      </Button>
    </section>
  )
}

function WriteSession({
  set,
  questions,
  onRestart,
  onChangeOptions,
}: {
  set: SetDetail
  questions: WriteQuestion[]
  onRestart: () => void
  onChangeOptions: () => void
}) {
  const [state, dispatch] = useReducer(writeReducer, questions, initWrite)
  const [given, setGiven] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const continueButton = useRef<HTMLButtonElement>(null)
  const question = state.questions[state.index]
  const current = state.current
  const answered = current !== null

  // Correction affichée : focus sur « Continuer » (Entrée enchaîne) ; sinon, sur la saisie.
  useEffect(() => {
    if (answered) continueButton.current?.focus()
    else input.current?.focus()
  }, [answered])

  function submit(event: FormEvent) {
    event.preventDefault()
    dispatch({ type: 'submit', given })
  }

  function next() {
    dispatch({ type: 'next' })
    setGiven('')
  }

  return (
    <>
      <div className="mb-6 space-y-2">
        <div className="flex justify-between gap-4 text-sm text-muted-foreground">
          <span>
            {state.finished
              ? 'Session terminée'
              : `Question ${state.index + 1} sur ${state.questions.length}`}
          </span>
          <span>
            Bonnes réponses : {state.answers.filter(isCorrect).length} / {state.answers.length}
          </span>
        </div>
        <Progress
          value={Math.round((state.answers.length / state.questions.length) * 100)}
          aria-label="Progression de la session"
        />
      </div>

      {state.finished || !question ? (
        <WriteResult
          state={state}
          set={set}
          onRestart={onRestart}
          onChangeOptions={onChangeOptions}
        />
      ) : (
        <section aria-labelledby="write-prompt-label">
          <p id="write-prompt-label" className="text-sm text-muted-foreground">
            {question.shown === 'term' ? 'Terme' : 'Définition'}
          </p>
          <p
            id="write-prompt"
            className="mt-1 mb-6 text-2xl font-semibold tracking-tight whitespace-pre-line wrap-break-word"
          >
            {question.prompt}
          </p>

          <form onSubmit={submit} className="space-y-3">
            <Label htmlFor="write-answer">
              {question.shown === 'term' ? 'Votre définition' : 'Votre terme'}
            </Label>
            <Input
              id="write-answer"
              ref={input}
              value={given}
              readOnly={answered}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              aria-describedby="write-prompt"
              onChange={(event) => setGiven(event.target.value)}
            />
            {!answered && (
              <div className="flex flex-wrap gap-2">
                <Button type="submit">Valider</Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => dispatch({ type: 'submit', given: '' })}
                >
                  Je ne sais pas
                </Button>
              </div>
            )}
          </form>

          <div aria-live="polite" className="mt-4 text-sm">
            {current &&
              (current.result === 'exact' ? (
                <p className="font-medium text-emerald-700 dark:text-emerald-400">Correct !</p>
              ) : current.result === 'typo' || current.overridden ? (
                <p className="text-emerald-700 wrap-break-word dark:text-emerald-400">
                  <span className="font-medium">
                    {current.overridden ? 'Réponse comptée juste.' : 'Correct, à une faute près.'}
                  </span>{' '}
                  Réponse attendue : {question.answer}
                </p>
              ) : (
                <div className="space-y-1 text-destructive wrap-break-word">
                  <p className="font-medium">
                    {current.given.trim() ? 'Incorrect.' : 'Voici la réponse.'}
                  </p>
                  <p>
                    Bonne réponse : <strong>{question.answer}</strong>
                  </p>
                </div>
              ))}
          </div>

          {current && (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button ref={continueButton} onClick={next}>
                {state.index === state.questions.length - 1 ? 'Voir le résultat' : 'Continuer'}
              </Button>
              {current.result === 'wrong' && !current.overridden && current.given.trim() && (
                <Button
                  variant="outline"
                  onClick={() => {
                    dispatch({ type: 'override' })
                    continueButton.current?.focus()
                  }}
                >
                  J'avais raison
                </Button>
              )}
            </div>
          )}
          <p className="mt-4 hidden text-xs text-muted-foreground sm:block">
            Raccourci : Entrée pour valider, puis pour continuer.
          </p>
        </section>
      )}
    </>
  )
}

function WriteResult({
  state,
  set,
  onRestart,
  onChangeOptions,
}: {
  state: WriteState
  set: SetDetail
  onRestart: () => void
  onChangeOptions: () => void
}) {
  const heading = useRef<HTMLHeadingElement>(null)
  const { correct, total, mistakes } = scoreOf(state)
  const percent = total === 0 ? 0 : Math.round((correct / total) * 100)

  useEffect(() => {
    heading.current?.focus()
  }, [])

  return (
    <section aria-labelledby="write-result-title" className="rounded-2xl border bg-card p-6 sm:p-8">
      <h2
        id="write-result-title"
        ref={heading}
        tabIndex={-1}
        className="text-xl font-semibold tracking-tight outline-none"
      >
        Résultat
      </h2>
      <p className="mt-4 text-4xl font-semibold tabular-nums">
        {correct} / {total}
      </p>
      <p className="mt-1 text-muted-foreground">
        {percent} % de bonnes réponses. {verdict(percent)}
      </p>

      {mistakes.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-medium">Erreurs</h3>
          <ul className="mt-2 divide-y rounded-xl border">
            {mistakes.map(({ question, given }) => (
              <li key={question.cardId} className="space-y-1 p-3 text-sm">
                <p className="font-medium wrap-break-word">{question.prompt}</p>
                <p className="text-destructive wrap-break-word">
                  Votre réponse : {given.trim() || '(aucune)'}
                </p>
                <p className="text-emerald-700 wrap-break-word dark:text-emerald-400">
                  Bonne réponse : {question.answer}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        <Button onClick={onRestart}>
          <RotateCcwIcon />
          Recommencer
        </Button>
        <Button variant="outline" onClick={onChangeOptions}>
          <Settings2Icon />
          Changer les options
        </Button>
        <Button asChild variant="ghost">
          <Link to={`/sets/${set.id}`}>Retour au set</Link>
        </Button>
      </div>
    </section>
  )
}
