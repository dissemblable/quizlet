import { LIMITS } from '@quizlet/shared'
import { LibraryIcon, PlusIcon, SearchIcon, SearchXIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { SetCard } from '@/components/sets/SetCard'
import { EmptyState, ErrorState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { pageTitle } from '@/config'
import { pluralize } from '@/lib/format'
import { useDebouncedValue } from '@/lib/hooks'
import { useSets } from '@/lib/queries'

export function LibraryPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const urlSearch = searchParams.get('q') ?? ''
  const [input, setInput] = useState(urlSearch)
  const search = useDebouncedValue(input.trim())
  const query = useSets(search)

  // La recherche reste dans l'URL (lien partageable, retour arrière) sans empiler l'historique.
  useEffect(() => {
    if (search !== urlSearch) setSearchParams(search ? { q: search } : {}, { replace: true })
  }, [search, urlSearch, setSearchParams])

  return (
    <>
      <title>{pageTitle('Bibliothèque')}</title>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Ma bibliothèque</h1>
          {query.data && !search && (
            <p className="mt-1 text-sm text-muted-foreground">
              {pluralize(query.data.length, 'set')}
            </p>
          )}
        </div>
        <div className="relative w-full sm:max-w-xs">
          <label htmlFor="search" className="sr-only">
            Rechercher un set par titre
          </label>
          <SearchIcon
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            id="search"
            type="search"
            placeholder="Rechercher un set…"
            className="pl-8"
            maxLength={LIMITS.search}
            value={input}
            onChange={(event) => setInput(event.target.value)}
          />
        </div>
      </div>

      {query.isPending ? (
        <div aria-busy="true" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <span className="sr-only">Chargement de la bibliothèque…</span>
          {['a', 'b', 'c'].map((key) => (
            <Skeleton key={key} className="h-36 rounded-xl" />
          ))}
        </div>
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : query.data.length === 0 ? (
        search ? (
          <EmptyState
            icon={<SearchXIcon />}
            title="Aucun résultat"
            description={`Aucun de vos sets ne contient « ${search} » dans son titre.`}
            action={
              <Button variant="outline" onClick={() => setInput('')}>
                Effacer la recherche
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={<LibraryIcon />}
            title="Votre bibliothèque est vide"
            description="Créez votre premier set de cartes, ou dupliquez un set public partagé avec vous."
            action={
              <Button asChild>
                <Link to="/sets/new">
                  <PlusIcon />
                  Créer un set
                </Link>
              </Button>
            }
          />
        )
      ) : (
        <ul
          aria-label="Mes sets"
          aria-busy={query.isPlaceholderData}
          className="grid gap-4 transition-opacity aria-busy:opacity-60 sm:grid-cols-2 lg:grid-cols-3"
        >
          {query.data.map((set) => (
            <SetCard key={set.id} set={set} />
          ))}
        </ul>
      )}
    </>
  )
}
