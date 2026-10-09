# CLAUDE.md

Mémo pour les futures sessions sur ce dépôt. L'interface et la documentation sont en français.

## Architecture

- Monorepo pnpm + Turborepo :
  - `apps/api` : Hono sur Node ;
  - `apps/web` : Vite + React ;
  - `packages/shared` : schémas Zod et utilitaires.
- Le front importe `type AppType` depuis `@quizlet/api` (`exports.types` → `apps/api/src/app.ts`)
  et appelle l'API avec `hc<AppType>`. Les types ne sont jamais dupliqués à la main.
- `@quizlet/shared` est consommé en source TS. tsdown l'inclut dans le bundle de l'API pour la prod
  (bundle complet, image sans `node_modules`).

## Conventions

- TypeScript strict avec `noUncheckedIndexedAccess`. Biome interdit `any`.
- **Pas d'alias de chemins dans `apps/api`** (imports relatifs uniquement) : le front type-checke les
  sources de l'API via `AppType`. Le front, lui, utilise l'alias `@/` → `apps/web/src`.
- Style Biome : apostrophes simples, pas de point-virgule, virgules finales, 100 colonnes.
  Lancer `pnpm format` avant de committer.
- Commits en français, style conventionnel (`feat(scope): …`, `chore: …`).
- Les versions des outils sont récentes (TypeScript 7, Vite 8, Vitest 5, React Router 8,
  Turborepo 2.11) : en cas de doute, lire la doc embarquée dans `node_modules/<paquet>/docs`
  ou les `.d.ts` plutôt que de se fier à sa mémoire.

## Commandes

```bash
docker compose up -d db        # Postgres de dev sur 127.0.0.1:5433 (requis pour les tests API)
pnpm install
pnpm db:migrate && pnpm db:seed
pnpm dev                       # front :5180 + API :3000
pnpm typecheck && pnpm lint && pnpm test   # à lancer avant chaque commit
pnpm build
```

## Base de données

- Drizzle ORM avec `postgres` (postgres.js). Schéma dans `apps/api/src/db/schema.ts`.
- Pour changer le schéma : modifier `schema.ts`, lancer `pnpm db:generate`, relire le SQL dans
  `apps/api/drizzle/` et le committer. Ne jamais modifier une migration déjà committée.
- Toutes les requêtes passent par Drizzle (jamais de SQL concaténé).
- Tests d'API : vraie base `quizlet_test`. `useTestDb()` (`src/test/test-db.ts`) vide les tables
  avant chaque test ; les fichiers s'exécutent en série (`fileParallelism: false`).
- Config : `src/env.ts` (Zod). `NODE_ENV` vaut `production` par défaut. En dev, les scripts pnpm
  préchargent `load-dev-env.mjs`, qui lit `.env` puis `.env.development`.

## Front

- Appels d'API : `api` (`src/lib/api.ts`) + `unwrap()` (`src/lib/http.ts`), qui lève une `ApiError`
  avec un message français. Clés et hooks TanStack Query dans `src/lib/queries.ts`.
- `apiFetch` utilise `redirect: 'manual'` : une session Authelia expirée (302) devient
  `SESSION_EXPIRED` → bannière « Se reconnecter » (`src/lib/session.ts`).
- Thème : `src/lib/theme.tsx` + `public/theme-init.js` (script externe, compatible CSP).
  Ne pas réintroduire `next-themes` ni de script inline.
- Logique pure dans `src/lib/*.ts`, testée avec Vitest (environnement node). Titres de page avec
  `<title>{pageTitle('…')}</title>` (React 19).

## Règles de sécurité (SSO)

- Ne **jamais** versionner `sso-*.md` (documentation d'infrastructure, ignorée par git et Docker),
  ni aucun secret ou identifiant réel. Les exemples utilisent `demo`, `alice` et `bob`.
- Les en-têtes `Remote-*` ne valent que si le **pair TCP** est un proxy de confiance
  (`src/middleware/trusted-proxies.ts`). Ne jamais se fier à `X-Forwarded-For` / `X-Real-IP`.
- Toute nouvelle route passe après le middleware `identity` (dans `src/app.ts`). Seul `/api/health`
  est enregistré avant.
- Accès aux sets : toujours passer par `assertAccess` / `decideAccess` (`src/domain/permissions.ts`,
  `src/services/sets.ts`). Set invisible → 404 (jamais 403, pour ne pas révéler son existence) ;
  set public d'un autre → lecture seule, 403 en écriture. Toute requête sur les cartes filtre par
  `set_id`.
- Validation des entrées avec `validate()` (`src/validation.ts`) et les schémas de
  `@quizlet/shared` : mêmes règles que les formulaires du front.
- Le mode `DEV_AUTH_*` doit rester impossible en production : `NODE_ENV` vaut `production` par
  défaut, `parseConfig` refuse `DEV_AUTH_*` dans ce cas, et le Dockerfile fige `NODE_ENV=production`.
- La garde CSRF (`src/middleware/csrf.ts`) est indispensable : le cookie Authelia est partagé par
  tous les sous-domaines. CORS est fermé par défaut.
- Production : aucune section `ports:` dans `docker-compose.prod.yml`. L'API n'est joignable que
  via le réseau Docker `web` (par nginx) ; Postgres seulement via un réseau `internal`.
