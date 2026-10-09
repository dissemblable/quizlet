import { LibraryIcon } from 'lucide-react'
import { EmptyState } from '@/components/states'
import { pageTitle } from '@/config'

export function LibraryPage() {
  return (
    <>
      <title>{pageTitle('Bibliothèque')}</title>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Ma bibliothèque</h1>
      <EmptyState
        icon={<LibraryIcon />}
        title="Aucun set pour l'instant"
        description="Vos sets de cartes apparaîtront ici."
      />
    </>
  )
}
