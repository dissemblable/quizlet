import type { HttpBindings } from '@hono/node-server'
import type { User } from './db/schema'

/** Environnement Hono de l'application : l'utilisateur authentifié est toujours présent après `identity`. */
export interface AppEnv {
  Bindings: HttpBindings
  Variables: {
    user: User
    groups: string[]
  }
}
