/**
 * CONTRAT : mémorise le propriétaire du cache hors ligne (`quizlet.offline.owner.v1`). Si
 * `userId` diffère du propriétaire stocké, purge d'abord le cache et la file de notes. Appelé par
 * `AppGate` avec `useMe().data?.id` (`undefined` tant que /api/me n'a pas répondu).
 */
export function useTrackUser(_userId: string | undefined): void {}

/**
 * CONTRAT : préchauffe les données de révision en ligne (file « all », résumé, détails des sets
 * dus) pour qu'une séance hors ligne soit possible. Ne fait rien hors ligne, ni si la file de
 * notes en attente n'est pas vide. Appelé par `AppGate`.
 */
export function usePrefetchReviewData(): void {}
