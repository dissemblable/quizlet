import { createBrowserRouter } from 'react-router'
import { AppLayout } from '@/components/layout/AppLayout'
import { LoadingState } from '@/components/states'
import { LibraryPage } from '@/pages/LibraryPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { RouteErrorPage } from '@/pages/RouteErrorPage'

// La bibliothèque (page d'accueil) est incluse dans le bundle principal ; les autres pages sont
// chargées à la demande pour alléger le premier chargement.
export const router = createBrowserRouter([
  {
    Component: AppLayout,
    ErrorBoundary: RouteErrorPage,
    HydrateFallback: () => (
      <main className="mx-auto w-full max-w-5xl px-4 py-10">
        <LoadingState />
      </main>
    ),
    children: [
      { index: true, Component: LibraryPage },
      {
        path: 'sets/new',
        lazy: async () => ({ Component: (await import('@/pages/SetEditorPage')).NewSetPage }),
      },
      {
        path: 'sets/:id',
        lazy: async () => ({ Component: (await import('@/pages/SetPage')).SetPage }),
      },
      {
        path: 'sets/:id/edit',
        lazy: async () => ({ Component: (await import('@/pages/SetEditorPage')).EditSetPage }),
      },
      {
        path: 'import',
        lazy: async () => ({ Component: (await import('@/pages/ImportPage')).ImportPage }),
      },
      {
        path: 'sets/:id/import',
        lazy: async () => ({ Component: (await import('@/pages/ImportPage')).ImportPage }),
      },
      {
        path: 'sets/:id/flashcards',
        lazy: async () => ({ Component: (await import('@/pages/FlashcardsPage')).FlashcardsPage }),
      },
      {
        path: 'sets/:id/quiz',
        lazy: async () => ({ Component: (await import('@/pages/QuizPage')).QuizPage }),
      },
      {
        path: 'sets/:id/write',
        lazy: async () => ({ Component: (await import('@/pages/WritePage')).WritePage }),
      },
      {
        path: 'review',
        lazy: async () => ({ Component: (await import('@/pages/ReviewPage')).ReviewPage }),
      },
      {
        path: 'sets/:id/review',
        lazy: async () => ({ Component: (await import('@/pages/ReviewPage')).ReviewPage }),
      },
      {
        path: 'settings',
        lazy: async () => ({ Component: (await import('@/pages/SettingsPage')).SettingsPage }),
      },
      { path: '*', Component: NotFoundPage },
    ],
  },
])
