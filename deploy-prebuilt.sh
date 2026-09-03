#!/usr/bin/env bash
set -euo pipefail

PROD_HOST="root@152.42.246.217"
PROD_DIR="/var/www/citadel-cwc-portal"
COMPOSE_FILE="docker-compose.prod.yml"
REGISTRY="ghcr.io/cgt-tech-admin"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="$SCRIPT_DIR/backups"

usage() {
  printf 'Usage: %s --sha <40-char-commit-sha> [--no-migrate]\n' "$0"
  printf 'Requires GHCR read access configured on production. Never builds on production.\n'
}

SHA=""
NO_MIGRATE=false
while [ "$#" -gt 0 ]; do
  case "$1" in
    --sha) SHA="${2:-}"; shift 2 ;;
    --no-migrate) NO_MIGRATE=true; shift ;;
    -h|--help) usage; exit 0 ;;
    *) printf 'Unknown argument: %s\n' "$1" >&2; usage >&2; exit 2 ;;
  esac
done

if [[ ! "$SHA" =~ ^[0-9a-f]{40}$ ]]; then
  printf 'Refusing deploy: --sha must be an exact 40-character lowercase commit SHA.\n' >&2
  exit 2
fi

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
stamp=$(date +%Y%m%d_%H%M%S)
backup="$BACKUP_DIR/prod_prebuilt_${stamp}.sql"
printf 'Taking production backup: %s\n' "$backup"
ssh -o BatchMode=yes "$PROD_HOST" "docker exec citadel-cwc-portal-postgres-1 pg_dump -U cwc_admin -d help_center --no-owner --no-privileges" > "$backup"
chmod 600 "$backup"

remote() { ssh -o BatchMode=yes "$PROD_HOST" "cd $PROD_DIR && $1"; }

printf 'Checking production checkout and preserving server-local files...\n'
remote "git fetch origin dev2.0 && git checkout dev2.0 && git pull --ff-only origin dev2.0 && test \"\$(git rev-parse HEAD)\" = \"$SHA\""

backend_image="$REGISTRY/citadel-cwc-portal-backend:$SHA"
frontend_image="$REGISTRY/citadel-cwc-portal-frontend:$SHA"

printf 'Pulling immutable images (no production build)...\n'
if ! remote "BACKEND_IMAGE='$backend_image' FRONTEND_IMAGE='$frontend_image' docker compose -f $COMPOSE_FILE pull backend frontend"; then
  printf 'Image pull failed. Configure read-only GHCR access on production, then rerun this command.\n' >&2
  printf 'Required images: %s and %s\n' "$backend_image" "$frontend_image" >&2
  exit 1
fi
remote "BACKEND_IMAGE='$backend_image' FRONTEND_IMAGE='$frontend_image' docker compose -f $COMPOSE_FILE up -d --no-build backend"

printf 'Verifying backend health before schema work...\n'
ssh -o BatchMode=yes "$PROD_HOST" "docker exec citadel-cwc-portal-nginx-1 curl -fsS -o /dev/null -w '%{http_code}' http://backend:3000/health" | grep -qx 200

if [ "$NO_MIGRATE" = false ]; then
  printf 'Applying Prisma migrations from the new backend image...\n'
  remote "BACKEND_IMAGE='$backend_image' FRONTEND_IMAGE='$frontend_image' docker compose -f $COMPOSE_FILE exec -T backend npx prisma migrate deploy"
else
  printf 'Skipping migrations (--no-migrate).\n'
fi

remote "BACKEND_IMAGE='$backend_image' FRONTEND_IMAGE='$frontend_image' docker compose -f $COMPOSE_FILE pull frontend && BACKEND_IMAGE='$backend_image' FRONTEND_IMAGE='$frontend_image' docker compose -f $COMPOSE_FILE up -d --no-build backend frontend"

printf 'Running final verification...\n'
remote "BACKEND_IMAGE='$backend_image' FRONTEND_IMAGE='$frontend_image' docker compose -f $COMPOSE_FILE ps --format 'table {{.Name}}\t{{.State}}\t{{.Status}}'"
ssh -o BatchMode=yes "$PROD_HOST" "docker exec citadel-cwc-portal-nginx-1 curl -fsS -o /dev/null -w '%{http_code}' http://backend:3000/health" | grep -qx 200
curl -skS -o /dev/null -w '%{http_code}' https://cwc.citadelgroup.com.my/ | grep -Eq '^(200|301)$'
remote "BACKEND_IMAGE='$backend_image' FRONTEND_IMAGE='$frontend_image' docker compose -f $COMPOSE_FILE exec -T backend npx prisma migrate status"
remote "docker inspect citadel-cwc-portal-backend-1 --format '{{.Config.Image}} {{.State.Running}} {{.RestartCount}}'"
remote "docker inspect citadel-cwc-portal-frontend-1 --format '{{.Config.Image}} {{.State.Running}} {{.RestartCount}}'"

printf 'Prebuilt deployment completed. Backup: %s\n' "$backup"
