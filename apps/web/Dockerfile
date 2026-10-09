# syntax=docker/dockerfile:1
# Image du front (build statique servi par nginx), construite depuis la racine du monorepo :
#   docker build -f apps/web/Dockerfile .

FROM node:24-alpine AS build
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /repo

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
# Manifeste requis par le lockfile (le front n'importe que des types de l'API, effacés au build).
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --filter @quizlet/web...

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN pnpm --filter @quizlet/web build

# nginx sans privilèges (utilisateur non root, écoute sur 8080).
FROM nginxinc/nginx-unprivileged:1.29-alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
