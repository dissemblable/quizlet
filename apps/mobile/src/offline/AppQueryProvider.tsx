import { QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { getQueryClient } from './query-client'

/**
 * CONTRAT : fournit le `QueryClient` (`getQueryClient()`) avec persistance, suivi du réseau
 * (NetInfo → `onlineManager`), premier plan (AppState → `focusManager`) et reprise des notes en
 * attente. Version provisoire : un simple `QueryClientProvider`.
 */
export function AppQueryProvider({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={getQueryClient()}>{children}</QueryClientProvider>
}
