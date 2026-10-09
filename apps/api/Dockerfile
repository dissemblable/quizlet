# syntax=docker/dockerfile:1
# Image de l'API, construite depuis la racine du monorepo :
#   docker build -f apps/api/Dockerfile .
# Images de base multi-architectures : le build fonctionne nativement sur le serveur ARM64.

FROM node:24-alpine AS build
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /repo

# Dépendances d'abord (couche mise en cache tant que les manifestes ne changent pas).
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --filter @quizlet/api...

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @quizlet/api build

# Exécution : un bundle autonome (dépendances incluses par tsdown) et les migrations SQL.
FROM node:24-alpine
# NODE_ENV figé à production : le mode DEV_AUTH_* est alors refusé au démarrage.
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    MIGRATIONS_DIR=/app/drizzle
WORKDIR /app
COPY --from=build --chown=node:node /repo/apps/api/dist ./dist
COPY --from=build --chown=node:node /repo/apps/api/drizzle ./drizzle
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "--enable-source-maps", "dist/index.mjs"]
