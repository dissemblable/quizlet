/**
 * Clés utilisées par le hors-ligne. Copie de `queryKeys` (`@/lib/queries`, module impur que les
 * modules purs ne peuvent pas importer) : `runtime-deps.ts` vérifie à la compilation qu'elles
 * restent identiques.
 */
export const ME_KEY = ['me'] as const
export const REVIEW_SUMMARY_KEY = ['review', 'summary'] as const
export const REVIEW_QUEUE_KEY = ['review', 'queue'] as const
export const reviewQueueKey = (setId?: string) => ['review', 'queue', setId ?? 'all'] as const
export const setDetailKey = (id: string) => ['sets', 'detail', id] as const

/** Mutation de note (une seule, persistée) et file d'exécution : les notes partent dans l'ordre. */
export const GRADE_MUTATION_KEY = ['review', 'grade'] as const
export const GRADE_SCOPE_ID = 'review-grade'
