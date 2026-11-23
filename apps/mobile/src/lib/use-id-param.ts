import { useLocalSearchParams } from 'expo-router'

/**
 * Paramètre `id` de la route courante (`sets/[id]/…`). Renvoie `''` s'il est absent (onglet
 * `/review` : `useIdParam() || undefined` donne « tous les sets »). Normalise un éventuel tableau.
 */
export function useIdParam(): string {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>()
  return (Array.isArray(id) ? id[0] : id) ?? ''
}
