#!/usr/bin/env bash
# ── CWC Production Deploy Script ─────────────────────────────
# Usage: ./deploy.sh [options]
#   --no-pull    Skip git pull (use when repo is already up to date)
#   --no-build   Skip docker build (use when images are current)
#   --no-migrate Skip Prisma migrations (use when no schema changes)
#   --verbose    Enable verbose output
#
# This script:
#   1. Pulls latest code from dev2.0 branch
#   2. Rebuilds Docker containers (backend first, then frontend)
#   3. Runs Prisma migrations
#   4. Restarts containers
#   5. Verifies health

set -euo pipefail

# ── Config ──────────────────────────────────────────────────
PROD_HOST="root@152.42.246.217"
PROD_DIR="/var/www/citadel-cwc-portal"
COMPOSE_FILE="docker-compose.prod.yml"
BRANCH="dev2.0"

# ── Parse Args ──────────────────────────────────────────────
NO_PULL=false
NO_BUILD=false
NO_MIGRATE=false
VERBOSE=false

for arg in "$@"; do
    case "$arg" in
        --no-pull)    NO_PULL=true ;;
        --no-build)   NO_BUILD=true ;;
        --no-migrate) NO_MIGRATE=true ;;
        --verbose)    VERBOSE=true ;;
        *) echo "Unknown arg: $arg"; exit 1 ;;
    esac
done

log()  { echo "[$(date '+%H:%M:%S')] $*"; }
vlog() { $VERBOSE && echo "[$(date '+%H:%M:%S')] [verbose] $*" || true; }

# ── Step 1: Pull latest code ────────────────────────────────
if [ "$NO_PULL" = false ]; then
    log "Pulling latest code from $BRANCH..."
    ssh "$PROD_HOST" "cd $PROD_DIR && git fetch origin && git checkout $BRANCH && git pull origin $BRANCH"
    log "Code updated."
else
    log "Skipping git pull (--no-pull)."
fi

# ── Step 2: Build backend ────────────────────────────────────
if [ "$NO_BUILD" = false ]; then
    log "Building backend container (this may take a few minutes)..."
    ssh "$PROD_HOST" "cd $PROD_DIR && docker compose -f $COMPOSE_FILE build backend" 2>&1 | tail -5
    log "Backend built."
else
    log "Skipping build (--no-build)."
fi

# ── Step 3: Run migrations ──────────────────────────────────
if [ "$NO_MIGRATE" = false ]; then
    log "Running Prisma migrations..."
    ssh "$PROD_HOST" "cd $PROD_DIR && docker compose -f $COMPOSE_FILE exec -T backend npx prisma migrate deploy" 2>&1 | tail -10
    log "Migrations applied."
else
    log "Skipping migrations (--no-migrate)."
fi

# ── Step 4: Build frontend ───────────────────────────────────
if [ "$NO_BUILD" = false ]; then
    log "Building frontend container (960MB RAM — this takes a while)..."
    ssh "$PROD_HOST" "cd $PROD_DIR && docker compose -f $COMPOSE_FILE build frontend" 2>&1 | tail -5
    log "Frontend built."
fi

# ── Step 5: Restart containers ───────────────────────────────
log "Restarting all containers..."
ssh "$PROD_HOST" "cd $PROD_DIR && docker compose -f $COMPOSE_FILE up -d"

log "Waiting for backend to be ready..."
sleep 5

# ── Step 6: Health check ─────────────────────────────────────
log "Running health check..."
HEALTH=$(ssh "$PROD_HOST" "curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/health" 2>/dev/null || echo "000")
if [ "$HEALTH" = "200" ]; then
    log "✅ Backend healthy (HTTP 200)"
else
    log "❌ Backend health check failed (HTTP $HEALTH)"
    log "Check logs: ssh $PROD_HOST 'cd $PROD_DIR && docker compose -f $COMPOSE_FILE logs backend --tail 50'"
    exit 1
fi

# ── Step 7: Verify frontend ──────────────────────────────────
FE_STATUS=$(ssh "$PROD_HOST" "curl -s -o /dev/null -w '%{http_code}' https://cwc.citadelgroup.com.my/ --insecure" 2>/dev/null || echo "000")
if [ "$FE_STATUS" = "200" ] || [ "$FE_STATUS" = "301" ]; then
    log "✅ Frontend accessible (HTTP $FE_STATUS)"
else
    log "⚠️  Frontend returned HTTP $FE_STATUS (may need manual check)"
fi

log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "Deploy complete!"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"