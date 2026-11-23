import { CLAUDE_PROMPT } from '@quizlet/shared'
import { CopyIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

/** Prompt à copier dans Claude : sa réponse se colle ensuite dans le champ d'import. */
export function ClaudePrompt() {
  async function copy() {
    try {
      await navigator.clipboard.writeText(CLAUDE_PROMPT)
      toast.success('Prompt copié.')
    } catch {
      toast.error('Copie impossible : sélectionnez le texte à la main.')
    }
  }

  return (
    <details className="mb-8 rounded-xl border p-4">
      <summary className="cursor-pointer font-medium">Générer les cartes avec Claude</summary>
      <p className="mt-3 max-w-prose text-sm text-muted-foreground">
        Copiez ce prompt, collez-le dans Claude après avoir remplacé les repères entre crochets
        (ajoutez votre cours dans la même conversation si besoin), puis collez ci-dessous le bloc de
        code de sa réponse (la ligne « Titre : … » sert pour le titre du set).
      </p>
      <pre className="mt-3 max-h-80 overflow-auto rounded-lg bg-muted/50 p-3 text-xs whitespace-pre-wrap wrap-break-word">
        {CLAUDE_PROMPT}
      </pre>
      <Button type="button" variant="outline" size="sm" className="mt-3" onClick={copy}>
        <CopyIcon />
        Copier le prompt
      </Button>
    </details>
  )
}
