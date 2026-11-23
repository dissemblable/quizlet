# App mobile — notes de conception

État au 2026-11-20 : l'authentification est vérifiée de bout en bout sur le serveur (les 6
vérifications sont faites) et `apps/mobile` est écrit : toutes les fonctionnalités du web,
l'authentification, le hors-ligne et le rappel quotidien. Les vérifications automatisables passent
(typecheck, lint, tests, bundle Hermes) ; il reste la **checklist appareil** (fin de ce fichier), à
faire sur un téléphone avec un dev-client. Ce fichier résume ce qui a été décidé et retenu, et ce
qui reste à vérifier.

## Décisions validées

| Sujet | Décision |
|---|---|
| Pourquoi une app native | Révision **hors-ligne** et **notifications** de rappel |
| Plateforme | **Android uniquement** |
| Technologie | **Expo (React Native)**, dans `apps/mobile` du monorepo |
| Utilisateurs | Plusieurs personnes à terme, chacune avec son compte Authelia |
| Authentification | **OIDC Authelia + jeton Bearer vérifié par nginx** (la sécurité prime sur le confort) |
| Durée de connexion | **1 mois** (refresh token) |
| Interface | Expo Router, 4 onglets (Bibliothèque, Révision avec badge, Recherche, Compte) ; StyleSheet et tokens de thème maison (ni NativeWind ni kit de composants) |
| Tests | Vitest sur la logique pure uniquement ; règle de pureté vérifiée par `src/architecture.test.ts` |
| Logique du web | Reducers (flashcards, quiz, révision, mode écrit), formulaire de set, formats et erreurs client déplacés dans `@quizlet/shared` : web et mobile importent le même code |
| Build | Local : JDK 17 + Android SDK, `expo prebuild` puis `expo run:android` (pas d'EAS) ; `android.package` = `com.valldoy.quizlet` |
| Déconnexion | Révocation du refresh token puis effacement local ; la session Authelia du navigateur survit |

## Authentification : OIDC Authelia + Bearer

Le stack tourne sous Authelia 4.39.x (voir la documentation du stack, non versionnée). Authelia
sait être fournisseur OIDC, mais ce n'est pas encore configuré. Il accepte un jeton d'accès OAuth
sur l'endpoint `auth-request` : nginx continue donc de transmettre l'identité par `Remote-*`.

```
App ─Bearer authelia_at_…─▶ Cloudflare → nginx ─auth_request─▶ Authelia (valide le jeton)
                                           │ 200 + Remote-User / Remote-Name / Remote-Email
                                           ▼
                                         API (inchangée)
```

- **API inchangée côté identité.** La règle « identité uniquement via `Remote-*` du proxy de
  confiance » reste vraie. `csrfGuard` laisse déjà passer un client sans `Origin` ni
  `Sec-Fetch-Site` ([csrf.ts](../apps/api/src/middleware/csrf.ts)).
- **Connexion** dans le navigateur système (Custom Tabs via `expo-web-browser`). Pas de WebView,
  pas de formulaire de connexion natif. Le mot de passe et le TOTP se saisissent sur le portail
  Authelia habituel.
- **Client OIDC** : client public (`token_endpoint_auth_method: 'none'`), Authorization Code avec
  PKCE S256 et PAR obligatoires, scopes `authelia.bearer.authz` et `offline_access` uniquement,
  consentement `explicit`, `audience` limitée à `https://quizlet.valldoy.com`. Pas de scope
  `openid` (interdit avec `authelia.bearer.authz`) : l'app connaît l'utilisateur par `/api/me`.
- **Audience et `resource`** (vérifié le 2026-11-20) : Authelia compare l'`audience` du jeton à
  l'URL **exacte** de la requête, donc `audience=https://quizlet.valldoy.com` seule ne couvre pas
  `/api/me` (log : « the granted audience and resource does not match the request »). Le PAR doit
  aussi envoyer `resource=https://quizlet.valldoy.com/api` : `resource` (RFC 8707) se compare par
  schéma, hôte et préfixe de chemin. Aucune option de configuration supplémentaire n'est nécessaire.
  Résultat : le jeton ouvre `/api/*` de quizlet, mais ni `/` de quizlet ni les autres applications
  du stack (testé sur `whoami`). Un jeton volé ne sert donc qu'à cette API.
- **Endpoint `auth-request`** : `HeaderAuthorization` avec le schéma `Bearer`, en gardant
  `CookieSession` pour le web (vérifié : `Proxy-Authorization` n'est pas utile, et sans en-tête ou
  avec un faux jeton le comportement web reste un 302 vers le portail). Cet endpoint sert toutes
  les applications du stack : n'y faire que des ajouts.
- **Jetons** : access token court (environ 1 h), refresh token d'un mois. Ils sont stockés dans
  `expo-secure-store` (Keystore), jamais dans AsyncStorage. Le défaut d'Authelia (refresh token de
  90 min) ne convient pas : durée propre au client via `lifespans.custom` et la clé `lifespan`.
  Vérifié : le refresh token est **glissant** (chaque refresh en émet un nouveau avec la durée
  complète : l'usage régulier ne reconnecte jamais) et **rotaté** (l'ancien est refusé). Rejouer
  un refresh token déjà consommé **révoque toute la famille** (l'access token et le refresh token
  courants meurent aussi) : l'app ne doit jamais rafraîchir deux fois avec le même jeton
  (sérialiser les refresh, un seul à la fois). Les jetons survivent à un redémarrage d'Authelia.
