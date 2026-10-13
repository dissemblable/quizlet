import { RATINGS, type Rating } from '@quizlet/shared'
import { CalendarCheckIcon, ChevronLeftIcon, RotateCcwIcon } from 'lucide-react'
import { useEffect, useReducer, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { toast } from 'sonner'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { Flashcard } from '@/components/study/Flashcard'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { pageTitle } from '@/config'
import { pluralize } from '@/lib/format'
import { errorMessage } from '@/lib/http'
import { type QueueCard, type SetDetail, useGradeCard, useReviewQueue, useSet } from '@/lib/queries'
import {
  formatInterval,
  initReviewSession,
  RATING_LABELS,
  type ReviewSessionState,
  reviewReducer,
} from '@/lib/review'
import { useShortcuts } from '@/lib/use-shortcuts'
import { SetQueryStates } from '@/pages/SetPage'

const RATING_STYLES: Record<Rating, string> = {
  1: 'border-destructive/40 text-destructive hover:bg-destructive/10',
  2: 'border-amber-500/40 text-amber-700 hover:bg-amber-500/10 dark:text-amber-400',
  3: 'border-emerald-500/40 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-400',
  4: 'border-sky-500/40 text-sky-700 hover:bg-sky-500/10 dark:text-sky-400',
}

/** « Révision du jour » (tous mes sets) ou « Réviser ce set » (`/sets/:id/review`). */
export function ReviewPage() {
  const { id } = useParams()
  return id ? <SetReview id={id} /> : <Review />
}

function SetReview({ id }: { id: string }) {
  const query = useSet(id)
  if (!query.data) return <SetQueryStates query={query} />
  return <Review set={query.data} />
}

function Review({ set }: { set?: SetDetail }) {
  // Chaque nouvelle séance redemande la file à l'API.
  const [attempt, setAttempt] = useState(0)
  const queue = useReviewQueue(set?.id, attempt)
  const title = set ? `Réviser « ${set.title} »` : 'Révision du jour'
  const back = set
    ? { to: `/sets/${set.id}`, label: set.title }
    : { to: '/', label: 'Bibliothèque' }

  return (
    <div className="mx-auto max-w-2xl">
      <title>{pageTitle(title)}</title>
      <h1 className="sr-only">{title}</h1>
      <div className="mb-4">
        <Button asChild variant="ghost" size="sm" className="max-w-full">
          <Link to={back.to}>
            <ChevronLeftIcon />
            <span className="truncate">{back.label}</span>
          </Link>
        </Button>
      </div>
      {queue.isPending ? (
        <LoadingState label="Préparation de la révision…" rows={2} />
      ) : queue.isError ? (
        <ErrorState error={queue.error} onRetry={() => queue.refetch()} />
      ) : queue.data.cards.length === 0 ? (
        <EmptyState
          icon={<CalendarCheckIcon />}
          title="Rien à réviser pour le moment"
          description="Les cartes dues et les nouvelles cartes du jour (selon vos limites quotidiennes) ont toutes été vues. Revenez plus tard."
          action={
            <Button asChild variant="outline">
              <Link to={back.to}>Retour</Link>
            </Button>
          }
        />
      ) : (
        <ReviewSession
          key={attempt}
          cards={queue.data.cards}
          back={back}
          onRestart={() => setAttempt((value) => value + 1)}
        />
      )}
    </div>
  )
}

function ReviewSession({
  cards,
  back,
  onRestart,
}: {
  cards: QueueCard[]
  back: { to: string; label: string }
  onRestart: () => void
}) {
  const [state, dispatch] = useReducer(reviewReducer, cards, initReviewSession)
  const grade = useGradeCard()
  const cardButton = useRef<HTMLButtonElement>(null)
  const current = state.queue[0]
  const reviewed = RATINGS.reduce((sum, rating) => sum + state.ratings[rating], 0)
  const now = new Date()

  async function rate(rating: Rating) {
    if (!current || !state.flipped || grade.isPending) return
    try {
      const result = await grade.mutateAsync({ cardId: current.id, rating })
      dispatch({ type: 'graded', rating, requeue: result.card })
      requestAnimationFrame(() => cardButton.current?.focus())
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  useShortcuts(
    {
      ' ': () => dispatch({ type: 'flip' }),
      '1': () => void rate(1),
      '2': () => void rate(2),
      '3': () => void rate(3),
      '4': () => void rate(4),
    },
    current !== undefined,
  )

  return (
    <>
      <div className="mb-6 space-y-2">
        <div className="flex justify-between gap-4 text-sm text-muted-foreground">
          <span>
            {current ? `Encore ${pluralize(state.queue.length, 'carte')}` : 'Séance terminée'}
          </span>
          <span>{pluralize(reviewed, 'note donnée', 'notes données')}</span>
        </div>
        <Progress
          value={Math.round((reviewed / (reviewed + state.queue.length)) * 100)}
          aria-label="Progression de la séance"
        />
      </div>

      {!current ? (
        <ReviewRecap state={state} back={back} onRestart={onRestart} />
      ) : (
        <>
          <Flashcard
            ref={cardButton}
            term={current.term}
            definition={current.definition}
            flipped={state.flipped}
            onFlip={() => dispatch({ type: 'flip' })}
          />
          <p aria-live="polite" className="sr-only">
            {state.flipped ? `Définition : ${current.definition}` : `Terme : ${current.term}`}
          </p>
          {state.flipped ? (
            <fieldset className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <legend className="sr-only">Notez votre réponse</legend>
              {RATINGS.map((rating) => (
                <Button
                  key={rating}
                  variant="outline"
                  className={`h-auto flex-col gap-0.5 py-2 ${RATING_STYLES[rating]}`}
                  disabled={grade.isPending}
                  aria-keyshortcuts={String(rating)}
                  onClick={() => void rate(rating)}
                >
                  <span className="font-medium">{RATING_LABELS[rating]}</span>{' '}
                  <span className="text-xs text-muted-foreground">
                    {formatInterval(new Date(current.intervals[rating - 1] ?? now), now)}
                  </span>
                </Button>
              ))}
            </fieldset>
          ) : (
            <Button className="mt-4 w-full" onClick={() => dispatch({ type: 'flip' })}>
              Afficher la réponse
            </Button>
          )}
          <p className="mt-4 hidden text-center text-xs text-muted-foreground sm:block">
            Raccourcis : Espace pour retourner la carte, 1 à 4 pour noter.
          </p>
        </>
      )}
    </>
  )
}

function ReviewRecap({
  state,
  back,
  onRestart,
}: {
  state: ReviewSessionState
  back: { to: string; label: string }
  onRestart: () => void
}) {
  const heading = useRef<HTMLHeadingElement>(null)
  const reviewed = RATINGS.reduce((sum, rating) => sum + state.ratings[rating], 0)

  // Les boutons de notation ont disparu : le focus passe au récapitulatif.
  useEffect(() => {
    heading.current?.focus()
  }, [])

  return (
    <section aria-labelledby="review-recap-title" className="rounded-2xl border bg-card p-6 sm:p-8">
      <h2
        id="review-recap-title"
        ref={heading}
        tabIndex={-1}
        className="text-xl font-semibold tracking-tight outline-none"
      >
        Séance terminée
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {pluralize(reviewed, 'note donnée', 'notes données')}. Chaque carte reviendra au bon moment.
      </p>
      <dl className="mt-6 grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
        {RATINGS.map((rating) => (
          <div key={rating} className="rounded-xl bg-muted p-3">
            <dt className="text-xs text-muted-foreground">{RATING_LABELS[rating]}</dt>
            <dd className="text-2xl font-semibold tabular-nums">{state.ratings[rating]}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-6 flex flex-wrap gap-2">
        <Button onClick={onRestart}>
          <RotateCcwIcon />
          Chercher d'autres cartes
        </Button>
        <Button asChild variant="ghost">
          <Link to={back.to}>{back.to === '/' ? 'Retour à la bibliothèque' : 'Retour au set'}</Link>
        </Button>
      </div>
    </section>
  )
}
