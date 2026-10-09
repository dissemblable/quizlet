import { PlusIcon } from 'lucide-react'
import { Link, NavLink } from 'react-router'
import { Button } from '@/components/ui/button'
import { APP_NAME } from '@/config'
import { ThemeToggle } from './ThemeToggle'
import { UserMenu } from './UserMenu'

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur supports-backdrop-filter:bg-background/70">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-3 px-4">
        <Link
          to="/"
          className="flex items-center gap-2 rounded-md font-semibold tracking-tight outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <img src="/favicon.svg" alt="" className="size-6" />
          {APP_NAME}
        </Link>
        <nav aria-label="Navigation principale" className="ml-2 hidden sm:block">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `rounded-md px-2 py-1 text-sm outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 ${
                isActive
                  ? 'font-medium text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`
            }
          >
            Bibliothèque
          </NavLink>
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <Button asChild size="sm" className="mr-1">
            <Link to="/sets/new">
              <PlusIcon />
              <span className="sr-only sm:not-sr-only">Nouveau set</span>
            </Link>
          </Button>
          <ThemeToggle />
          <UserMenu />
        </div>
      </div>
    </header>
  )
}
