#!/bin/sh
# Sauvegardes PostgreSQL de Quizlet. Tourne dans l'image postgres:17-alpine (pg_dump et
# pg_restore de la même version majeure que le serveur), monté en lecture seule.
#
#   backup.sh daemon                    sauvegarde quotidienne à BACKUP_TIME (par défaut)
#   backup.sh backup                    sauvegarde immédiate, puis rotation
#   backup.sh restore FICHIER [--yes]   remplace tout le contenu de la base par FICHIER
#   backup.sh verify FICHIER            restaure FICHIER dans une base temporaire et l'inspecte
#
# FICHIER : nom d'une sauvegarde de /backups, ou chemin complet dans le conteneur.
# Connexion par les variables libpq (PGHOST, PGUSER, PGPASSWORD, PGDATABASE) : aucun secret ici.
set -eu

DIR=/backups
PREFIX=quizlet
DATABASE=${PGDATABASE:-quizlet}
BACKUP_TIME=${BACKUP_TIME:-03:00}
BACKUP_RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-14}

log() { printf '%s [backup] %s\n' "$(date '+%Y-%m-%d %H:%M:%S %Z')" "$*"; }
fail() {
  log "ERREUR : $*" >&2
  exit 1
}

case "$BACKUP_TIME" in
  [01][0-9]:[0-5][0-9] | 2[0-3]:[0-5][0-9]) ;;
  *) fail "BACKUP_TIME doit être une heure HH:MM (reçu : « $BACKUP_TIME »)" ;;
esac
case "$BACKUP_RETENTION_DAYS" in
  '' | *[!0-9]* | 0) fail "BACKUP_RETENTION_DAYS doit être un nombre de jours ≥ 1 (reçu : « $BACKUP_RETENTION_DAYS »)" ;;
esac

# Vrai s'il existe une sauvegarde de moins de $1 minutes.
recent() {
  find "$DIR" -maxdepth 1 -type f -name "$PREFIX-*.dump" -mmin "-$1" | grep -q .
}

# Supprime les sauvegardes plus anciennes que la rétention. Appelée seulement après une sauvegarde
# réussie : la plus récente n'est donc jamais supprimée.
rotate() {
  find "$DIR" -maxdepth 1 -type f -name "$PREFIX-*.dump" -mmin "+$((BACKUP_RETENTION_DAYS * 1440))" |
    while read -r old; do
      rm -f "$old" && log "Rotation : $(basename "$old") supprimée (plus de $BACKUP_RETENTION_DAYS jours)"
    done
  # Restes d'une sauvegarde interrompue.
  find "$DIR" -maxdepth 1 -type f -name "$PREFIX-*.dump.partial" -mmin +60 -delete
}

backup() {
  [ -w "$DIR" ] || fail "$DIR n'est pas accessible en écriture"
  file="$DIR/$PREFIX-$(date '+%Y-%m-%dT%H%M%S').dump"
  log "Sauvegarde de « $DATABASE » vers $(basename "$file")…"
  # Fichier .partial renommé seulement en cas de succès : un fichier .dump est toujours complet.
  if ! pg_dump --format=custom --file="$file.partial" "$DATABASE"; then
    rm -f "$file.partial"
    log "ERREUR : échec de pg_dump, aucune sauvegarde écrite" >&2
    return 1
  fi
  mv "$file.partial" "$file"
  log "Sauvegarde terminée : $(basename "$file") ($(du -h "$file" | cut -f1))"
  rotate
}

daemon() {
  trap 'log "Arrêt demandé."; exit 0' TERM INT
  log "Sauvegarde quotidienne à $BACKUP_TIME (${TZ:-UTC}), rétention de $BACKUP_RETENTION_DAYS jours."
  # Au démarrage (installation, longue interruption) : sauvegarde si la dernière a plus de 26 h.
  recent 1560 || backup || true
  while :; do
    if [ "$(date +%H:%M)" = "$BACKUP_TIME" ] && ! recent 60; then
      backup || true
    fi
    sleep 30 &
    wait $!
  done
}

resolve() {
  [ -n "${1:-}" ] || fail "indiquez un fichier de sauvegarde (ex. : $PREFIX-2026-10-14T030000.dump)"
  case "$1" in
    */*) path=$1 ;;
    *) path="$DIR/$1" ;;
  esac
  [ -f "$path" ] || fail "sauvegarde introuvable : $path"
  printf '%s\n' "$path"
}

restore() {
  file=$(resolve "${1:-}")
  if [ "${2:-}" != "--yes" ]; then
    printf 'Restaurer %s dans « %s » ? Toutes les données actuelles seront remplacées.\nTapez RESTAURER pour confirmer : ' "$(basename "$file")" "$DATABASE"
    read -r answer || answer=''
    [ "$answer" = "RESTAURER" ] || fail "restauration annulée"
  fi
  # 1. Lecture complète de l'archive avant de toucher à la base : une sauvegarde corrompue échoue ici.
  pg_restore --no-owner --file=/tmp/restore.sql "$file" || fail "sauvegarde illisible : la base n'a pas été modifiée"
  # 2. Remplacement de tout le contenu en une transaction : les tables plus récentes que la
  #    sauvegarde disparaissent aussi, et l'API réapplique ensuite les migrations manquantes.
  cat >/tmp/restore-prepare.sql <<'SQL'
DROP SCHEMA IF EXISTS drizzle CASCADE;
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public AUTHORIZATION pg_database_owner;
GRANT USAGE ON SCHEMA public TO PUBLIC;
SQL
  log "Restauration de $(basename "$file") dans « $DATABASE »…"
  psql -X -q -v ON_ERROR_STOP=1 --single-transaction --dbname="$DATABASE" \
    --file=/tmp/restore-prepare.sql --file=/tmp/restore.sql >/dev/null ||
    fail "échec de la restauration : transaction annulée, la base est inchangée"
  rm -f /tmp/restore.sql /tmp/restore-prepare.sql
  log "Restauration terminée."
}

verify() {
  file=$(resolve "${1:-}")
  tmpdb="${DATABASE}_verify_$$"
  trap 'dropdb --if-exists "$tmpdb" >/dev/null 2>&1 || true' EXIT
  log "Vérification de $(basename "$file") dans la base temporaire « $tmpdb »…"
  createdb "$tmpdb" || fail "impossible de créer la base temporaire"
  pg_restore --no-owner --exit-on-error --dbname="$tmpdb" "$file" ||
    fail "la restauration a échoué : sauvegarde inutilisable"
  psql -X -q -A -t -v ON_ERROR_STOP=1 --dbname="$tmpdb" -c "
    SELECT 'migrations appliquées : ' || count(*) FROM drizzle.__drizzle_migrations
    UNION ALL SELECT 'utilisateurs : ' || count(*) FROM users
    UNION ALL SELECT 'sets : ' || count(*) FROM sets
    UNION ALL SELECT 'cartes : ' || count(*) FROM cards" |
    while read -r line; do log "  $line"; done
  log "Sauvegarde valide : $(basename "$file")."
}

command=${1:-daemon}
[ "$#" -gt 0 ] && shift
case "$command" in
  daemon) daemon ;;
  backup) backup ;;
  restore) restore "$@" ;;
  verify) verify "$@" ;;
  *) fail "commande inconnue : $command (daemon, backup, restore FICHIER [--yes] ou verify FICHIER)" ;;
esac
