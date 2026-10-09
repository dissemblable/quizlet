# Quizlet

Application de flashcards auto-hébergée, inspirée de Quizlet, qui tourne derrière le SSO Authelia existant.
Elle n'a pas de comptes propres : l'identité vient du reverse proxy.

> Ce README est complété à chaque étape du projet.

## Prérequis

- Node.js 24 (voir `.nvmrc`)
- pnpm 10 (`corepack enable`, ou une installation globale)
- Docker, pour PostgreSQL en local

## Démarrage rapide

```bash
docker compose up -d db     # PostgreSQL 17 sur 127.0.0.1:5433 (bases quizlet et quizlet_test)
pnpm install
pnpm db:migrate             # applique les migrations versionnées (apps/api/drizzle)
pnpm db:seed                # facultatif : utilisateur « demo » et 3 sets d'exemple
pnpm dev                    # front sur http://localhost:5180, API sur http://127.0.0.1:3000
```

Aucun fichier d'environnement n'est à copier : les valeurs de développement (sans secret) sont
versionnées dans `apps/api/.env.development`.

## Structure du monorepo

```
apps/
  api/        API Hono (Node, @hono/node-server), Drizzle ORM, migrations dans drizzle/
  web/        Front Vite + React + Tailwind CSS + shadcn/ui
packages/
  shared/     Schémas Zod et utilitaires partagés entre le front et l'API
docker/       Script d'initialisation du Postgres de dev
```

- **pnpm workspaces** et **Turborepo** orchestrent `dev`, `build`, `lint`, `typecheck` et `test`.
- **TypeScript strict** partout. La config de base est `tsconfig.base.json`.
- Le front appelle l'API avec le client RPC de Hono (`hc<AppType>`). Le type `AppType` est importé
  directement depuis `@quizlet/api`, sans aucune duplication de types.

## Scripts (à la racine)

