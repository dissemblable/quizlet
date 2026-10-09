import { createBrowserRouter } from 'react-router'
import { AppLayout } from '@/components/layout/AppLayout'
import { LibraryPage } from '@/pages/LibraryPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { RouteErrorPage } from '@/pages/RouteErrorPage'

export const router = createBrowserRouter([
  {
    Component: AppLayout,
    ErrorBoundary: RouteErrorPage,
    children: [
      { index: true, Component: LibraryPage },
      { path: '*', Component: NotFoundPage },
    ],
  },
])
