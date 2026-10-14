import { LIMITS } from '@quizlet/shared'
import { SearchIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { pluralize } from '@/lib/format'
import { useDebouncedValue } from '@/lib/hooks'
import { errorMessage } from '@/lib/http'
import { useSearchSets } from '@/lib/queries'

/** Recherche globale dans mes sets (titre, description, tags, cartes), ouverte par Ctrl/Cmd+K. */
export function SearchDialog() {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const search = useDebouncedValue(input.trim())
  const results = useSearchSets(search)
  const navigate = useNavigate()
  const found = results.data?.sets ?? []

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setOpen(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  function onOpenChange(next: boolean) {
    setOpen(next)
    if (!next) setInput('')
  }

  const status =
    search === ''
      ? ''
      : results.isError
        ? errorMessage(results.error)
        : results.data
          ? pluralize(results.data.total, 'résultat')
          : 'Recherche…'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="text-muted-foreground"
          aria-keyshortcuts="Control+K Meta+K"
        >
          <SearchIcon />
          <span className="sr-only sm:not-sr-only">Rechercher</span>
          <kbd className="hidden rounded border px-1 font-sans text-[0.7rem] md:inline">Ctrl K</kbd>
        </Button>
      </DialogTrigger>
      <DialogContent
        className="top-[12%] translate-y-0 gap-4 sm:max-w-lg"
        aria-describedby={undefined}
      >
        <DialogTitle>Rechercher dans mes sets</DialogTitle>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            const [first] = found
            if (!first) return
            onOpenChange(false)
            navigate(`/sets/${first.id}`)
          }}
        >
          <label htmlFor="global-search" className="sr-only">
            Titre, description, tag ou contenu d'une carte
          </label>
          <Input
            id="global-search"
            type="search"
            autoComplete="off"
            placeholder="Titre, description, tag ou contenu d'une carte…"
            maxLength={LIMITS.search}
            value={input}
            onChange={(event) => setInput(event.target.value)}
          />
        </form>
        <p aria-live="polite" className="sr-only">
          {status}
        </p>
        {search === '' ? (
          <p className="text-muted-foreground">
            Entrée ouvre le premier résultat. Accents pris en compte, casse ignorée.
          </p>
        ) : results.isError ? (
          <p className="text-destructive">{status}</p>
        ) : !results.data ? (
          <p className="text-muted-foreground">Recherche…</p>
        ) : found.length === 0 ? (
          <p className="text-muted-foreground">Aucun set ne correspond à « {search} ».</p>
        ) : (
          <ul
            aria-label="Résultats"
            aria-busy={results.isFetching}
            className="-mx-2 max-h-[50vh] overflow-y-auto aria-busy:opacity-60"
          >
            {found.map((set) => (
              <li key={set.id}>
                <Link
                  to={`/sets/${set.id}`}
                  onClick={() => onOpenChange(false)}
                  className="block rounded-lg px-2 py-2 outline-none hover:bg-accent focus-visible:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <span className="block truncate font-medium">{set.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {pluralize(set.cardCount, 'carte')}
                    {set.tags.map((tag) => ` · #${tag.name}`).join('')}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  )
}
