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
pnpm install
pnpm dev                       # front :5180 + API :3000
pnpm typecheck && pnpm lint && pnpm test   # à lancer avant chaque commit
pnpm build
```

## Règles de sécurité (SSO)

- Ne **jamais** versionner `sso-*.md` (documentation d'infrastructure, ignorée par git et Docker),
  ni aucun secret ou identifiant réel. Les exemples utilisent `demo`, `alice` et `bob`.
