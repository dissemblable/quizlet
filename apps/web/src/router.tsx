import { createBrowserRouter } from 'react-router'
import { AppLayout } from '@/components/layout/AppLayout'
import { LibraryPage } from '@/pages/LibraryPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { RouteErrorPage } from '@/pages/RouteErrorPage'
import { EditSetPage, NewSetPage } from '@/pages/SetEditorPage'
import { SetPage } from '@/pages/SetPage'

export const router = createBrowserRouter([
  {
    Component: AppLayout,
    ErrorBoundary: RouteErrorPage,
    children: [
      { index: true, Component: LibraryPage },
      { path: 'sets/new', Component: NewSetPage },
      { path: 'sets/:id', Component: SetPage },
      { path: 'sets/:id/edit', Component: EditSetPage },
      { path: '*', Component: NotFoundPage },
    ],
  },
])
