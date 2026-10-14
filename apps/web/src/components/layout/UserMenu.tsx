import { LogOutIcon, SettingsIcon } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { initials } from '@/lib/format'
import { useMe } from '@/lib/queries'

export function UserMenu() {
  const { data } = useMe()
  if (!data) return <Skeleton className="size-9 rounded-full" />

  const { user, logoutUrl } = data
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="gap-2 px-1.5"
          aria-label={`Compte de ${user.displayName}`}
        >
          <span
            aria-hidden="true"
            className="flex size-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
          >
            {initials(user.displayName)}
          </span>
          <span className="hidden max-w-40 truncate sm:inline">{user.displayName}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-medium text-foreground">{user.displayName}</p>
          {user.email && <p className="truncate text-xs text-muted-foreground">{user.email}</p>}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/settings">
            <SettingsIcon />
            Paramètres
          </Link>
        </DropdownMenuItem>
        {logoutUrl ? (
          <DropdownMenuItem asChild>
            <a href={logoutUrl}>
              <LogOutIcon />
              Se déconnecter
            </a>
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem disabled>
            <LogOutIcon />
            Déconnexion indisponible en local
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
