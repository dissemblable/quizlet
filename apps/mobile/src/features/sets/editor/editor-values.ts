import {
  newSetFormValues,
  type SetFormOutput,
  type SetFormValues,
  setToFormValues,
} from '@quizlet/shared'
import type { Control } from 'react-hook-form'

type EditableSet = Parameters<typeof setToFormValues>[0]

/** `Control` du formulaire du set (valeurs saisies → valeurs validées par `setFormSchema`). */
export type EditorControl = Control<SetFormValues, unknown, SetFormOutput>

/**
 * Valeurs de départ du formulaire : set vide (privé, 3 cartes vides) à la création, sinon le set
 * avec les `cardId` de ses cartes (ils conservent la progression de révision à l'enregistrement).
 */
export function editorInitialValues(set?: EditableSet): SetFormValues {
  return set ? setToFormValues(set) : newSetFormValues()
}
