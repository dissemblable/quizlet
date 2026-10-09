import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  ChevronLeftIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  ShuffleIcon,
  UndoIcon,
} from 'lucide-react'
import { type Dispatch, useEffect, useMemo, useReducer, useRef } from 'react'
import { Link } from 'react-router'
import { EmptyState } from '@/components/states'
import { Flashcard } from '@/components/study/Flashcard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { pageTitle } from '@/config'
import {
  currentCardId,
  type FlashcardsAction,
  type FlashcardsState,
  flashcardsReducer,
  initFlashcards,
  progressOf,
  reviewIds,
} from '@/lib/flashcards'
import { pluralize } from '@/lib/format'
import type { SetDetail } from '@/lib/queries'
import { useShortcuts } from '@/lib/use-shortcuts'
import { SetQueryStates, useSetFromRoute } from '@/pages/SetPage'

export function FlashcardsPage() {
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
  return <FlashcardsSession key={set.id} set={set} />
}

type Card = SetDetail['cards'][number]

function FlashcardsSession({ set }: { set: SetDetail }) {
  const [state, dispatch] = useReducer(
    flashcardsReducer,
    set.cards.map((card) => card.id),
    initFlashcards,
  )
  const cardsById = useMemo(() => new Map(set.cards.map((card) => [card.id, card])), [set.cards])
  const cardButton = useRef<HTMLButtonElement>(null)
  const progress = progressOf(state)
  const currentId = currentCardId(state)
  const current = currentId ? cardsById.get(currentId) : undefined
  const currentMark = currentId ? state.marks[currentId] : undefined

  useShortcuts(
    {
      ' ': () => dispatch({ type: 'flip' }),
      ArrowRight: () => dispatch({ type: 'next' }),
      ArrowLeft: () => dispatch({ type: 'previous' }),
    },
    !state.finished,
  )

  function restart(action: FlashcardsAction) {
    dispatch(action)
    requestAnimationFrame(() => cardButton.current?.focus())
  }

  return (
    <div className="mx-auto max-w-2xl">
      <title>{pageTitle(`Flashcards · ${set.title}`)}</title>
      <h1 className="sr-only">Flashcards : {set.title}</h1>

      <div className="mb-4 flex items-center justify-between gap-2">
        <Button asChild variant="ghost" size="sm" className="min-w-0">
          <Link to={`/sets/${set.id}`}>
            <ChevronLeftIcon />
            <span className="truncate">{set.title}</span>
          </Link>
        </Button>
        <Button
          variant={state.shuffled ? 'secondary' : 'ghost'}
          size="sm"
          aria-pressed={state.shuffled}
          onClick={() => restart({ type: 'toggleShuffle' })}
        >
          <ShuffleIcon />
          Mélanger
        </Button>
      </div>

      <div className="mb-6 space-y-2">
        <div className="flex justify-between gap-4 text-sm text-muted-foreground">
          <span>
            {state.finished
              ? 'Session terminée'
              : `Carte ${progress.position} sur ${progress.total}`}
          </span>
          <span>
            Je sais : {progress.known} · À revoir : {progress.review}
          </span>
        </div>
        <Progress value={progress.percent} aria-label="Progression de la session" />
      </div>

      {state.finished || !current ? (
        <Recap state={state} cardsById={cardsById} setId={set.id} onRestart={restart} />
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
          <div className="mt-2 flex h-6 justify-center">
            {currentMark && (
              <Badge variant={currentMark === 'known' ? 'secondary' : 'outline'}>
                {currentMark === 'known' ? 'Marquée « Je sais »' : 'Marquée « À revoir »'}
              </Badge>
            )}
          </div>

          <div className="mt-2 grid grid-cols-3 gap-2">
            <Button
              variant="outline"
              onClick={() => dispatch({ type: 'previous' })}
              disabled={state.index === 0}
            >
              <ArrowLeftIcon />
              <span className="sr-only sm:not-sr-only">Précédente</span>
            </Button>
            <Button variant="outline" onClick={() => dispatch({ type: 'flip' })}>
              <RefreshCwIcon />
              Retourner
            </Button>
            <Button variant="outline" onClick={() => dispatch({ type: 'next' })}>
              <span className="sr-only sm:not-sr-only">Suivante</span>
              <ArrowRightIcon />
            </Button>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              className="border-amber-500/40 text-amber-700 hover:bg-amber-500/10 dark:text-amber-400"
              onClick={() => dispatch({ type: 'mark', mark: 'review' })}
            >
              <UndoIcon />À revoir
            </Button>
            <Button
              variant="outline"
              className="border-emerald-500/40 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-400"
              onClick={() => dispatch({ type: 'mark', mark: 'known' })}
            >
              <CheckIcon />
              Je sais
            </Button>
          </div>
          <p className="mt-4 hidden text-center text-xs text-muted-foreground sm:block">
            Raccourcis : Espace pour retourner la carte, ← et → pour naviguer.
          </p>
        </>
      )}
    </div>
  )
}

