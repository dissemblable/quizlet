import { KeyboardIcon } from 'lucide-react'
import { Fragment, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useShortcuts } from '@/lib/use-shortcuts'

const SECTIONS: ReadonlyArray<{ title: string; keys: ReadonlyArray<[string, string]> }> = [
  {
    title: 'Partout',
    keys: [
      ['Ctrl K / ⌘ K', 'Rechercher dans mes sets'],
      ['?', 'Afficher cette aide'],
    ],
  },
  {
    title: 'Révision (répétition espacée)',
    keys: [
      ['Espace', 'Retourner la carte'],
      ['1 2 3 4', 'Noter : À revoir, Difficile, Bien, Facile'],
    ],
  },
  {
    title: 'Flashcards',
    keys: [
      ['Espace', 'Retourner la carte'],
      ['← →', 'Carte précédente ou suivante'],
    ],
  },
  {
    title: 'Quiz',
    keys: [
      ['1 2 3 4', 'Choisir une réponse'],
      ['Entrée', 'Question suivante'],
    ],
  },
  {
    title: 'Mode écrit',
    keys: [['Entrée', 'Valider la réponse, puis continuer']],
  },
  {
    title: 'Éditeur de set',
    keys: [['Entrée ou ,', 'Ajouter le tag saisi']],
  },
]

/** Aide des raccourcis clavier, ouverte par « ? » ou par le bouton de l'en-tête. */
export function ShortcutsDialog() {
  const [open, setOpen] = useState(false)
  useShortcuts({ '?': () => setOpen(true) })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="hidden sm:inline-flex"
          aria-label="Raccourcis clavier"
          aria-keyshortcuts="?"
        >
          <KeyboardIcon />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Raccourcis clavier</DialogTitle>
          <DialogDescription>
            Ils sont désactivés pendant la saisie d'un texte. Sur un bouton, Espace et Entrée
            activent le bouton.
          </DialogDescription>
        </DialogHeader>
        {SECTIONS.map((section) => (
          <section key={section.title} aria-label={section.title}>
            <h3 className="mb-2 text-sm font-medium">{section.title}</h3>
            <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-1.5 text-sm">
              {section.keys.map(([keys, action]) => (
                <Fragment key={keys}>
                  <dt>
                    <kbd className="rounded border bg-muted px-1.5 py-0.5 font-sans text-xs whitespace-nowrap">
                      {keys}
                    </kbd>
                  </dt>
                  <dd className="text-muted-foreground">{action}</dd>
                </Fragment>
              ))}
            </dl>
          </section>
        ))}
      </DialogContent>
    </Dialog>
  )
}