| Script | Rôle |
|---|---|
| `pnpm dev` | Lance le front et l'API en mode watch |
| `pnpm build` | Bundle de l'API (tsdown) et build statique du front (Vite) |
| `pnpm lint` | Biome : lint et vérification du formatage |
| `pnpm format` | Biome : formatage et corrections automatiques |
| `pnpm typecheck` | `tsc --noEmit` dans chaque package |
| `pnpm test` | Vitest dans chaque package (l'API a besoin du Postgres de dev) |
| `pnpm db:generate` | Génère une migration SQL à partir de `apps/api/src/db/schema.ts` |
| `pnpm db:migrate` | Applique les migrations en attente |
| `pnpm db:seed` | Recrée l'utilisateur de démo et ses sets (refusé si `NODE_ENV=production`) |

## Base de données

- PostgreSQL 17 avec **Drizzle ORM** (driver `postgres`). Toutes les requêtes passent par Drizzle :
  aucune requête SQL n'est construite par concaténation.
- Le schéma est dans `apps/api/src/db/schema.ts`. Pour le faire évoluer : modifier le schéma, lancer
  `pnpm db:generate`, relire le SQL généré dans `apps/api/drizzle/`, puis le committer.
- Les migrations sont appliquées par `pnpm db:migrate`, ou au démarrage de l'API si
  `MIGRATE_ON_START=true` (c'est le cas en production).
- Les tests de l'API tournent contre la vraie base `quizlet_test`. Elle est créée automatiquement si
  besoin, ses tables sont vidées avant chaque test, et les fichiers de test s'exécutent en série.
  Par sécurité, les tests refusent toute base dont le nom ne finit pas par `_test`.

| Table | Contenu |
|---|---|
| `users` | Utilisateurs vus par le SSO. `username` (= `Remote-User`) est l'identifiant stable |
| `sets` | Sets de cartes : titre, description, visibilité (`private` / `public`), propriétaire |
| `cards` | Cartes d'un set : terme, définition, position |

Les identifiants sont des UUID. Supprimer un utilisateur ou un set supprime ce qui en dépend.

## API

Toutes les routes sont sous `/api`, en JSON. Les erreurs ont la forme
`{ "error": { "code": "NOT_FOUND", "message": "Set introuvable." } }`, avec des messages en français.

| Route | Accès |
|---|---|
| `GET /health` | Sans identité (healthcheck Docker) |
| `GET /me` | Utilisateur courant et `logoutUrl` |
| `GET /sets?q=` | Ma bibliothèque : mes sets et leur nombre de cartes, recherche sur le titre |
| `POST /sets` | Crée un set (titre, description, visibilité, cartes ordonnées) |
| `GET /sets/:id` | Auteur, ou n'importe quel utilisateur si le set est public |
| `PUT /sets/:id` | Auteur seul : remplace métadonnées et cartes en une transaction |
| `DELETE /sets/:id` | Auteur seul |
| `POST /sets/:id/duplicate` | Quiconque peut lire le set : crée une copie privée « … (copie) » |
| `GET /sets/:id/quiz` | Quiconque peut lire le set : un QCM par carte (422 s'il a moins de 4 définitions différentes) |

Règles d'accès, vérifiées côté serveur dans `apps/api/src/services/sets.ts` :

- Un set privé est **introuvable (404)** pour tout autre utilisateur que son auteur. On répond 404
  plutôt que 403 pour ne pas révéler qu'il existe.
- Un set public est lisible et duplicable par tout utilisateur authentifié. Le modifier ou le
  supprimer est **interdit (403)** à tout autre que son auteur.
- `PUT` conserve l'identifiant des cartes qui appartiennent déjà au set. Un identifiant inconnu,
  ou celui d'une carte d'un autre set, est ignoré : la carte est créée comme nouvelle. Une carte
  d'un autre set n'est donc jamais modifiée.

Choix simple : le CRUD des cartes passe par l'éditeur du set (une page, un enregistrement atomique)
plutôt que par une route par carte. Cela réduit la surface où vérifier les permissions.

## Variables d'environnement (API)

Elles sont validées par Zod au démarrage. Une variable vide (`FOO=`) est considérée comme absente.

| Variable | Défaut | Rôle |
|---|---|---|
| `NODE_ENV` | `production` | `development`, `test` ou `production` |
| `HOST` | `127.0.0.1` | Adresse d'écoute (loopback par défaut) |
| `PORT` | `3000` | Port d'écoute |
| `DATABASE_URL` | requis | URL `postgres://…` |
| `MIGRATE_ON_START` | `false` | Applique les migrations au démarrage |
| `MIGRATIONS_DIR` | `./drizzle` | Dossier des migrations SQL |
| `TRUSTED_PROXIES` | requis en prod (`127.0.0.1,::1` sinon) | IP, CIDR ou noms d'hôte autorisés à transmettre `Remote-*` |
| `APP_ORIGIN` | requis en prod (`http://localhost:5180` sinon) | Origine publique de l'app, pour le contrôle CSRF |
| `AUTH_LOGOUT_URL` | requis en prod | URL de déconnexion d'Authelia |
| `CORS_ORIGINS` | vide | Origines autorisées en CORS (aucune par défaut) |
| `DEV_AUTH_USER` | – | Active l'identité factice de dev. **Interdit en production** |
| `DEV_AUTH_NAME`, `DEV_AUTH_EMAIL`, `DEV_AUTH_GROUPS` | – | Détails de l'identité factice |
| `TEST_DATABASE_URL` | `…/quizlet_test` | Base utilisée par les tests |

En local, les scripts pnpm chargent `apps/api/.env.development` (versionné), puis `apps/api/.env`
s'il existe (ignoré par git, pour les surcharges locales). Les variables du shell priment toujours.

## Authentification (SSO Authelia)

L'application n'a ni inscription, ni mot de passe, ni page de connexion. En production :

```
Navigateur → Cloudflare → cloudflared → nginx ──auth_request──▶ Authelia
                                          │ 200 : nginx ajoute Remote-User / Remote-Name /
                                          │       Remote-Email / Remote-Groups
                                          ▼
                              quizlet-web (front) et quizlet-api (/api)
```

- À chaque requête, l'API vérifie d'abord que le **pair TCP** est un proxy de confiance
  (`TRUSTED_PROXIES`). L'en-tête `X-Forwarded-For`, contrôlable par le client, n'est jamais
  utilisé. Une requête venue d'ailleurs est refusée (403 `UNTRUSTED_PROXY`), même si elle porte des
  en-têtes `Remote-*`.
- `TRUSTED_PROXIES` accepte des IP, des CIDR et des **noms d'hôte**. Le nginx du stack SSO n'a pas
  d'IP fixe sur le réseau Docker `web` (elle change à chaque recréation du conteneur) : en
  production on utilise `TRUSTED_PROXIES=nginx`, résolu par le DNS Docker et mis en cache 5 s
  seulement : après recréation de nginx, son ancienne IP ne reste pas de confiance longtemps. Si la
  résolution échoue, aucune adresse n'est acceptée (*fail-closed*).
- `Remote-User` est l'identifiant stable. Sans lui (ou s'il est invalide), l'API répond 401.
  L'utilisateur est créé à sa première requête, puis son email et son nom sont mis à jour s'ils
  changent dans Authelia (*upsert*, avec un petit cache mémoire de 5 min). `Remote-Name` est décodé
  en UTF-8, et `Remote-Groups` est lu mais n'est pas stocké.
- Côté nginx, le vhost **écrase** ces en-têtes avec `proxy_set_header` : un client ne peut pas les
  forger. L'API n'est jamais exposée directement (aucun `ports:` en production).
- Le cookie Authelia (SameSite=Lax) est posé sur le domaine parent, donc il accompagne aussi les
  requêtes venues d'un autre sous-domaine. L'API refuse toute méthode non sûre qui ne vient pas de
  sa propre origine (`Sec-Fetch-Site`, avec repli sur `Origin` = `APP_ORIGIN`). Le CORS est
  désactivé par défaut.
- Quand la session Authelia expire, nginx répond aux appels d'API par un 302 vers le portail. Le
  front ne suit pas cette redirection : il affiche « Session expirée » avec un bouton
  « Se reconnecter », qui recharge la page et relance le parcours de connexion.
- Le bouton « Se déconnecter » du menu utilisateur redirige vers `AUTH_LOGOUT_URL`, fournie par
  `GET /api/me` : la changer ne demande pas de rebuild.

### Mode de développement

Authelia n'existe pas en local. `DEV_AUTH_USER` (par défaut `demo` dans `.env.development`) injecte
une identité de test et ignore les en-têtes reçus. Ce mode est verrouillé :

- l'API **refuse de démarrer** si une variable `DEV_AUTH_*` est définie avec `NODE_ENV=production`
  (valeur par défaut de `NODE_ENV`, et valeur figée dans l'image Docker) ;
- il exige une écoute en loopback (`HOST=127.0.0.1`, `::1` ou `localhost`).

Pour tester le mode « en-têtes du proxy » en local, mettre `DEV_AUTH_USER=` (vide) dans
`apps/api/.env`, puis :

```bash
curl -H "Remote-User: alice" -H "Remote-Name: Alice" http://127.0.0.1:3000/api/me   # 200
```

Hors production, `TRUSTED_PROXIES` vaut par défaut `127.0.0.1,::1`.

## Déploiement (serveur derrière Authelia)

L'app s'ajoute au stack SSO existant comme n'importe quelle application (§11 de la documentation
du stack) : des conteneurs sur le réseau Docker `web`, **sans `ports:`**, et un vhost nginx. Rien à
changer côté Cloudflare (DNS wildcard et ingress attrape-tout) ni côté Authelia (la règle
`*.valldoy.com` couvre déjà le sous-domaine).

| Conteneur | Image | Réseaux | Rôle |
|---|---|---|---|
| `quizlet-web` | nginx sans privilèges, port 8080 | `web` | Front statique (SPA) |
| `quizlet-api` | Node 24, port 3000 | `web`, `quizlet-internal` | API Hono |
| `quizlet-db` | PostgreSQL 17, volume `quizlet-pgdata` | `quizlet-internal` (`internal: true`) | Base de données |

L'API et le front tournent en lecture seule (`read_only`), sans capacités Linux et avec
`no-new-privileges`. Les images de base sont multi-architectures : le build se fait nativement sur
le serveur ARM64.

### Installation

```bash
cd /opt/stack/apps
git clone <dépôt> quizlet && cd quizlet
cp .env.example .env && chmod 600 .env
# Dans .env : POSTGRES_PASSWORD=$(openssl rand -hex 32), et vérifier APP_ORIGIN / AUTH_LOGOUT_URL
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps        # les trois services en « healthy »
```

Les migrations sont appliquées au démarrage de l'API (`MIGRATE_ON_START=true`). Pour les lancer
à la main :

```bash
docker compose -f docker-compose.prod.yml run --rm quizlet-api node dist/migrate.mjs
```

Mise à jour : `git pull && docker compose -f docker-compose.prod.yml up -d --build`.

### Vhost nginx (`/opt/stack/nginx/sites/quizlet.conf`)

À créer à la main, sur le modèle de `whoami.conf`. Les snippets Authelia du stack sont inclus dans
chaque `location` : leurs `proxy_set_header Remote-*` écrasent toute valeur envoyée par le client.

```nginx
server {
    listen 80;
    server_name quizlet.valldoy.com;

    include /etc/nginx/snippets/authelia-location.conf;

    # API : reçoit l'identité Authelia (Remote-User, Remote-Name, Remote-Email, Remote-Groups).
    location /api/ {
        include /etc/nginx/snippets/authelia-authrequest.conf;

        set $upstream_quizlet_api http://quizlet-api:3000;
        proxy_pass $upstream_quizlet_api;
        include /etc/nginx/snippets/proxy.conf;
    }

    # Front statique, protégé lui aussi : un visiteur non connecté part vers le portail.
    location / {
        include /etc/nginx/snippets/authelia-authrequest.conf;

        set $upstream_quizlet_web http://quizlet-web:8080;
        proxy_pass $upstream_quizlet_web;
        include /etc/nginx/snippets/proxy.conf;
    }
}
```

```bash
docker exec nginx nginx -t && docker exec nginx nginx -s reload
```

- `proxy_pass` en variable, comme dans le reste du stack : nginx démarre même si l'app est arrêtée.
- L'API se fie au pair TCP (le conteneur `nginx`, cf. `TRUSTED_PROXIES=nginx`) et ignore
  `X-Forwarded-For` : le `$proxy_add_x_forwarded_for` de `proxy.conf` ne pose pas de problème.
- La limite de taille de nginx par défaut (`client_max_body_size 1m`) correspond à celle de l'API.

### Règle Authelia (facultative)

Aucune règle n'est nécessaire : `*.valldoy.com` en `two_factor` couvre déjà l'app. Pour la
**réserver à un groupe**, ajouter deux règles **avant** la règle générale. Authelia applique la
première règle dont tous les critères correspondent : sans la règle `deny`, un utilisateur hors du
groupe retomberait sur la règle `*.valldoy.com` et serait admis.

```yaml
access_control:
  default_policy: 'deny'
  rules:
    - domain: 'quizlet.valldoy.com'
      policy: 'two_factor'
      subject: 'group:users'
    - domain: 'quizlet.valldoy.com'
      policy: 'deny'
    - domain: ['valldoy.com', '*.valldoy.com']
      policy: 'two_factor'
```

### Validation

| # | Test | Résultat attendu |
|---|---|---|
| 1 | `docker compose -f docker-compose.prod.yml ps` | trois services `healthy`, colonne PORTS sans publication sur l'hôte |
| 2 | `curl -I https://quizlet.valldoy.com/` | 302 vers `https://auth.valldoy.com/?rd=…` |
| 3 | Idem avec `-H 'Remote-User: admin'`, sur `/` et `/api/me` | toujours 302, jamais 200 |
| 4 | Connexion dans le navigateur | la bibliothèque s'affiche, avec votre nom dans l'en-tête |
| 5 | `docker run --rm --network web curlimages/curl -s -H 'Remote-User: admin' http://quizlet-api:3000/api/me` | 403 `UNTRUSTED_PROXY` : seul le conteneur `nginx` est cru |
| 6 | `docker compose up -d --force-recreate --no-deps nginx` (dans `/opt/stack`), puis recharger l'app | l'app fonctionne toujours (la confiance suit l'IP du conteneur `nginx`) |
| 7 | Menu utilisateur → « Se déconnecter » | redirection vers le portail Authelia, session fermée |

Les tests 1, 5 et 6 ont été rejoués en local avec un nginx factice nommé `nginx`, qui injectait une
identité (sans Authelia). Après recréation de ce nginx, un autre conteneur récupérait son ancienne
IP : le nouveau nginx restait accepté, le conteneur qui avait récupéré l'ancienne IP était refusé.
Le test 6 redémarre le nginx du stack, donc toutes les apps quelques secondes : il est facultatif.

### Sauvegarde

La base vit dans le volume `quizlet_quizlet-pgdata`. À ajouter à la sauvegarde hors VPS du stack :

```bash
docker exec quizlet-db pg_dump -U quizlet quizlet | gzip > quizlet-$(date +%F).sql.gz
```

### Piste : accès anonyme aux sets publics (hors V1)

C'est faisable avec une règle Authelia `policy: 'bypass'` limitée par `resources` (par exemple
`'^/api/public/'` et les routes du front), placée avant la règle générale. Il faudrait aussi
servir sans identité les assets du front et ajouter côté API des routes publiques en lecture
seule : sur ces chemins, nginx ne transmet plus de `Remote-User`.

## Ports en local

| Service | Adresse |
|---|---|
| Front (Vite) | http://localhost:5180 (`strictPort`) |
| API | http://127.0.0.1:3000 (loopback uniquement) |
| PostgreSQL | 127.0.0.1:5433 |

Le front et l'API restent sur la même origine : Vite renvoie `/api` vers l'API, comme le fera nginx
en production.

## Choix techniques notés en cours de route

- `NODE_ENV` vaut `production` par défaut : une configuration oubliée ne peut pas activer un
  comportement de développement.
- Le fichier `docker-compose.yml` sert uniquement au développement local. Il publie Postgres sur
  `127.0.0.1` seulement et ne doit jamais tourner sur le serveur.
- Éditeur de set : les cartes se réordonnent avec des boutons ↑/↓ (accessibles au clavier) plutôt
  que par glisser-déposer. Les lignes entièrement vides sont ignorées à l'enregistrement, et quitter
  la page avec des modifications non enregistrées demande confirmation.
- Un set dupliqué est toujours privé, quelle que soit la visibilité de l'original.
- Flashcards : la session (position, « Je sais » / « À revoir ») vit en mémoire, dans la page.
  Rien n'est enregistré, la répétition espacée étant hors périmètre. Activer ou désactiver le
  mélange relance la session. Marquer une carte passe à la suivante. Raccourcis : Espace pour
  retourner la carte, ← et → pour naviguer (désactivés pendant une saisie ; sur un bouton, Espace
  active le bouton).
- Quiz : généré par l'API, une question par carte et dans un ordre aléatoire. Chaque question
  propose la bonne définition et trois distracteurs tirés des autres cartes. Les définitions
  identiques à la casse et aux espaces près ne comptent qu'une fois, d'où le minimum de 4
  définitions *différentes*. La réponse attendue (`answerIndex`) est envoyée avec les questions et
  le score est calculé dans le navigateur : c'est un outil de révision personnelle, pas un examen.
  Chaque « Nouveau quiz » demande un nouveau tirage. Raccourcis : touches 1 à 4.
- Bibliothèque : la recherche porte sur le titre, sans tenir compte de la casse (`ILIKE`, jokers
  `%` et `_` échappés), mais en tenant compte des accents. La bibliothèque ne liste que ses propres
  sets : un set public d'un autre utilisateur s'ouvre par son lien et peut être dupliqué.