function Recap({
  state,
  cardsById,
  setId,
  onRestart,
}: {
  state: FlashcardsState
  cardsById: Map<string, Card>
  setId: string
  onRestart: Dispatch<FlashcardsAction>
}) {
  const heading = useRef<HTMLHeadingElement>(null)
  const { known, review, unmarked, total } = progressOf(state)
  const toReview = reviewIds(state)
    .map((id) => cardsById.get(id))
    .filter((card): card is Card => card !== undefined)

  // Les boutons de la carte ont disparu : on amène le focus sur le récapitulatif.
  useEffect(() => {
    heading.current?.focus()
  }, [])

  return (
    <section aria-labelledby="recap-title" className="rounded-2xl border bg-card p-6 sm:p-8">
      <h2
        id="recap-title"
        ref={heading}
        tabIndex={-1}
        className="text-xl font-semibold tracking-tight outline-none"
      >
        Session terminée
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Vous avez parcouru {pluralize(total, 'carte')}.
      </p>

      <dl className="mt-6 grid grid-cols-3 gap-3 text-center">
        <div className="rounded-xl bg-emerald-500/10 p-3">
          <dt className="text-xs text-muted-foreground">Je sais</dt>
          <dd className="text-2xl font-semibold text-emerald-700 dark:text-emerald-400">{known}</dd>
        </div>
        <div className="rounded-xl bg-amber-500/10 p-3">
          <dt className="text-xs text-muted-foreground">À revoir</dt>
          <dd className="text-2xl font-semibold text-amber-700 dark:text-amber-400">{review}</dd>
        </div>
        <div className="rounded-xl bg-muted p-3">
          <dt className="text-xs text-muted-foreground">Non marquées</dt>
          <dd className="text-2xl font-semibold">{unmarked}</dd>
        </div>
      </dl>

      {toReview.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-medium">Cartes à revoir</h3>
          <ul className="mt-2 divide-y rounded-xl border">
            {toReview.map((card) => (
              <li key={card.id} className="grid gap-1 p-3 text-sm sm:grid-cols-2 sm:gap-4">
                <span className="font-medium wrap-break-word">{card.term}</span>
                <span className="wrap-break-word text-muted-foreground">{card.definition}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        {review > 0 && (
          <Button onClick={() => onRestart({ type: 'restart', onlyReview: true })}>
            <UndoIcon />
            {review === 1 ? 'Réviser la carte à revoir' : `Réviser les ${review} cartes à revoir`}
          </Button>
        )}
        <Button variant="outline" onClick={() => onRestart({ type: 'restart' })}>
          <RotateCcwIcon />
          Recommencer
        </Button>
        <Button asChild variant="ghost">
          <Link to={`/sets/${setId}`}>Retour au set</Link>
        </Button>
      </div>
    </section>
  )
}
