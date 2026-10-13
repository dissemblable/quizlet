import { LIMITS } from '@quizlet/shared'
import { FolderOpenIcon, LibraryIcon, PlusIcon, SearchIcon, SearchXIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { LibraryFilters } from '@/components/library/LibraryFilters'
import { SetCard } from '@/components/sets/SetCard'
import { EmptyState, ErrorState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { pageTitle } from '@/config'
import { pluralize } from '@/lib/format'
import { useDebouncedValue } from '@/lib/hooks'
import { libraryParams, readLibraryFilters } from '@/lib/library'
import { type LibraryFilters as Filters, useSets } from '@/lib/queries'

export function LibraryPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = readLibraryFilters(searchParams)
  const [input, setInput] = useState(filters.q)
  const search = useDebouncedValue(input.trim())
  const query = useSets({ ...filters, q: search })
  const filtered = Boolean(filters.folder) || filters.tags.length > 0

  // La recherche reste dans l'URL (lien partageable, retour arrière) sans empiler l'historique.
  useEffect(() => {
    if (search === filters.q) return
    setSearchParams(libraryParams({ ...filters, q: search, page: 1 }), { replace: true })
  }, [search, filters, setSearchParams])

  /** Changer de dossier, de tags ou de page crée une entrée d'historique (bouton Retour). */
  function update(patch: Partial<Filters>) {
    setSearchParams(libraryParams({ ...filters, q: search, page: 1, ...patch }))
    if (patch.page) window.scrollTo({ top: 0 })
  }

  const data = query.data
  const pageCount = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1

  return (
    <>
      <title>{pageTitle('Bibliothèque')}</title>
      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Ma bibliothèque</h1>
          {data && !search && (
            <p className="mt-1 text-sm text-muted-foreground">{pluralize(data.total, 'set')}</p>
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

      <LibraryFilters filters={filters} onChange={update} />

      {query.isPending ? (
        <div aria-busy="true" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <span className="sr-only">Chargement de la bibliothèque…</span>
          {['a', 'b', 'c'].map((key) => (
            <Skeleton key={key} className="h-36 rounded-xl" />
          ))}
        </div>
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : query.data.sets.length === 0 ? (
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
        ) : filtered || filters.page > 1 ? (
          <EmptyState
            icon={<FolderOpenIcon />}
            title="Aucun set ici"
            description="Aucun de vos sets ne correspond à ces filtres."
            action={
              <Button variant="outline" onClick={() => update({ folder: undefined, tags: [] })}>
                Afficher tous les sets
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
        <>
          <ul
            aria-label="Mes sets"
            aria-busy={query.isPlaceholderData}
            className="grid gap-4 transition-opacity aria-busy:opacity-60 sm:grid-cols-2 lg:grid-cols-3"
          >
            {query.data.sets.map((set) => (
              <SetCard key={set.id} set={set} />
            ))}
          </ul>
          {pageCount > 1 && (
            <nav
              aria-label="Pages de la bibliothèque"
              className="mt-6 flex items-center justify-between gap-2"
            >
              <Button
                variant="outline"
                disabled={filters.page <= 1}
                onClick={() => update({ page: filters.page - 1 })}
              >
                Précédente
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {filters.page} sur {pageCount}
              </span>
              <Button
                variant="outline"
                disabled={filters.page >= pageCount}
                onClick={() => update({ page: filters.page + 1 })}
              >
                Suivante
              </Button>
            </nav>
          )}
        </>
      )}
    </>
  )
}
