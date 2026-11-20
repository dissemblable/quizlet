# Quizlet

Application de flashcards auto-hébergée, inspirée de Quizlet, qui tourne derrière le SSO Authelia
existant. Elle n'a ni inscription ni mot de passe : l'identité vient du reverse proxy (nginx +
Authelia, en forward-auth).

## Fonctionnalités

- **Identité SSO** : nom et email venus d'Authelia, affichés dans l'en-tête, avec déconnexion vers
  le portail Authelia.
- **Sets de cartes** : titre, description facultative, visibilité privée ou publique, tags. Un
  éditeur sur une seule page permet d'ajouter, modifier, supprimer et réordonner les cartes.
- **Bibliothèque** : mes sets et leur nombre de cartes, paginés, filtrés par dossier (« Tous »,
  « Sans dossier » ou un dossier) et par tags, avec recherche.
- **Répétition espacée** (V2) : « Révision du jour » (lien « Révision » avec compteur dans
  l'en-tête, bandeau sur l'accueil) et « Répétition espacée » sur chaque set. La carte se retourne
  avec Espace, et quatre notes (À revoir, Difficile, Bien, Facile, touches 1 à 4) affichent chacune
  l'intervalle prévu. Voir [Répétition espacée (FSRS)](#répétition-espacée-fsrs).
- **Paramètres** (V2, menu utilisateur) : nouvelles cartes par jour (20 par défaut), révisions par
  jour (200), fuseau horaire (`Europe/Paris` par défaut, puis celui du navigateur, enregistré
  automatiquement à la première visite) et rétention cible FSRS (0,9).
- **Recherche globale** (V2) : Ctrl+K (Cmd+K sur Mac) depuis n'importe quelle page cherche dans le
  titre, la description, les tags et le contenu des cartes de mes sets.
- **Import CSV / copier-coller** (V2) : depuis « Nouveau set » ou un set existant (« Importer des
  cartes »). Voir [Import de cartes](#import-de-cartes).
- **Mode écrit** (V2) : le terme (ou la définition, ou l'un ou l'autre au hasard) est affiché, on
  tape la réponse. Correction tolérante, bouton « J'avais raison » après une erreur, mélange en
  option, limitation possible aux cartes à revoir aujourd'hui (lues dans la planification FSRS,
  sans la modifier), et récapitulatif avec le score et les erreurs.
- **Dossiers et tags** (V2) : dossiers à plat (un seul niveau) créés, renommés et supprimés depuis
  la bibliothèque, où le menu de chaque set permet de le ranger. Tags propres à chaque utilisateur,
  créés à la volée dans l'éditeur (10 par set au plus) et supprimables depuis la bibliothèque.
  Supprimer un dossier ne supprime pas ses sets ; supprimer un tag le retire des sets.
- **Flashcards** : carte qui se retourne, précédent/suivant, mélange, raccourcis clavier, barre de
  progression, « Je sais » / « À revoir » et récapitulatif de fin.
- **Quiz** : questions à choix multiples générées à partir des cartes (la bonne définition et trois
  distracteurs), puis score final et erreurs à revoir.
- **Sets publics** : consultables et étudiables via leur lien par tout utilisateur authentifié,
  duplicables dans sa propre bibliothèque. Seul leur auteur peut les modifier.