- **Déconnexion** : révoquer le refresh token chez Authelia (`revocation_endpoint`, client
  public : `client_id` et `token`, réponse 200), puis effacer le stockage local. Vérifié : le
  refresh token révoqué est refusé et l'access token associé cesse de fonctionner.
- **Retrait d'un utilisateur** : Authelia consulte la base des comptes à chaque requête, donc
  retirer un compte coupe l'accès de l'app.
- **Expiration** : le snippet nginx du stack transforme tout 401 d'Authelia en 302
  (`error_page 401 =302`). L'app traite 401 et 302 de la même façon : rafraîchir le jeton, sinon
  relancer la connexion. Avec un jeton valide mais refusé (audience, expiré), la réponse est un 302
  avec un `Location` vide et un en-tête `www-authenticate: Bearer error="invalid_token"`.
- **Refresh mort** : un refresh token révoqué ou révoqué par réutilisation renvoie un **HTTP 500
  `server_error`** (log : « error revoking oauth2 access token session … no rows affected »), pas
  un 400 `invalid_grant`. Un refresh token simplement déjà consommé renvoie bien un 400
  `invalid_grant` (cas de l'expiration naturelle non testé). L'app traite les deux comme « se reconnecter » (pour le 500, un seul nouvel
  essai suffit à écarter une panne passagère).
- **Configuration Authelia** : faite à la main sur le serveur, avec des snippets dans le README
  (règle de CLAUDE.md). Configuration de départ dans la section « Vérifications » : clés relues
  dans la doc d'Authelia le 2026-11-16, à valider avec `authelia validate-config`.

### Relais `form_post`

Deux contraintes d'Authelia imposent une page relais en https :

- avec le scope `authelia.bearer.authz`, seuls les modes de réponse `form_post` et
  `form_post.jwt` sont permis : le code arrive par un POST HTML ;
- `redirect_uris` n'accepte que les schémas `http` et `https`.

Une redirection directe vers `quizlet://` est donc impossible. Il faut une petite route relais :

- `POST /api/mobile/callback` répond par un 302 vers `quizlet://callback?code=…&state=…` ;
- elle passe après `identity`, comme toute route : le cookie Authelia vient d'être posé dans le
  Custom Tab, donc `auth_request` laisse passer la requête ;
- elle demande une seule exception CSRF : accepter l'origine du portail Authelia, sur ce chemin
  uniquement ;
- elle est sans risque : le code ne sert à rien sans le verifier PKCE, et l'app rejette un `state`
  inattendu.

Schéma perso `quizlet://` plutôt qu'App Links : les App Links exigent un `/.well-known/` accessible
sans authentification, alors que tout le vhost est derrière `auth_request`.

### Options écartées

- **Jetons d'API maison** : contournent Authelia et la 2FA, et l'API doit gérer des secrets (hash,
  révocation).
- **better-auth lisant les comptes Authelia** : le conteneur quizlet détiendrait les hash et les
  secrets TOTP de tout le SSO (avec la clé de chiffrement du stockage d'Authelia). Il dépendrait du
  format interne d'Authelia, et contournerait l'anti-brute-force (`regulation`) et l'historique des
  codes TOTP.
- **Formulaire natif appelant l'API du portail Authelia** (`/api/firstfactor`…) : le cookie
  obtenu vaut pour tout `*.valldoy.com`, les sessions Authelia sont en mémoire (perdues à chaque
  redémarrage), l'API du portail est interne, et le mot de passe SSO se tape dans une app.
- **OIDC classique avec validation du jeton par l'API** : casse la règle « identité via
  `Remote-*` uniquement » et ajoute du code d'authentification dans l'API.
- **WebView / PWA** : écartées au profit d'une app Expo.

## Hors-ligne, notifications, Expo (retenu et implémenté)

Implémentation du hors-ligne (`apps/mobile/src/offline`) : cache TanStack persisté dans un fichier
(`Paths.document/offline/query-cache.v1.json`, repli AsyncStorage) ; chaque note est une mutation
`['review','grade']` à `scope` unique `review-grade` (rejeu dans l'ordre), persistée tant qu'elle est
en cours, `reviewedAt` pris au tap. Envoi bloqué tant que la session n'est pas `signedIn` et que le
propriétaire n'est pas vérifié par un `/api/me` frais (une note d'un compte n'est jamais envoyée avec
le jeton d'un autre). Réessais illimités sur erreur réseau ou session expirée, plafonnés sur 5xx ;
un 4xx définitif abandonne la note. Côté API, une note postérieure à `last_review` est appliquée,
sinon elle est ignorée (`ignored: true`, rien n'est écrit) : le rejeu est idempotent. `ts-fsrs` lève
sur un temps écoulé négatif : le chemin sans `reviewedAt` utilise `max(now, lastReview)`.

## Propositions initiales (conservées pour mémoire)

### Hors-ligne : réviser seulement

- Hors réseau, on peut réviser mais pas éditer. Créer ou modifier un set reste en ligne, pour
  éviter de fusionner des modifications concurrentes.
- Cache et file d'attente avec TanStack Query (`persistQueryClient`, mutations en pause puis
  `resumePausedMutations`), plutôt qu'une couche SQLite maison.
- Chaque note est une mutation `{ cardId, rating, reviewedAt }`, l'heure étant prise au moment de
  la note.
- Côté API : `reviewedAt` facultatif dans `gradeSchema`
  ([review.ts](../packages/shared/src/review.ts)), utilisé à la place de `now()` dans
  [routes/review.ts](../apps/api/src/routes/review.ts). Il est borné : pas dans le futur, pas trop
  ancien, jamais avant la dernière révision de la carte (sinon la note est ignorée).
- `ts-fsrs` reste côté API. Hors-ligne, une carte notée « À revoir » est remontrée en fin de
  séance ; la vraie échéance est calculée à la synchronisation.
- Conflit web / téléphone sur une même carte : les notes s'appliquent dans l'ordre de
  `reviewedAt`.

### Notifications : locales d'abord

- `expo-notifications` programme un rappel quotidien à heure fixe sur le téléphone : ni Firebase,
  ni serveur de push, et ça fonctionne hors-ligne.
- Texte générique, ou nombre de cartes calculé à la dernière synchronisation (il peut être faux si
  la personne a révisé sur le web entre-temps).
- Android 13 et plus : demander la permission `POST_NOTIFICATIONS`.
- Push serveur (FCM, jetons en base, tâche quotidienne) seulement si ce décalage gêne.

### Expo et monorepo

- Réutiliser `hc<AppType>`, `@quizlet/shared` et TanStack Query. Ne jamais importer `ts-fsrs` dans
  l'app.
- Development build (pas Expo Go), à cause du schéma `quizlet://` et des modules natifs. APK
  construit en local (JDK 17 + Android SDK, `npx expo prebuild --platform android` puis
  `npx expo run:android` depuis `apps/mobile` ; APK : `cd android && ./gradlew assembleRelease`,
  signé avec la clé debug du gabarit, suffisant pour l'installation directe). Windows : activer les
  chemins longs (`LongPathsEnabled`) ou monter le dépôt avec `subst` si CMake/Ninja échoue.
- Expo SDK 58 (RN 0.88, Hermes) : pnpm en `node_modules` isolés est pris en charge, et Metro se
  configure seul pour les monorepos. Ne pas passer à `nodeLinker: hoisted` sans en
  discuter : ça changerait l'installation de tout le monorepo.
- Distribution : APK direct, puis Play Store en test fermé quand il y aura plusieurs personnes.
- EAS Update pousse le JS sans réinstallation. Un changement natif demande toujours un nouvel APK.
- Une app installée peut rester ancienne : l'API n'évolue plus que par ajouts, comme les
  migrations. `AppType` ne protège pas un vieux binaire.

## Vérifications

Les points 1 à 4 se vérifient sur le serveur, une fois le provider OIDC configuré (étape 1 du
plan). Les points 5 et 6 se vérifient à la création de `apps/mobile` (étape 3).

- [x] 1. Un jeton Bearer obtenu en 2FA passe la règle `two_factor`, `Remote-User` arrive jusqu'à
  l'API, et l'`audience` bloque les autres applications du stack. *(2026-11-20, après ajout de
  `resource` au PAR, voir « Audience et `resource` ».)*
- [x] 2. Cloudflare laisse passer un client natif. *(2026-11-20 : `/api/me` et le endpoint token
  répondent normalement avec le user-agent `okhttp/4.12.0`.)*
- [x] 3. Le refresh token : durée glissante, rotation, et réutilisation = famille révoquée.
  *(2026-11-20.)*
- [x] 4. Les jetons survivent à un redémarrage d'Authelia. *(2026-11-20 : access token et refresh
  token émis avant le redémarrage fonctionnent après.)*
- [x] 5. Le `fetch` de React Native et `redirect: 'manual'`. *(2026-11-20, Android, Expo Go SDK 58 :
  le `fetch` global et `expo/fetch` respectent l'option. Faux jeton sur `/api/me` : `status` 302,
  `type` `default` (pas `opaqueredirect`), `url` inchangée, en-tête `Location` lisible vers
  `auth.valldoy.com`, `content-type` `text/html`. L'app détecte donc l'expiration avec
  `res.status === 302` (ou 401), sans lire `res.type`.)*
- [x] 6. Metro, pnpm et les paquets du workspace en source TS. *(2026-11-20 : `expo export
  --platform android` (703 modules), typecheck, lint et tests du monorepo passent ; le bundle ne
  contient ni `ts-fsrs` ni le code de l'API ; Expo Go affiche bien une constante et un schéma Zod
  de `@quizlet/shared`. `nodeLinker` inchangé.)*

> **Attention** : chaque redémarrage d'Authelia déconnecte toutes les sessions web du stack (elles
> sont en mémoire). Faire ces tests à un moment calme. Ne jamais committer les vraies valeurs des
> secrets : les ranger comme les autres secrets du stack (voir sa documentation).

### Configuration Authelia (sur le serveur, à la main)

Générer les secrets (même version d'image que le stack, 4.39.28 au 2026-11-16) :

```bash
docker run --rm authelia/authelia:4.39.28 authelia crypto rand --length 64 --charset alphanumeric
docker run --rm -u "$(id -u):$(id -g)" -v "$(pwd)":/keys authelia/authelia:4.39.28 \
  authelia crypto pair rsa generate --directory /keys
```

Ajouts à `configuration.yml` (le bloc `server.endpoints.authz` existe déjà : y ajouter
`authn_strategies`) :

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

Valider avec la commande `validate-config` de la documentation du stack, puis
`docker compose restart authelia` dans `/opt/stack`.

### Obtenir un jeton à la main (depuis le PC, Git Bash)

Passer par Internet, et donc par Cloudflare, comme le fera l'app.

```bash
# Lire pushed_authorization_request_endpoint, authorization_endpoint et token_endpoint
curl -s https://auth.valldoy.com/.well-known/openid-configuration

PAR_URL='<pushed_authorization_request_endpoint>'
AUTHZ_URL='<authorization_endpoint>'
TOKEN_URL='<token_endpoint>'
CB='https://quizlet.valldoy.com/api/mobile/callback'

# PKCE et state
VERIFIER=$(openssl rand -base64 48 | tr -d '=+/\r\n')   # \r : openssl de Git Bash
CHALLENGE=$(printf '%s' "$VERIFIER" | openssl dgst -sha256 -binary | openssl base64 -A \
  | tr '+/' '-_' | tr -d '=')
STATE=$(openssl rand -hex 16); echo "$STATE"

# PAR : la réponse contient un request_uri
curl -s "$PAR_URL" -d client_id=quizlet-mobile -d response_type=code -d response_mode=form_post \
  --data-urlencode redirect_uri="$CB" --data-urlencode 'scope=authelia.bearer.authz offline_access' \
  --data-urlencode audience=https://quizlet.valldoy.com \
  --data-urlencode resource=https://quizlet.valldoy.com/api \
  -d code_challenge="$CHALLENGE" -d code_challenge_method=S256 -d state="$STATE"
```

1. Dans Chrome, ouvrir les DevTools (onglet Network, cocher « Preserve log »).
2. Ouvrir `<AUTHZ_URL>?client_id=quizlet-mobile&request_uri=<request_uri>`.
3. Se connecter (mot de passe, TOTP), puis accepter le consentement.
4. Authelia envoie un POST vers `$CB`. Il échoue (403 ou 404) : c'est normal, le relais n'existe
   pas encore. L'onglet Payload de cette requête contient `code` et `state`. Vérifier que `state`
   est celui affiché plus haut.
5. Échanger le code **dans la minute** (durée de vie par défaut d'un code) :

```bash
CODE='<code>'
curl -s "$TOKEN_URL" -d grant_type=authorization_code -d client_id=quizlet-mobile \
  --data-urlencode code="$CODE" --data-urlencode redirect_uri="$CB" -d code_verifier="$VERIFIER"
# Réponse : access_token (authelia_at_…) et refresh_token (authelia_rt_…)
AT='<access_token>'; RT='<refresh_token>'
```

### Tests

**1. Identité, 2FA et audience**

```bash
curl -si -H "Authorization: Bearer $AT" https://quizlet.valldoy.com/api/me              # 200 + ton nom
curl -si -H "Authorization: Bearer authelia_at_faux" https://quizlet.valldoy.com/api/me # 302, pas 200
curl -si -H "Authorization: Bearer $AT" https://<autre-app>.valldoy.com/               # pas 200
```

En cas de 302 sur la première commande, lire `docker compose logs authelia` (niveau 2FA, audience,
stratégie). Le message « the granted audience and resource does not match » signifie que le PAR
n'a pas envoyé `resource=https://quizlet.valldoy.com/api` (voir « Audience et `resource` »).
`HeaderAuthRequestProxyAuthorization` (`-H "Proxy-Authorization: Bearer $AT"`) n'a pas été
nécessaire.

**2. Cloudflare** : les commandes ci-dessus passent déjà par Cloudflare. Refaire la première avec
le user-agent du `fetch` Android (OkHttp) :

```bash
curl -si -A 'okhttp/4.12.0' -H "Authorization: Bearer $AT" https://quizlet.valldoy.com/api/me
```

On doit obtenir le même JSON. Une page HTML « Just a moment… » ou un en-tête `cf-mitigated`
signale un challenge : régler la section Security → Bots du tableau de bord Cloudflare.

**3. Refresh token glissant ou absolu**

Mettre temporairement `access_token: '2m'` et `refresh_token: '10m'` dans
`lifespans.custom.quizlet-mobile`, puis redémarrer Authelia.

```bash
curl -s "$TOKEN_URL" -d grant_type=refresh_token -d client_id=quizlet-mobile \
  --data-urlencode refresh_token="$RT"
```

1. À T0, obtenir des jetons.
2. À T0 + 6 min, rafraîchir avec la commande ci-dessus : on obtient un nouveau refresh token, RT2.
3. À T0 + 12 min, rafraîchir avec RT2.
   - Si ça marche, la durée est glissante : quelqu'un qui utilise l'app ne se reconnecte jamais.
   - Si ça échoue, la durée est absolue : tout le monde se reconnecte chaque mois.
4. Seulement ensuite, rejouer un ancien refresh token encore valide : il doit être refusé
   (rotation). Attention : Authelia révoque alors toute la famille de jetons, donc ce rejeu avant
   l'étape 3 fausserait son résultat. Résultat obtenu : glissant, rotation confirmée.
5. Remettre `1h` et `30d`.

**4. Redémarrage d'Authelia** : avec un `AT` et un `RT` valides, lancer
`docker compose restart authelia`. Refaire ensuite le test 1 et un rafraîchissement. Les deux
doivent réussir. Ce test peut se faire pendant le redémarrage de fin du test 3.

**5. `redirect: 'manual'` en React Native** : dans `apps/mobile`, appeler `/api/me` avec un faux
jeton, puis afficher `res.status`, `res.type`, `res.url` et l'en-tête `content-type`.

- `res.type === 'opaqueredirect'` (statut 0) ou 302 : l'option est respectée.
- 200 en `text/html`, avec une `url` sur `auth.valldoy.com` : la redirection a été suivie. L'app
  détectera alors l'expiration avec `res.url` ou `content-type`.

**6. Metro et pnpm** : dans `apps/mobile`, importer une constante et un schéma Zod de
`@quizlet/shared`, et le type `AppType`. Ensuite, lancer `npx expo export --platform android` (ça
construit le bundle sans téléphone) et le typecheck. En cas d'échec, ne pas passer à
`nodeLinker: hoisted` sans en discuter.

## Ordre de travail

1. **Test de l'auth, sans app** : vérifications 1 à 4 ci-dessus. *(Fait.)*
2. **API** : `reviewedAt`, route relais `/api/mobile/callback` et son exception CSRF, avec tests.
   *(Fait ; à déployer sur le serveur avant tout test d'auth sur appareil.)*
3. **`apps/mobile`** : connexion, toutes les fonctionnalités du web. *(Fait.)*
4. Révision hors-ligne. *(Fait.)*
5. Notifications locales. *(Fait.)*
6. **Checklist appareil** ci-dessous. *(À faire.)*

## Checklist appareil

Prérequis : API déployée avec le relais et l'exception CSRF ; JDK 17 et Android SDK installés ;
`apps/mobile/.env` rempli (`EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_AUTH_URL`,
`EXPO_PUBLIC_OIDC_CLIENT_ID`, voir `.env.example`) ; dev-client installé (`npx expo run:android`) et
Metro lancé (`pnpm --filter @quizlet/mobile start`, `adb reverse tcp:8081 tcp:8081` si besoin).

- **Avant tout** : ouvrir DevTools sur le `form_post` d'Authelia (étape 4 de « Obtenir un jeton à
  la main ») et relever `Origin`, `Sec-Fetch-Site` et `Referrer-Policy`. L'exception CSRF accepte
  l'origine du portail et `Origin: null` sur le relais seulement (`apps/api/src/app.ts`) ; si le
  portail envoie autre chose, l'ajouter à cette liste.
- **Auth** : le 302 vers `quizlet://callback` dans le Custom Tab (plan B si Chrome le refuse : page
  200 avec `<meta http-equiv="refresh">` et lien visible) ; succès, annulation, fermeture manuelle
  du Custom Tab, app tuée pendant le Custom Tab (reprise à froid), déconnexion puis reconnexion,
  démarrage à froid connecté et déconnecté, lien `quizlet://callback` à froid et à chaud.
- **Rotation du refresh token** : mettre temporairement `access_token: '2m'` (test 3 ci-dessus),
  utiliser l'app longtemps : un seul refresh visible côté Authelia.
- **Hermes** (écran Diagnostics, visible en dev-client) : `Intl.supportedValuesOf`,
  `Intl.DateTimeFormat({ timeZone })`, `normalize('NFD')` + `\p{M}` / `\p{P}` (mode écrit),
  `toLocale*`, un appel `api.me.$get()`.
- **Hors ligne** : mode avion, 10 notes, retour du réseau : envoi dans l'ordre, aucun doublon dans
  `review_logs` ; tuer l'app en plein envoi puis relancer ; téléphone décalé de plus de 5 minutes
  (note ramenée à l'heure du serveur) ; se déconnecter avec des notes en attente puis se connecter
  avec un autre compte : la note n'est pas envoyée.
- **Notifications** : dialogue Android 13 après création du canal, heure approximative (alarme
  inexacte), tap à froid et à chaud, redémarrage du téléphone, permission refusée, économiseur de
  batterie. Vérifier la fusion du manifeste (`POST_NOTIFICATIONS`, `RECEIVE_BOOT_COMPLETED`).
- **Écrans** : clavier en edge-to-edge (éditeur, import, mode écrit), TalkBack (annonces des
  cartes, une seule lecture par retournement), police 1,3, « réduire les animations », import UTF-8
  avec BOM accepté et ISO-8859-1 refusé (1 Mo), formats français (« 9 octobre 2026 »,
  « 1 200 cartes »), éditeur avec 2000 cartes, fluidité du retournement, bannières (double marge
  haute avec la barre d'état ?), `dismissTo` depuis les écrans de set et d'import, thème sombre.
- **Limites connues** : une réponse de refresh perdue alors que le serveur a fait tourner le jeton
  force une reconnexion ; une seule case de révocation en attente ; une réponse perdue après une
  note datée dans le futur (téléphone en avance de plus de 5 minutes) peut l'appliquer deux fois.

## Sources

- [Authelia – OAuth 2.0 Bearer Token Usage](https://www.authelia.com/integration/openid-connect/oauth-2.0-bearer-token-usage/)
- [Authelia – Proxy Authorization](https://www.authelia.com/reference/guides/proxy-authorization/)
- [Authelia – Server Authz Endpoints](https://www.authelia.com/configuration/miscellaneous/server-endpoints-authz/)
