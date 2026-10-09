import { ChevronLeftIcon, LayersIcon, ListChecksIcon, RotateCcwIcon } from 'lucide-react'
import { useEffect, useReducer, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { ChoiceButton, type ChoiceStatus } from '@/components/study/ChoiceButton'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { pageTitle } from '@/config'
import { ApiError } from '@/lib/http'
import { type SetDetail, useQuiz, useSet } from '@/lib/queries'
import {
  currentQuestion,
  initQuiz,
  mistakesOf,
  type QuizQuestion,
  type QuizState,
  quizReducer,
  scoreOf,
  verdict,
} from '@/lib/quiz'
import { useShortcuts } from '@/lib/use-shortcuts'
import { SetQueryStates } from '@/pages/SetPage'

export function QuizPage() {
  const { id = '' } = useParams()
  const setQuery = useSet(id)
  // Chaque tentative demande un nouveau tirage à l'API.
  const [attempt, setAttempt] = useState(0)
  const quiz = useQuiz(id, attempt)

  if (!setQuery.data) return <SetQueryStates query={setQuery} />
  const set = setQuery.data

  if (quiz.isPending) return <LoadingState label="Préparation du quiz…" rows={4} />
  if (quiz.isError) {
    if (quiz.error instanceof ApiError && quiz.error.code === 'QUIZ_NOT_ENOUGH_CARDS') {
      return (
        <EmptyState
          icon={<ListChecksIcon />}
          title="Pas assez de cartes pour un quiz"
          description={quiz.error.message}
          action={
            <Button asChild>
              <Link to={`/sets/${set.id}`}>Retour au set</Link>
            </Button>
          }
        />
      )
    }
    return <ErrorState error={quiz.error} onRetry={() => quiz.refetch()} />
  }

  return (
    <QuizSession
      key={attempt}
      set={set}
      questions={quiz.data}
      onRestart={() => setAttempt((value) => value + 1)}
    />
  )
}

function choiceStatus(
  question: QuizQuestion,
  answer: number | undefined,
  index: number,
): ChoiceStatus {
  if (answer === undefined) return 'idle'
  if (index === question.answerIndex) return 'correct'
  return index === answer ? 'wrong' : 'dimmed'
}

function QuizSession({
  set,
  questions,
  onRestart,
}: {
  set: SetDetail
  questions: QuizQuestion[]
  onRestart: () => void
}) {
  const [state, dispatch] = useReducer(quizReducer, questions, initQuiz)
  const nextButton = useRef<HTMLButtonElement>(null)
  const termHeading = useRef<HTMLHeadingElement>(null)
  const question = currentQuestion(state)
  const answer = state.answers[state.index]
  const answered = answer !== undefined
  const score = scoreOf(state)

  // Après une réponse, le focus va sur « Question suivante » : Entrée enchaîne.
  useEffect(() => {
    if (answered) nextButton.current?.focus()
  }, [answered])

  // Nouvelle question : le focus va sur son énoncé (lu par les lecteurs d'écran).
  useEffect(() => {
    if (state.index > 0) termHeading.current?.focus()
  }, [state.index])

  const answerWith = (choice: number) => () => dispatch({ type: 'answer', choice })
  useShortcuts(
    { '1': answerWith(0), '2': answerWith(1), '3': answerWith(2), '4': answerWith(3) },
    !state.finished && !answered,
  )

  return (
    <div className="mx-auto max-w-2xl">
      <title>{pageTitle(`Quiz · ${set.title}`)}</title>
      <h1 className="sr-only">Quiz : {set.title}</h1>

      <div className="mb-4">
        <Button asChild variant="ghost" size="sm" className="max-w-full">
          <Link to={`/sets/${set.id}`}>
            <ChevronLeftIcon />
            <span className="truncate">{set.title}</span>
          </Link>
        </Button>
      </div>

      <div className="mb-6 space-y-2">
        <div className="flex justify-between gap-4 text-sm text-muted-foreground">
          <span>
            {state.finished
              ? 'Quiz terminé'
              : `Question ${state.index + 1} sur ${state.questions.length}`}
          </span>
          <span>
            Bonnes réponses : {score.correct} / {score.answered}
          </span>
        </div>
        <Progress
          value={Math.round((score.answered / score.total) * 100)}
          aria-label="Progression du quiz"
        />
      </div>

      {state.finished || !question ? (
        <QuizResult state={state} set={set} onRestart={onRestart} />
      ) : (
        <section aria-labelledby="question-term">
          <p className="text-sm text-muted-foreground">Quelle est la définition de :</p>
          <h2
            id="question-term"
            ref={termHeading}
            tabIndex={-1}
            className="mt-1 mb-6 text-2xl font-semibold tracking-tight whitespace-pre-line wrap-break-word outline-none"
          >
            {question.term}
          </h2>

          <ul aria-label="Réponses proposées" className="grid gap-3">
            {question.choices.map((choice, index) => (
              // Les choix d'une question sont distincts : le texte sert de clé.
              <li key={choice}>
                <ChoiceButton
                  index={index}
                  label={choice}
                  status={choiceStatus(question, answer, index)}
                  onSelect={answerWith(index)}
                />
              </li>
            ))}
          </ul>

          <div aria-live="polite" className="mt-4 min-h-6 text-sm font-medium">
            {answered &&
              (answer === question.answerIndex ? (
                <span className="text-emerald-700 dark:text-emerald-400">Bonne réponse !</span>
              ) : (
                <span className="text-destructive">
                  Mauvaise réponse. La bonne réponse était :{' '}
                  {question.choices[question.answerIndex]}
                </span>
              ))}
          </div>

          {answered ? (
            <Button
              ref={nextButton}
              className="mt-4 w-full sm:w-auto"
              onClick={() => dispatch({ type: 'next' })}
            >
              {state.index === state.questions.length - 1
                ? 'Voir le résultat'
                : 'Question suivante'}
            </Button>
          ) : (
            <p className="mt-4 hidden text-xs text-muted-foreground sm:block">
              Raccourcis : touches 1 à 4 pour répondre.
            </p>
          )}
        </section>
      )}
    </div>
  )
}

function QuizResult({
  state,
  set,
  onRestart,
}: {
  state: QuizState
  set: SetDetail
  onRestart: () => void
}) {
  const heading = useRef<HTMLHeadingElement>(null)
  const { correct, total, percent } = scoreOf(state)
  const mistakes = mistakesOf(state)

  useEffect(() => {
    heading.current?.focus()
  }, [])

  return (
    <section aria-labelledby="result-title" className="rounded-2xl border bg-card p-6 sm:p-8">
      <h2
        id="result-title"
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
          <h3 className="text-sm font-medium">Erreurs à revoir</h3>
          <ul className="mt-2 divide-y rounded-xl border">
            {mistakes.map(({ question, chosen, expected }) => (
              <li key={question.cardId} className="space-y-1 p-3 text-sm">
                <p className="font-medium wrap-break-word">{question.term}</p>
                <p className="text-destructive wrap-break-word">Votre réponse : {chosen}</p>
                <p className="text-emerald-700 wrap-break-word dark:text-emerald-400">
                  Bonne réponse : {expected}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        <Button onClick={onRestart}>
          <RotateCcwIcon />
          Nouveau quiz
        </Button>
        <Button asChild variant="outline">
          <Link to={`/sets/${set.id}/flashcards`}>
            <LayersIcon />
            Réviser en flashcards
          </Link>
        </Button>
        <Button asChild variant="ghost">
          <Link to={`/sets/${set.id}`}>Retour au set</Link>
        </Button>
      </div>
    </section>
  )
}
