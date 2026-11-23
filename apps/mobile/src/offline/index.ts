/**
 * CONTRAT : barrel du hors-ligne. IMPUR (il ré-exporte des `.tsx`) : les modules purs et les tests
 * importent le fichier précis (`@/offline/types`, `@/offline/constants`…), jamais ce barrel.
 * `@tanstack/query-core` n'est pas résolvable depuis `apps/mobile` : importer `QueryClient`,
 * `onlineManager`, `dehydrate`… depuis `@tanstack/react-query` (qui les ré-exporte).
 */
export { AppQueryProvider } from './AppQueryProvider'
export { OFFLINE_WRITE_MESSAGE } from './constants'
export { OfflineBanner } from './OfflineBanner'
export { purgeUserData } from './purge'
export { getQueryClient } from './query-client'
export type { GradeApi, GradeOutcome, OfflineStatus } from './types'
export { useEffectiveCards, useEffectiveSummary } from './use-effective'
export { useGrade } from './use-grade'
export { useIsOnline, useOfflineStatus, useOnlineGuard } from './use-online'
export { usePrefetchReviewData, useTrackUser } from './use-track-user'
