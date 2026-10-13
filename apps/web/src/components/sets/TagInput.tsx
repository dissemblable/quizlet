import { LIMITS } from '@quizlet/shared'
import { XIcon } from 'lucide-react'
import { useId, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface TagInputProps {
  id: string
  value: string[]
  onChange: (tags: string[]) => void
  /** Mes tags existants, proposés à la saisie. */
  suggestions: string[]
}

/** Tags d'un set : Entrée, virgule ou sortie du champ ajoutent le tag saisi. */
export function TagInput({ id, value, onChange, suggestions }: TagInputProps) {
  const [draft, setDraft] = useState('')
  const listId = useId()
  const full = value.length >= LIMITS.tagsPerSet
  const has = (name: string) => value.some((tag) => tag.toLowerCase() === name.toLowerCase())

  function add() {
    const name = draft.trim()
    setDraft('')
    if (name && !has(name) && !full) onChange([...value, name])
  }

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <ul aria-label="Tags du set" className="flex flex-wrap gap-1">
          {value.map((tag) => (
            <li key={tag}>
              <Badge variant="secondary" className="h-6 gap-0.5 pr-0.5">
                #{tag}
                <button
                  type="button"
                  aria-label={`Retirer le tag ${tag}`}
                  className="rounded-full p-0.5 outline-none hover:bg-foreground/10 focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => onChange(value.filter((item) => item !== tag))}
                >
                  <XIcon />
                </button>
              </Badge>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <Input
          id={id}
          list={listId}
          value={draft}
          maxLength={LIMITS.tagName}
          disabled={full}
          autoComplete="off"
          placeholder={full ? `${LIMITS.tagsPerSet} tags au maximum` : 'Ex. : vocabulaire'}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={add}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' && event.key !== ',') return
            event.preventDefault() // pas d'envoi du formulaire, pas de virgule dans le tag
            add()
          }}
        />
        <Button type="button" variant="outline" onClick={add} disabled={full || !draft.trim()}>
          Ajouter
        </Button>
      </div>
      <datalist id={listId}>
        {suggestions
          .filter((name) => !has(name))
          .map((name) => (
            <option key={name} value={name} />
          ))}
      </datalist>
    </div>
  )
}