Interface en français, responsive (pensée d'abord pour le mobile), thème clair ou sombre, et
navigation au clavier. La touche `?` (ou l'icône clavier de l'en-tête) affiche l'aide de tous les
raccourcis.

## Prérequis

- Node.js 24 (voir `.nvmrc`)
- pnpm 10 (`corepack enable`, ou une installation globale)
- Docker, pour PostgreSQL en local

## Démarrage rapide

```bash
docker compose up -d db     # PostgreSQL 17 sur 127.0.0.1:5433 (bases quizlet et quizlet_test)
pnpm install
pnpm db:migrate             # applique les migrations versionnées (apps/api/drizzle)
pnpm db:seed                # facultatif : « demo », 3 sets, dossiers, tags, révisions en cours
pnpm dev                    # front sur http://localhost:5180, API sur http://127.0.0.1:3000
```

Aucun fichier d'environnement n'est à copier : les valeurs de développement (sans secret) sont
versionnées dans `apps/api/.env.development`. En local, l'authentification est factice : vous êtes
l'utilisateur `demo` (« Utilisateur Démo »), le même que celui créé par `pnpm db:seed`.

## Structure du monorepo

```
apps/
  api/                      API Hono (Node, @hono/node-server)
    drizzle/                migrations SQL versionnées (générées par drizzle-kit)
    src/app.ts              assemblage des middlewares et routes, export du type AppType
    src/env.ts              configuration validée par Zod (refus de démarrer si invalide)
    src/middleware/         identité SSO, proxys de confiance, garde CSRF
    src/routes/             /api/me, /sets (CRUD, import, quiz…), /folders, /tags, /review, /settings,
                            /mobile (relais OAuth de l'app Android, routes/mobile.ts)
    src/services/           accès aux données et contrôles de propriété
    src/domain/             logique pure : permissions, génération du quiz, planification FSRS,
                            heure des notes (grading.ts)
    src/db/                 schéma Drizzle, client, migrations, seed
    Dockerfile
  web/                      Front Vite + React 19 + React Router + TanStack Query
    src/pages/              bibliothèque, set, éditeur, import, flashcards, quiz, mode écrit,
                            révision, paramètres
    src/components/         mise en page, composants métier, ui/ (shadcn/ui)
    src/lib/                client API, requêtes, logique pure (sessions, formulaires, mode
                            écrit, séance de révision), thème
    nginx.conf, Dockerfile  image statique de production
  mobile/                   App Android (Expo, React Native), en construction : voir
                            docs/app-mobile.md (conception et décisions)
packages/
  shared/                   schémas Zod, limites, messages, utilitaires (mélange, quiz, import CSV)
docker/                     initialisation du Postgres de dev, script de sauvegarde (backup/)
docker-compose.yml          Postgres de dev, et outil de sauvegarde local (profil tools)
docker-compose.prod.yml     production derrière Authelia, sauvegardes comprises
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
| `pnpm db:seed` | Recrée l'utilisateur de démo, ses dossiers, tags, sets et une progression de révision (refusé si `NODE_ENV=production`) |
| `pnpm db:backup` | Sauvegarde la base de dev dans `./backups` (même script qu'en production, via Docker) |
| `pnpm db:verify <fichier>` | Restaure une sauvegarde dans une base temporaire et l'inspecte |
| `pnpm db:restore <fichier>` | Remplace le contenu de la base de dev par la sauvegarde (confirmation demandée) |

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
| `sets` | Sets de cartes : titre, description, visibilité (`private` / `public`), propriétaire, dossier |
| `cards` | Cartes d'un set : terme, définition, position |
| `folders` | Dossiers d'un utilisateur, à plat (un seul niveau) |
| `tags`, `set_tags` | Tags d'un utilisateur (nom unique sans tenir compte de la casse) et leurs sets |
| `card_reviews` | Progression FSRS par utilisateur et par carte (échéance, stabilité, difficulté, état…) |
| `review_logs` | Historique des révisions, conservé pour de futures statistiques |
| `user_settings` | Paramètres de révision (fuseau horaire, limites quotidiennes, rétention cible) |

Les identifiants sont des UUID. Supprimer un utilisateur, un set ou une carte supprime ce qui en
dépend (progression comprise). Supprimer un dossier ne supprime pas ses sets : ils repassent
« sans dossier ».

Les migrations sont uniquement additives : `0001_v2` ajoute les tables de la V2 sans toucher aux
données de la V1, ce que vérifie `src/db/migrate.test.ts` (une base V1 avec des données, puis la
suite des migrations). Elle active aussi l'extension `pg_trgm`, qui indexe la recherche.

## API

Toutes les routes sont sous `/api`, en JSON. Les erreurs ont la forme
`{ "error": { "code": "NOT_FOUND", "message": "Set introuvable." } }`, avec des messages en français.

| Route | Accès |
|---|---|
| `GET /health` | Sans identité (healthcheck Docker) |
| `GET /me` | Utilisateur courant et `logoutUrl` |
| `GET /sets?q=&folder=&tags=&page=` | Ma bibliothèque, 24 sets par page : `{ sets, total, page, pageSize }`. `q` cherche dans le titre, la description, les tags et les cartes ; `folder` vaut un identifiant ou `none` ; `tags` liste des identifiants séparés par des virgules |
| `POST /sets` | Crée un set (titre, description, visibilité, cartes ordonnées, tags facultatifs) |
| `GET /sets/:id` | Auteur, ou n'importe quel utilisateur si le set est public |
| `PUT /sets/:id` | Auteur seul : remplace métadonnées et cartes en une transaction (tags remplacés s'ils sont fournis) |
| `DELETE /sets/:id` | Auteur seul |
| `PUT /sets/:id/folder` | Auteur seul : `{ folderId }` range le set dans l'un de ses dossiers, `null` l'en sort |
| `POST /sets/:id/duplicate` | Quiconque peut lire le set : crée une copie privée « … (copie) » |
| `GET /sets/:id/quiz` | Quiconque peut lire le set : un QCM par carte (422 s'il a moins de 4 définitions différentes) |
| `POST /sets/import` | Crée un set privé `{ title }` à partir de `{ text, separators: { term, card } }` : `{ set, imported, skipped }` |
| `POST /sets/:id/import` | Auteur seul (404 / 403 sinon) : ajoute les cartes importées à la fin du set |
| `GET /review/summary` | Compteurs du jour : `{ due, new }` (cartes dues et nouvelles cartes, limites appliquées) |
| `GET /review/queue?setId=` | File de révision du jour, avec l'échéance prévue pour chaque note. `setId` : un set visible (404 sinon) |
| `GET /review/due?setId=` | Cartes d'un set visible déjà commencées et dues aujourd'hui (option « à revoir » du mode écrit) |
| `POST /review/cards/:cardId` | Note une carte d'un set visible (404 sinon) : `{ rating: 1..4, reviewedAt? }` → `{ state, due, requeue, card, ignored }`. `reviewedAt` (ISO 8601 en UTC avec le « Z », facultatif) date la note : l'app mobile l'envoie pour ses notes prises hors ligne. Il est borné (5 minutes dans le futur, 30 jours dans le passé) et `ignored: true` signale une note non appliquée (périmée, rejouée ou plus ancienne que la dernière révision), sans rien écrire : voir [Répétition espacée](#répétition-espacée-fsrs). Le web n'envoie pas `reviewedAt` et n'a jamais de note ignorée |
| `POST /mobile/callback` | Relais du `form_post` d'Authelia vers l'app mobile : lit `code`, `state`, `iss`, `error` et `error_description` (formulaire) et répond par un **302** vers `quizlet://callback?…`. Après `identity`, avec une exception CSRF limitée à ce chemin : voir [Authentification mobile](#authentification-mobile-bearer-via-authelia) |
| `GET /settings`, `PUT /settings` | Mes paramètres de révision (fuseau, limites quotidiennes, rétention cible) |
| `GET /folders`, `POST /folders` | Mes dossiers (avec leur nombre de sets) ; création |
| `PATCH /folders/:id`, `DELETE /folders/:id` | Propriétaire seul (404 sinon) : renommage, suppression |
| `GET /tags`, `DELETE /tags/:id` | Mes tags (avec leur nombre de sets) ; suppression par le propriétaire seul (404 sinon) |

Règles d'accès, vérifiées côté serveur dans `apps/api/src/services/sets.ts` :

- Un set privé est **introuvable (404)** pour tout autre utilisateur que son auteur. On répond 404
  plutôt que 403 pour ne pas révéler qu'il existe.
- Un set public est lisible et duplicable par tout utilisateur authentifié. Le modifier ou le
  supprimer est **interdit (403)** à tout autre que son auteur.
- `PUT` conserve l'identifiant des cartes qui appartiennent déjà au set : elles sont modifiées sur
  place, si bien que leur progression de révision est conservée. Un identifiant inconnu, ou celui
  d'une carte d'un autre set, est ignoré : la carte est créée comme nouvelle. Une carte d'un autre
  set n'est donc jamais modifiée.
- Dossiers et tags appartiennent à un utilisateur : ceux d'un autre sont introuvables (404). Le
  dossier et les tags d'un set public ne sont jamais renvoyés à un autre lecteur que son auteur.

Choix simple : le CRUD des cartes passe par l'éditeur du set (une page, un enregistrement atomique)
plutôt que par une route par carte. Cela réduit la surface où vérifier les permissions.

## Répétition espacée (FSRS)

La planification utilise la bibliothèque [`ts-fsrs`](https://github.com/open-spaced-repetition/ts-fsrs)
(algorithme FSRS, paramètres par défaut), côté API uniquement.

- **Progression par utilisateur et par carte** (`card_reviews`), y compris sur les cartes d'un set
  public d'un autre utilisateur : chacun a la sienne. Une carte sans progression est « nouvelle ».
  Chaque note ajoute une ligne à l'historique (`review_logs`), gardé pour de futures statistiques.
- **Notes** : 1 À revoir, 2 Difficile, 3 Bien, 4 Facile. Une carte nouvelle ou ratée passe par des
  étapes courtes (1 et 10 minutes en apprentissage, 10 minutes en réapprentissage) avant de
  revenir à plusieurs jours. Sans « fuzz » : la planification est déterministe.
- **Rétention cible** (0,9 par défaut, de 0,70 à 0,99) : probabilité visée de se souvenir d'une
  carte à son échéance. Plus elle est haute, plus les intervalles sont courts.
- **Journée** : elle commence à minuit dans le fuseau de l'utilisateur (`Europe/Paris` par défaut,
  puis celui du navigateur, modifiable dans les paramètres). Postgres calcule les bornes du jour,
  changements d'heure compris.
- **File du jour** :
  - cartes en apprentissage ou en réapprentissage dues avant minuit, toujours proposées (sans
    plafond, sinon une carte ratée ne reviendrait pas dans la séance) ;
  - cartes en révision dues avant minuit, plus en retard d'abord, dans la limite des révisions
    du jour (200 par défaut) ;
  - nouvelles cartes, dans l'ordre des sets puis des cartes, dans la limite des nouvelles cartes
    du jour (20 par défaut).

  Les compteurs du jour se lisent dans l'historique : une révision compte comme nouvelle carte si
  la carte était nouvelle avant la note, comme révision si elle était en révision.
- **Révision du jour** : les cartes dues de mes sets **et** des sets publics que j'ai commencé à
  réviser (tant qu'ils restent publics), mais les nouvelles cartes de mes sets seulement.
  **Réviser ce set** : la même file, limitée à un set visible, nouvelles cartes comprises.
- **Séance** : une carte notée qui reste due aujourd'hui (étape d'apprentissage) revient en fin de
  séance. Les échéances prévues sous chaque bouton sont calculées par l'API à l'ouverture.
- **Notes datées (`reviewedAt`)** : l'app mobile note hors ligne puis envoie ses notes plus tard, avec
  leur heure (`reviewedAt`, ISO 8601 en UTC, avec le « Z »). Le champ est facultatif : sans lui (le
  web), la note a l'heure du serveur et aucune des règles ci-dessous ne s'applique.
  - La note est appliquée **à cette heure** : échéance, dernière révision et historique
    (`review_logs.reviewed_at`) en partent. Le quota du jour se compte sur l'heure de la note : une
    note d'hier ne consomme pas celui d'aujourd'hui.
  - **Futur** : jusqu'à 5 minutes après l'heure du serveur, l'heure est gardée telle quelle (un
    rejeu doit recevoir la même heure pour être reconnu). Au-delà (téléphone très en avance), la
    note est appliquée à l'heure du serveur : mieux vaut l'appliquer que la perdre.
  - **Trop ancienne** (plus de 30 jours) : ignorée. La réponse porte `ignored: true`, l'état courant
    de la carte (`new`, due maintenant, si elle n'a jamais été notée), `requeue: false` et
    `card: null` ; rien n'est écrit, aucune progression n'est créée.
  - **Ordre et rejeu** : une note qui n'est pas strictement postérieure à la dernière révision de la
    carte est ignorée de la même façon. Les notes prises hors ligne s'appliquent donc dans l'ordre de
    leurs dates (la plus ancienne reçue en retard est ignorée), et le rejeu d'une note dont la
    réponse s'est perdue ne l'applique jamais deux fois. Une note du web, sans `reviewedAt`, n'est
    jamais ignorée ; elle est datée au plus tôt de la dernière révision de la carte (`ts-fsrs`
    refuse un temps écoulé négatif), ce qui ne change rien tant qu'aucune note n'est datée dans le
    futur.
  - **Cas rare** : si l'horloge du téléphone avance de plus de 5 minutes, la note est appliquée à
    l'heure du serveur. Un rejeu après une réponse perdue reçoit alors une autre heure et peut être
    appliqué deux fois ; une note à plus de 5 minutes d'avance est aussi ignorée quand la carte a déjà
    reçu une note datée plus tard (par exemple à 4 minutes d'avance). Le coût est une révision de
    trop ou de moins sur une carte, jamais une note perdue en bloc.
- Modifier le texte d'une carte conserve sa progression ; la supprimer supprime sa progression et
  son historique ; un set dupliqué repart de zéro. Les flashcards de la V1 n'enregistrent rien.

## Import de cartes

La page d'import (`/import` pour un nouveau set, `/sets/:id/import` pour un set existant) accepte
un texte collé (Excel, Google Sheets, export Quizlet…) ou un fichier `.csv` / `.txt` encodé en
UTF-8 (1 Mo au plus, 1 000 000 octets ; un fichier dans un autre encodage est refusé, pas
« deviné »).

- **Séparateurs** : entre le terme et la définition (tabulation, virgule, point-virgule ou
  personnalisé) et entre les cartes (nouvelle ligne ou personnalisé ; `\n` et `\t` sont acceptés
  dans un séparateur personnalisé). Par défaut, la détection automatique choisit la tabulation si
  le texte en contient, sinon le point-virgule ou la virgule (celui présent sur le plus de lignes).
- **Format** : chaque carte est coupée au premier séparateur de terme, la suite forme la
  définition. Les champs entre guillemets peuvent contenir les séparateurs et des retours à la
  ligne (`""` pour un guillemet), comme dans un CSV d'Excel ou un copier-coller de Sheets.
- **Prompt pour Claude** : un bloc repliable en haut de la page propose un prompt à copier (bouton
  « Copier le prompt »). Il demande à Claude une carte par ligne, `terme ; définition`, dans un seul
  bloc de code, à coller ensuite dans le champ d'import. Aucune clé d'API : tout se fait dans votre
  conversation Claude.
- **Aperçu** : calculé dans le navigateur à chaque modification du texte ou des séparateurs. Il
  liste les cartes détectées et signale les lignes invalides (terme ou définition vide, ou trop
  long). Les lignes vides sont ignorées sans être signalées.
- **Import** : l'API reçoit le texte brut et les séparateurs, et découpe elle-même le texte avec le
  même code (`packages/shared/src/import.ts`) : rien de ce que le client a découpé n'est repris tel
  quel. Les lignes invalides sont ignorées (leur nombre est renvoyé). Tout se fait en une
  transaction, avec 2000 cartes au plus par import et par set. Un nouveau set importé est privé ;
  un import dans un set existant ajoute les cartes à la fin.

La limite de 1 Mo laisse de la marge sous celle des requêtes (1 Mio, côté API comme côté nginx),
même avec l'encodage JSON du texte.

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
| `AUTH_LOGOUT_URL` | requis en prod | URL de déconnexion d'Authelia. Son origine (celle du portail) est aussi la seule acceptée par la garde CSRF, sur `/api/mobile/callback` uniquement |
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
  désactivé par défaut. Une seule exception, limitée à un chemin : le relais de l'app mobile (voir
  [Authentification mobile](#authentification-mobile-bearer-via-authelia)).
- Quand la session Authelia expire, nginx répond aux appels d'API par un 302 vers le portail. Le
  front ne suit pas cette redirection : il affiche « Session expirée » avec un bouton
  « Se reconnecter », qui recharge la page et relance le parcours de connexion.
- Le bouton « Se déconnecter » du menu utilisateur redirige vers `AUTH_LOGOUT_URL`, fournie par
  `GET /api/me` : la changer ne demande pas de rebuild.

### Authentification mobile (Bearer via Authelia)

L'app Android (`apps/mobile`, en construction ; conception et décisions dans
[`docs/app-mobile.md`](docs/app-mobile.md)) se connecte par OIDC auprès d'Authelia, dans le
navigateur système (Custom Tab) : le mot de passe et le TOTP se saisissent sur le portail habituel,
jamais dans l'app. Elle envoie ensuite `Authorization: Bearer <jeton d'accès>` : nginx le fait
vérifier par Authelia (`auth_request`), comme un cookie de session.

```
App ─Bearer─▶ Cloudflare → nginx ──auth_request──▶ Authelia (valide le jeton)
                             │ 200 : Remote-User / Remote-Name / Remote-Email
                             ▼
                           API (inchangée)
```

- **L'API ne change pas côté identité** : elle lit toujours `Remote-*`, posés par le proxy de
  confiance (pair TCP vérifié). Elle ne voit jamais le jeton et n'en valide aucun.
- **Jetons** : jeton d'accès d'environ 1 h, refresh token d'un mois (glissant : un usage régulier ne
  reconnecte jamais), rangés dans le Keystore Android. Le jeton est limité à l'API de quizlet
  (`audience` et `resource`) : il n'ouvre ni les autres applications du stack, ni `/` de quizlet.
- **Relais `POST /api/mobile/callback`** : avec le scope `authelia.bearer.authz`, Authelia impose
  `response_mode=form_post` (le code OAuth arrive par un POST HTML) et n'accepte que `http(s)` en
  `redirect_uri`. Une redirection directe vers `quizlet://` est donc impossible : cette route reçoit
  le POST et répond par un **302 vers `quizlet://callback?…`**.
  - Elle passe après `identity` : le cookie Authelia vient d'être posé dans le Custom Tab, donc
    `auth_request` laisse passer la requête (sans identité : 401).
  - Elle ne lit que `code`, `state`, `iss`, `error` et `error_description` (2048 caractères au plus
    chacun) ; tout le reste est ignoré. Les valeurs sont encodées avec `encodeURIComponent`
    (l'espace devient `%20`, jamais `+`), dans un ordre fixe.
  - Une entrée invalide (ni `code` et `state`, ni `error`, corps illisible) donne un 302 vers
    `quizlet://callback?error=invalid_request`, jamais une erreur JSON : la personne resterait
    bloquée dans le Custom Tab.
  - Aucun effet de bord, aucune base de données. Le code ne sert à rien sans le `code_verifier` PKCE
    de l'app, qui rejette en plus un `state` inattendu.
- **Exception CSRF, limitée à ce chemin** : le POST vient du portail (même site, autre origine) et
  `csrfGuard` le refuserait. Il accepte l'`Origin` du portail (celle de `AUTH_LOGOUT_URL`) sur
  `/api/mobile/callback` seulement, chemin exact : partout ailleurs cette origine reste refusée.
  Elle n'est jamais ajoutée à `APP_ORIGIN` ni à `CORS_ORIGINS`. Sans `AUTH_LOGOUT_URL` (dev), il n'y
  a aucune exception.
- **nginx** : aucun nouveau `location` : celui de `/api/` couvre déjà le relais. Vérifier que le
  snippet `proxy.conf` du stack ne réécrit pas l'en-tête `Location` des réponses
  (`proxy_redirect`) : le 302 doit arriver tel quel dans le Custom Tab.
- **Déconnexion** : l'app révoque son refresh token chez Authelia, puis efface ses jetons. La
  session Authelia du **navigateur survit** : la fermer couperait aussi les autres applications du
  stack. Se reconnecter dans l'app peut donc se faire sans ressaisir le mot de passe, tant que cette
  session reste ouverte.

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
| `quizlet-backup` | PostgreSQL 17 (outils), volume `quizlet-backups` ou `BACKUP_DIR` | `quizlet-internal` | Sauvegardes quotidiennes ([détails](#sauvegardes)) |

L'API, le front et les sauvegardes tournent en lecture seule (`read_only`), sans capacités Linux et avec
`no-new-privileges`. Les images de base sont multi-architectures : le build se fait nativement sur
le serveur ARM64.

### Installation

```bash
cd /opt/stack/apps
git clone <dépôt> quizlet && cd quizlet
cp .env.example .env && chmod 600 .env
# Dans .env : POSTGRES_PASSWORD=$(openssl rand -hex 32), vérifier APP_ORIGIN / AUTH_LOGOUT_URL,
# et régler les sauvegardes (BACKUP_DIR, BACKUP_TIME, BACKUP_RETENTION_DAYS, TZ)
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps        # les quatre services en « healthy »
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
- Le relais de l'app mobile (`POST /api/mobile/callback`) passe par le `location /api/` ci-dessus :
  rien à ajouter. Vérifier seulement que `proxy.conf` ne réécrit pas l'en-tête `Location`.

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

### Client OIDC de l'app mobile (Authelia)

À faire à la main sur le serveur : ce dépôt ne modifie jamais la configuration du stack SSO, il n'en
fournit que des snippets. Authelia devient fournisseur OIDC pour l'app mobile et accepte un jeton
Bearer sur l'endpoint `auth-request`. Clés relues dans la documentation d'Authelia 4.39 ; décisions
et vérifications dans [`docs/app-mobile.md`](docs/app-mobile.md).

> **Attention** : redémarrer Authelia **déconnecte toutes les sessions web du stack** (elles sont en
> mémoire). Choisir un moment calme. Ne jamais committer les vraies valeurs des secrets : les ranger
> comme les autres secrets du stack.

Générer les secrets (même version d'image que le stack, 4.39.28 au moment de l'écriture) :

```bash
docker run --rm authelia/authelia:4.39.28 authelia crypto rand --length 64 --charset alphanumeric
docker run --rm -u "$(id -u):$(id -g)" -v "$(pwd)":/keys authelia/authelia:4.39.28 \
  authelia crypto pair rsa generate --directory /keys
```

Ajouts à `configuration.yml`. Le bloc `server.endpoints.authz` existe déjà : y ajouter
`authn_strategies`. Cet endpoint sert toutes les applications du stack, n'y faire que des ajouts.

```yaml
server:
  endpoints:
    authz:
      auth-request:
        implementation: 'AuthRequest'
        authn_strategies:
          - name: 'HeaderAuthorization'
            schemes:
              - 'Basic'
              - 'Bearer'   # seul ajout : Basic et CookieSession sont les défauts actuels
          - name: 'CookieSession'

identity_providers:
  oidc:
    hmac_secret: '<chaîne aléatoire de 64 caractères>'
    jwks:
      - algorithm: 'RS256'
        key: |
          <contenu de private.pem, indenté>
    lifespans:
      custom:
        quizlet-mobile:
          access_token: '1h'
          refresh_token: '30d'
    clients:
      - client_id: 'quizlet-mobile'
        client_name: 'Quizlet (mobile)'
        public: true
        token_endpoint_auth_method: 'none'
        authorization_policy: 'two_factor'
        consent_mode: 'explicit'
        lifespan: 'quizlet-mobile'
        redirect_uris:
          - 'https://quizlet.valldoy.com/api/mobile/callback'
        audience:
          - 'https://quizlet.valldoy.com'
        scopes:
          - 'authelia.bearer.authz'
          - 'offline_access'
        grant_types:
          - 'authorization_code'
          - 'refresh_token'
        response_types:
          - 'code'
        response_modes:
          - 'form_post'
        require_pkce: true
        pkce_challenge_method: 'S256'
        require_pushed_authorization_requests: true
```

Valider la configuration avec la commande `validate-config` de la documentation du stack, puis
`docker compose restart authelia` dans `/opt/stack`.

- Client public avec PKCE S256 et PAR obligatoires. Pas de scope `openid` (interdit avec
  `authelia.bearer.authz`) : l'app connaît l'utilisateur par `GET /api/me`.
- La `redirect_uri` est **https** : c'est le relais `POST /api/mobile/callback` de l'API, qui renvoie
  ensuite vers `quizlet://callback` (voir [Authentification mobile](#authentification-mobile-bearer-via-authelia)).
- Le PAR de l'app envoie `audience=https://quizlet.valldoy.com` **et**
  `resource=https://quizlet.valldoy.com/api`. Authelia compare l'`audience` à l'URL exacte de la
  requête : l'`audience` seule ne couvre pas `/api/me`, alors que `resource` (RFC 8707) se compare par
  hôte et préfixe de chemin.
- Le refresh token est rotaté, et en rejouer un déjà consommé révoque toute la famille : l'app ne
  rafraîchit jamais deux fois avec le même jeton.

Vérifier avec un jeton `$AT` (obtention à la main : voir `docs/app-mobile.md`) :

```bash
curl -si -H "Authorization: Bearer $AT" https://quizlet.valldoy.com/api/me                # 200 + votre nom
curl -si -H "Authorization: Bearer authelia_at_faux" https://quizlet.valldoy.com/api/me   # 302, jamais 200
```

### Validation

| # | Test | Résultat attendu |
|---|---|---|
| 1 | `docker compose -f docker-compose.prod.yml ps` | quatre services `healthy`, colonne PORTS sans publication sur l'hôte |
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

### Sauvegardes

La base vit dans le volume `quizlet_quizlet-pgdata`. Le service `quizlet-backup` la sauvegarde :

- **Quand** : chaque jour à `BACKUP_TIME` (03:00 par défaut, fuseau `TZ`), et dès son démarrage si
  aucune sauvegarde n'a moins de 26 heures (installation, longue interruption).
- **Comment** : `pg_dump` au format custom (compressé), écrit d'abord en `.partial` puis renommé :
  un fichier `quizlet-AAAA-MM-JJTHHMMSS.dump` est toujours complet. Un échec est journalisé et
  n'écrase rien.
- **Où** : `BACKUP_DIR`, un chemin de l'hôte (par exemple `/opt/backups/quizlet`, dossier
  appartenant à root) ou, par défaut, le volume `quizlet_quizlet-backups`.
- **Rotation** : après chaque sauvegarde réussie, celles de plus de `BACKUP_RETENTION_DAYS` jours
  (14 par défaut) sont supprimées. La plus récente n'est donc jamais supprimée.
- **Surveillance** : le conteneur est `healthy` tant que la dernière sauvegarde a moins de
  26 heures (`docker inspect -f '{{.State.Health.Status}}' quizlet-backup`). Journaux horodatés en
  français : `docker logs quizlet-backup`.
- **Sécurité** : image `postgres:17-alpine` (même version que la base), script monté en lecture
  seule depuis `docker/backup/backup.sh`, système de fichiers en lecture seule, aucune capacité
  Linux, réseau `quizlet-internal` seulement, sans `ports:`. Le mot de passe vient de
  `POSTGRES_PASSWORD` (`.env`).

Commandes, depuis `/opt/stack/apps/quizlet` (`FICHIER` : nom d'une sauvegarde du dossier) :

```bash
C="docker compose -f docker-compose.prod.yml"
$C exec quizlet-backup ls -lh /backups                     # sauvegardes disponibles
$C exec quizlet-backup /bin/sh /scripts/backup.sh backup   # sauvegarde immédiate
$C run --rm quizlet-backup verify FICHIER                  # vérification (base temporaire)
```

**Vérifier une sauvegarde** : `verify` la restaure dans une base temporaire
(`quizlet_verify_…`), affiche le nombre de migrations, d'utilisateurs, de sets et de cartes, puis
supprime cette base. La base de production n'est pas touchée.

**Restaurer** (remplace tout le contenu de la base) :

1. Vérifier la sauvegarde : `$C run --rm quizlet-backup verify FICHIER`.
2. Arrêter l'API : `$C stop quizlet-api`.
3. Restaurer : `$C run --rm quizlet-backup restore FICHIER`, puis taper `RESTAURER` (ou ajouter
   `--yes` pour un script).
4. Redémarrer l'API : `$C start quizlet-api`. Si la sauvegarde est antérieure à une migration,
   l'API l'applique au démarrage.

La restauration lit d'abord toute l'archive (une sauvegarde illisible est refusée avant de toucher
à la base), puis, **en une seule transaction**, supprime les schémas `public` et `drizzle` et
recrée tout depuis la sauvegarde. En cas d'erreur, la transaction est annulée et la base reste
inchangée. Ce chemin a été testé : restauration complète, archive corrompue refusée, et
sauvegarde de la V1 restaurée puis remise à niveau par les migrations.

En local, le même script tourne contre la base de dev (dossier `./backups`, ignoré par git) :
`pnpm db:backup`, `pnpm db:verify FICHIER`, `pnpm db:restore FICHIER`.

**Copie hors du serveur (exemple non activé)** : les sauvegardes restent sur le VPS tant qu'aucune
copie distante n'est configurée. Avec `BACKUP_DIR=/opt/backups/quizlet`, une tâche cron de l'hôte
peut les envoyer ailleurs, par exemple avec rclone (remote configuré au préalable avec
`rclone config`) ou rsync :

```bash
# /etc/cron.d/quizlet-backups-offsite — exemple, à adapter et à installer à la main
30 4 * * * root rclone copy /opt/backups/quizlet distant:quizlet-backups --max-age 48h
# ou : 30 4 * * * root rsync -a /opt/backups/quizlet/ sauvegarde@nas:/srv/quizlet/
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
  Rien n'est enregistré : c'est une étude libre, sans effet sur la répétition espacée, qui a son
  propre mode. Activer ou désactiver le
  mélange relance la session. Marquer une carte passe à la suivante. Raccourcis : Espace pour
  retourner la carte, ← et → pour naviguer (désactivés pendant une saisie ; sur un bouton, Espace
  active le bouton).
- Quiz : généré par l'API, une question par carte et dans un ordre aléatoire. Chaque question
  propose la bonne définition et trois distracteurs tirés des autres cartes. Les définitions
  identiques à la casse et aux espaces près ne comptent qu'une fois, d'où le minimum de 4
  définitions *différentes*. La réponse attendue (`answerIndex`) est envoyée avec les questions et
  le score est calculé dans le navigateur : c'est un outil de révision personnelle, pas un examen.
  Chaque « Nouveau quiz » demande un nouveau tirage. Raccourcis : touches 1 à 4.
- Recherche (bibliothèque et palette Ctrl/Cmd+K, une seule requête côté API) : titre,
  description, tags et contenu des cartes de **mes** sets, sans tenir compte de la casse mais en
  tenant compte des accents (`ILIKE`, jokers `%` et `_` échappés). Choix de `pg_trgm` plutôt que
  de la recherche plein texte `french` : on trouve des morceaux de mots pendant la frappe, et des
  contenus courts (« Fe », « Or ») que la configuration `french` écarte comme mots vides. Des index
  GIN trigram couvrent les colonnes cherchées. La bibliothèque ne liste que ses propres sets : un
  set public d'un autre utilisateur s'ouvre par son lien et peut être dupliqué.
- Connexions Postgres de l'API avec `jit = off` : sur ces requêtes courtes, la compilation JIT
  coûtait environ 230 ms à la recherche pour 3 ms d'exécution.
- Front : les pages autres que la bibliothèque sont chargées à la demande, et le socle React
  (react, react-dom, react-router, TanStack Query) forme un chunk à part, qui reste en cache d'un
  déploiement à l'autre. Les constantes partagées vivent dans un module sans Zod, pour ne pas
  embarquer Zod dans le chargement initial.
- Thème clair/sombre : préférence mémorisée dans le navigateur (clair, sombre ou système). Elle est
  appliquée avant le premier rendu par `public/theme-init.js`, un script externe et non inline,
  pour respecter la CSP `script-src 'self'`.
- Une session Authelia expirée en cours d'édition affiche une bannière « Se reconnecter ». La
  saisie n'est pas sauvegardée automatiquement : la bannière invite à la copier avant de recharger.

Choix de la V2 :

- Bibliothèque : 24 sets par page ; dossier, tags et page restent dans l'URL. Plusieurs tags
  sélectionnés filtrent en **ET** (le set doit les porter tous). Ranger un set dans un dossier ne
  change pas sa date de modification.
- Tags : un nom par utilisateur, sans tenir compte de la casse (« Anglais » et « anglais » sont le
  même tag, qui garde l'orthographe de sa création). Un tag se crée dans l'éditeur et se supprime
  depuis la bibliothèque ; il ne se renomme pas. Les noms de dossier, eux, peuvent se répéter.
- Dupliquer un set ne copie ni ses tags, ni son dossier, ni la progression : la copie repart de
  zéro.
- Un set contient 2000 cartes au plus (500 en V1), la même limite que pour un import. L'éditeur
  reste sur une seule page : il devient plus lent sur les très gros sets, et un set de 2000 cartes
  très longues peut dépasser la limite de 1 Mio par requête à l'enregistrement.
- Mode écrit : la réponse et la réponse attendue sont comparées sans casse, sans accents, sans
  ponctuation (remplacée par une espace) et sans espaces superflus. Il tolère ensuite une faute de
  frappe (distance de Levenshtein) par tranche de 5 caractères de la réponse attendue : aucune sur
  « Rome », une sur « Paris ». Une réponse acceptée avec des fautes affiche la bonne orthographe.
  « Je ne sais pas » montre la réponse et compte une erreur. Tout se passe dans le navigateur,
  sans rien enregistrer.

## Tests

```bash
docker compose up -d db   # l'API est testée contre une vraie base PostgreSQL (quizlet_test)
pnpm test
```

| Package | Ce qui est testé |
|---|---|
| `apps/api` | Middleware d'identité : proxy de confiance ou non, en-têtes forgés, `X-Forwarded-For` ignoré, UTF-8, mode dev. Configuration : refus du mode dev en production, variables obligatoires. Upsert et cache des utilisateurs. Permissions sur les sets (lecture, écriture, suppression, duplication, carte d'un autre set). Génération du quiz (graine déterministe, distracteurs distincts, minimum de cartes). Garde CSRF, en-têtes de sécurité, CORS. **V2** : migration d'une base V1 avec données ; dossiers et tags (CRUD, filtres en ET, pagination, isolation entre utilisateurs, confidentialité sur un set public) ; recherche (titre, description, tags, cartes, jokers échappés) ; import (séparateurs, guillemets, lignes invalides, limites de 2000 cartes et de 1 Mo, sets d'autrui) ; FSRS (note → nouvelle échéance, étapes d'apprentissage, rétention, aller-retour avec la base) ; file du jour (limites quotidiennes, minuit dans le fuseau de l'utilisateur, Paris et New York) ; permissions de la révision ; progression conservée à la modification d'une carte, supprimée avec elle, remise à zéro par la duplication ; paramètres ; seed. **App mobile** : notes datées `reviewedAt` (bornes de 5 minutes et 30 jours, note passée appliquée à son heure, rejeu identique idempotent, deux notes dans l'ordre et en désordre, quota du jour décompté à l'heure de la note, set privé d'autrui en 404 ; note du web juste après une note mobile datée dans 2 minutes, y compris à cheval sur minuit UTC où `ts-fsrs` lèverait) ; relais `POST /api/mobile/callback` (302 exact, encodage, erreurs relayées, `invalid_request`, champs hors liste ignorés, autre origine ou autre chemin en 403, sans identité en 401, pair non fiable en 403, GET en 404) ; exceptions CSRF par chemin |
| `apps/web` | Logique pure : session de flashcards (progression, marquage, mélange), score du quiz, formulaire d'édition, client HTTP (session expirée), raccourcis clavier, filtres de la bibliothèque, comparaison tolérante et session du mode écrit, séance de révision et format des intervalles. Tests de rendu (jsdom) des parcours : bibliothèque (dossiers, tags, pagination, déplacement), création et édition (tags), page d'un set, flashcards, quiz, recherche Ctrl+K, import, mode écrit, révision, paramètres, aide `?` |
| `packages/shared` | Mélange de Fisher-Yates, générateur pseudo-aléatoire, schémas Zod (dont paramètres et notes, avec `reviewedAt` : UTC avec le « Z » seulement), normalisation des réponses, parsing de l'import et détection des séparateurs |

Les tests du relais et des exceptions CSRF appellent `app.request` directement : l'aide
`createTestClient().request` ajoute `sec-fetch-site: same-origin` à tout POST, ce qui ferait réussir
ces tests sans jamais exercer la garde. Ce qui ne se teste pas ici : les en-têtes réels du
`form_post` d'Authelia (`Origin`, `Sec-Fetch-Site`) et le 302 vers `quizlet://` dans un Custom Tab
Android, à vérifier sur appareil ([`docs/app-mobile.md`](docs/app-mobile.md)).

Le script de sauvegarde (`docker/backup/backup.sh`) a été testé à la main contre la base de dev :
sauvegarde, vérification, restauration (confirmée, annulée, archive corrompue, sauvegarde V1 puis
migrations), rotation, démon (heure planifiée, sauvegarde au démarrage, arrêt propre) et
healthcheck, avec les mêmes restrictions qu'en production.

## Dépannage

- **`pnpm test` échoue avec « Postgres de test injoignable »** : lancer `docker compose up -d db`.
- **Le port 5433 ou 5180 est déjà pris** : changer le port dans `docker-compose.yml` (et
  `DATABASE_URL` dans `apps/api/.env`), ou dans `apps/web/vite.config.ts` (et `APP_ORIGIN`).
- **« Requête refusée : … n'est pas un proxy de confiance »** dans les logs de l'API : la requête
  ne vient pas du nginx du stack. Vérifier `TRUSTED_PROXIES` et que le conteneur s'appelle bien
  `nginx` sur le réseau `web`.
- **401 sur toutes les routes en production** : nginx ne transmet pas `Remote-User`. Vérifier que
  chaque `location` du vhost inclut `authelia-authrequest.conf`.
- **« Session expirée » en boucle** : vérifier la session Authelia sur `auth.valldoy.com`. Une
  boucle de redirection peut aussi venir d'un `$scheme` au lieu de `$real_scheme` dans les snippets
  du stack (§12 de la documentation du stack).
- **`403 CSRF_REJECTED` sur `POST /api/mobile/callback`** (la connexion mobile reste bloquée sur un
  message JSON dans le Custom Tab) : l'`Origin` du POST d'Authelia n'est pas celle de
  `AUTH_LOGOUT_URL`. Vérifier que cette variable pointe bien sur le portail d'où part le formulaire,
  et lire l'`Origin` de la requête dans les DevTools (onglet Network, « Preserve log »). Une valeur
  `null` (portail en `Referrer-Policy: no-referrer`) demande d'ajouter la chaîne `'null'` à la
  liste de l'exception, dans `app.ts`, pour ce chemin seulement.
- **Après la connexion mobile, un 302 avec un `Location` vide** (et
  `www-authenticate: Bearer error="invalid_token"`) : le jeton est valide mais refusé, presque
  toujours à cause de l'audience. Le PAR doit envoyer `audience=https://quizlet.valldoy.com` **et**
  `resource=https://quizlet.valldoy.com/api` ; le journal d'Authelia (`docker compose logs authelia`)
  dit alors « the granted audience and resource does not match the request ».
