import { countDistinctDefinitions, QUIZ_MIN_CARDS } from '@quizlet/shared'
import {
  CopyIcon,
  LayersIcon,
  LinkIcon,
  ListChecksIcon,
  Loader2Icon,
  PencilIcon,
  PlusIcon,
} from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { DeleteSetDialog } from '@/components/sets/DeleteSetDialog'
import { VisibilityBadge } from '@/components/sets/VisibilityBadge'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { StudyModeLink } from '@/components/study/StudyModeLink'
import { Button } from '@/components/ui/button'
import { pageTitle } from '@/config'
import { pluralize } from '@/lib/format'
import { ApiError, errorMessage } from '@/lib/http'
import { type SetDetail, useDuplicateSet, useSet } from '@/lib/queries'
import { NotFoundPage } from '@/pages/NotFoundPage'

export function SetNotFound() {
  return (
    <NotFoundPage
      title="Set introuvable"
      description="Ce set n'existe pas, a été supprimé, ou n'est pas public."
    />
  )
}

/** Charge le set de l'URL (:id) et gère les états de chargement, d'erreur et d'absence. */
export function useSetFromRoute() {
  const { id = '' } = useParams()
  return useSet(id)
}

export function SetQueryStates({ query }: { query: ReturnType<typeof useSet> }) {
  if (query.isPending) return <LoadingState label="Chargement du set…" />
  if (query.error instanceof ApiError && query.error.code === 'NOT_FOUND') return <SetNotFound />
  return <ErrorState error={query.error} onRetry={() => query.refetch()} />
}

export function SetPage() {
  const query = useSetFromRoute()
  if (!query.data) return <SetQueryStates query={query} />
  return <SetOverview set={query.data} />
}

function SetOverview({ set }: { set: SetDetail }) {
  const duplicate = useDuplicateSet()
  const navigate = useNavigate()
  const cardCount = pluralize(set.cards.length, 'carte')

  async function duplicateSet() {
    try {
      const copy = await duplicate.mutateAsync(set.id)
      toast.success('Set dupliqué dans votre bibliothèque.')
      navigate(`/sets/${copy.id}`)
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      toast.success('Lien copié dans le presse-papiers.')
    } catch {
      toast.error('Impossible de copier le lien automatiquement.')
    }
  }

  return (
    <>
      <title>{pageTitle(set.title)}</title>
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
          <VisibilityBadge visibility={set.visibility} />
          <span>{cardCount}</span>
          {!set.isOwner && <span>Créé par {set.owner.displayName}</span>}
          {set.tags.length > 0 && (
            <span>
              <span className="sr-only">Tags : </span>
              {set.tags.map((tag) => `#${tag.name}`).join(' ')}
            </span>
          )}
        </div>
        <h1 className="text-3xl font-semibold tracking-tight wrap-break-word">{set.title}</h1>
        {set.description && (
          <p className="max-w-prose whitespace-pre-line wrap-break-word text-muted-foreground">
            {set.description}
          </p>
        )}
      </header>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <StudyModeLink
          to={`/sets/${set.id}/flashcards`}
          icon={<LayersIcon />}
          title="Flashcards"
          description="Retournez les cartes et notez celles à revoir."
          unavailableReason={
            set.cards.length === 0 ? 'Ajoutez des cartes pour réviser.' : undefined
          }
        />
        <StudyModeLink
          to={`/sets/${set.id}/quiz`}
          icon={<ListChecksIcon />}
          title="Quiz"
          description="Questions à choix multiples, avec un score final."
          unavailableReason={
            countDistinctDefinitions(set.cards) < QUIZ_MIN_CARDS
              ? `Il faut au moins ${QUIZ_MIN_CARDS} cartes aux définitions différentes.`
              : undefined
          }
        />
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {set.isOwner && (
          <Button asChild variant="outline">
            <Link to={`/sets/${set.id}/edit`}>
              <PencilIcon />
              Modifier
            </Link>
          </Button>
        )}
        <Button variant="outline" onClick={duplicateSet} disabled={duplicate.isPending}>
          {duplicate.isPending ? <Loader2Icon className="animate-spin" /> : <CopyIcon />}
          Dupliquer
        </Button>
        {set.visibility === 'public' && (
          <Button variant="outline" onClick={copyLink}>
            <LinkIcon />
            Copier le lien
          </Button>
        )}
        {set.isOwner && <DeleteSetDialog setId={set.id} title={set.title} />}
      </div>

      <section aria-labelledby="cartes" className="mt-10">
        <h2 id="cartes" className="text-lg font-semibold">
          Cartes <span className="font-normal text-muted-foreground">({set.cards.length})</span>
        </h2>
        {set.cards.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              title="Ce set ne contient aucune carte"
              description={set.isOwner ? 'Ajoutez des cartes pour commencer à réviser.' : undefined}
              action={
                set.isOwner && (
                  <Button asChild>
                    <Link to={`/sets/${set.id}/edit`}>
                      <PlusIcon />
                      Ajouter des cartes
                    </Link>
                  </Button>
                )
              }
            />
          </div>
        ) : (
          <ol className="mt-4 divide-y rounded-xl border bg-card">
            {set.cards.map((card) => (
              <li
                key={card.id}
                className="grid gap-1 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] sm:gap-6"
              >
                <p className="font-medium whitespace-pre-line wrap-break-word">{card.term}</p>
                <p className="whitespace-pre-line wrap-break-word text-muted-foreground">
                  {card.definition}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  )
}
