#!/usr/bin/env bash
# ── CWC Production Deploy Script ─────────────────────────────
# Usage: ./deploy.sh [options]
#   --no-pull    Skip git pull (use when repo is already up to date)
#   --no-build   Skip docker build (use when images are current)
#   --no-migrate Skip Prisma migrations (use when no schema changes)
#   --no-seed    Skip database seed (use when no seed changes needed)
#   --no-cache   Force Docker build with --no-cache (avoids stale code)
#   --verbose    Enable verbose output
#
# This script:
#   0. Pre-flight checks (tsc compile, migration status)
#   1. Pulls latest code from dev2.0 branch
#   2. Rebuilds Docker containers (backend first, then frontend)
#   3. Verifies container has the new code (detects Docker cache issues)
#   4. Runs Prisma migrations (with failed-migration detection)
#   5. Syncs schema with prisma db push if needed
#   6. Runs database seed
#   7. Verifies seed applied critical changes (template fixes, new templates)
#   8. Restarts containers
#   9. Verifies health (backend + frontend)

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
NO_SEED=false
NO_CACHE=false
VERBOSE=false

for arg in "$@"; do
    case "$arg" in
        --no-pull)    NO_PULL=true ;;
        --no-build)   NO_BUILD=true ;;
        --no-migrate) NO_MIGRATE=true ;;
        --no-seed)    NO_SEED=true ;;
        --no-cache)   NO_CACHE=true ;;
        --verbose)    VERBOSE=true ;;
        *) echo "Unknown arg: $arg"; exit 1 ;;
    esac
done

log()  { echo "[$(date '+%H:%M:%S')] $*"; }
vlog() { $VERBOSE && echo "[$(date '+%H:%M:%S')] [verbose] $*" || true; }

# ── Helper: run command on prod via SSH ──────────────────────
ssh_exec() {
    ssh "$PROD_HOST" "cd $PROD_DIR && $1" 2>&1
}

# ── Helper: run command inside backend container ────────────
docker_exec() {
    ssh "$PROD_HOST" "cd $PROD_DIR && docker compose -f $COMPOSE_FILE exec -T backend $1" 2>&1
}

# ═══════════════════════════════════════════════════════════════
# Step 0: Pre-flight checks
# ═══════════════════════════════════════════════════════════════
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "Step 0: Pre-flight checks"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 0a. Local TypeScript compile check (catches errors before touching prod)
log "Checking local backend TypeScript compilation..."
LOCAL_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -f "$LOCAL_DIR/backend/package.json" ]; then
    TSC_OUTPUT=$(cd "$LOCAL_DIR/backend" && npx tsc --noEmit --pretty 2>&1) || true
    TSC_ERRORS=$(echo "$TSC_OUTPUT" | grep -c "error TS" || true)
    if [ "$TSC_ERRORS" -gt 0 ]; then
        log "❌ Local backend tsc has $TSC_ERRORS error(s) — fix these before deploying:"
        echo "$TSC_OUTPUT" | grep "error TS" | head -10
        log "Run: cd backend && npx tsc --noEmit"
        exit 1
    fi
    log "✅ Local backend TypeScript compiles clean"
else
    log "⚠️  backend/package.json not found locally — skipping tsc check"
fi

# 0b. Check for uncommitted changes (warn only, don't block)
if [ -d "$LOCAL_DIR/.git" ]; then
    UNCOMMITTED=$(cd "$LOCAL_DIR" && git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
    if [ "$UNCOMMITTED" -gt 0 ]; then
        log "⚠️  Warning: $UNCOMMITTED uncommitted file(s) in local repo — prod will use what's pushed to origin/$BRANCH"
    fi
fi

# 0c. Check local vs remote commit sync
if [ -d "$LOCAL_DIR/.git" ]; then
    cd "$LOCAL_DIR"
    git fetch origin "$BRANCH" --quiet 2>/dev/null || true
    LOCAL_AHEAD=$(git rev-list --count origin/$BRANCH..HEAD 2>/dev/null || echo "0")
    LOCAL_BEHIND=$(git rev-list --count HEAD..origin/$BRANCH 2>/dev/null || echo "0")
    if [ "$LOCAL_AHEAD" -gt 0 ]; then
        log "⚠️  Warning: local $BRANCH is $LOCAL_AHEAD commit(s) ahead of origin — push before deploying"
    fi
    if [ "$LOCAL_BEHIND" -gt 0 ]; then
        log "⚠️  Warning: local $BRANCH is $LOCAL_BEHIND commit(s) behind origin — pull before deploying"
    fi
    cd - >/dev/null
fi

log "✅ Pre-flight checks passed"

# ═══════════════════════════════════════════════════════════════
# Step 1: Pull latest code
# ═══════════════════════════════════════════════════════════════
if [ "$NO_PULL" = false ]; then
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log "Step 1: Pulling latest code from $BRANCH..."
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    PULL_OUTPUT=$(ssh_exec "git fetch origin && git checkout $BRANCH && git pull origin $BRANCH")
    vlog "$PULL_OUTPUT"
    log "✅ Code updated."

    # Show the latest commit hash for verification
    LATEST_HASH=$(ssh_exec "git rev-parse --short HEAD")
    log "   Latest commit on prod: $LATEST_HASH"
else
    log "⏭️  Skipping git pull (--no-pull)."
fi

# ═══════════════════════════════════════════════════════════════
# Step 2: Build backend container
# ═══════════════════════════════════════════════════════════════
if [ "$NO_BUILD" = false ]; then
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log "Step 2: Building backend container..."
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    BUILD_FLAG=""
    if [ "$NO_CACHE" = true ]; then
        log "   Using --no-cache (forcing fresh build)..."
        BUILD_FLAG="--no-cache"
    fi
    BUILD_OUTPUT=$(ssh_exec "docker compose -f $COMPOSE_FILE build $BUILD_FLAG backend" 2>&1) || {
        log "❌ Backend Docker build failed:"
        echo "$BUILD_OUTPUT" | tail -20
        log "Check full output: ssh $PROD_HOST 'cd $PROD_DIR && docker compose -f $COMPOSE_FILE build $BUILD_FLAG backend'"
        exit 1
    }
    vlog "$BUILD_OUTPUT"
    log "✅ Backend built."
else
    log "⏭️  Skipping build (--no-build)."
fi

# ═══════════════════════════════════════════════════════════════
# Step 2b: Restart backend to pick up new image, then verify code
# ═══════════════════════════════════════════════════════════════
if [ "$NO_BUILD" = false ]; then
    log "Restarting backend container to load new image..."
    ssh_exec "docker compose -f $COMPOSE_FILE up -d backend" >/dev/null 2>&1
    sleep 3

    # Verify container has the latest code by checking a known marker file
    log "Verifying container has the latest code..."
    PROD_HASH=$(ssh_exec "docker compose -f $COMPOSE_FILE exec -T backend git rev-parse --short HEAD 2>/dev/null || echo 'unknown'" | tr -d '[:space:]')
    if [ "$PROD_HASH" = "unknown" ]; then
        # No git in container — check by file content marker instead
        MARKER=$(ssh_exec "docker compose -f $COMPOSE_FILE exec -T backend grep -c 'SEED_NOTIFICATION_TEMPLATE_FIXES' prisma/seed.ts 2>/dev/null || echo '0'" | tr -d '[:space:]')
        if [ "$MARKER" -gt 0 ] 2>/dev/null; then
            log "✅ Container code verified (template fixes marker found)"
        else
            log "⚠️  Warning: Container may have stale code (marker not found)"
            log "   If seed produces no new templates, rebuild with: ./deploy.sh --no-cache --no-migrate --no-seed"
        fi
    else
        log "✅ Container code verified (commit: $PROD_HASH)"
    fi
fi

# ═══════════════════════════════════════════════════════════════
# Step 3: Run Prisma migrations
# ═══════════════════════════════════════════════════════════════
if [ "$NO_MIGRATE" = false ]; then
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log "Step 3: Prisma migrations"
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    # 3a. Check migration status first
    log "Checking migration status..."
    STATUS_OUTPUT=$(docker_exec "npx prisma migrate status" 2>&1)
    vlog "$STATUS_OUTPUT"

    # Detect failed migrations
    FAILED_MIGRATIONS=$(echo "$STATUS_OUTPUT" | grep -c "failed" || true)
    if [ "$FAILED_MIGRATIONS" -gt 0 ]; then
        log "⚠️  Detected failed migrations in the database. Attempting auto-resolve..."

        # Extract failed migration names and mark them as applied
        FAILED_NAMES=$(echo "$STATUS_OUTPUT" | grep -oP '[\d]{14}_[a-z0-9_]+' || true)
        for MIG_NAME in $FAILED_NAMES; do
            log "   Resolving failed migration: $MIG_NAME"
            docker_exec "npx prisma migrate resolve --applied $MIG_NAME" >/dev/null 2>&1 || {
                log "❌ Failed to resolve migration $MIG_NAME — manual intervention required"
                log "   Run: ssh $PROD_HOST 'cd $PROD_DIR && docker compose -f $COMPOSE_FILE exec -T backend npx prisma migrate resolve --applied $MIG_NAME'"
                exit 1
            }
            log "   ✅ Resolved: $MIG_NAME"
        done
        log "✅ All failed migrations resolved."
    fi

    # 3b. Apply pending migrations
    log "Applying pending migrations..."
    MIGRATE_OUTPUT=$(docker_exec "npx prisma migrate deploy" 2>&1) || {
        log "❌ Prisma migrate deploy failed:"
        echo "$MIGRATE_OUTPUT" | tail -15
        exit 1
    }
    vlog "$MIGRATE_OUTPUT"

    # Check if migrations actually applied or if there was a silent error
    if echo "$MIGRATE_OUTPUT" | grep -q "already exists\|does not exist\|P3009\|P3014"; then
        log "⚠️  Migration issues detected — running prisma db push to sync schema..."
        PUSH_OUTPUT=$(docker_exec "npx prisma db push" 2>&1) || {
            log "❌ prisma db push also failed:"
            echo "$PUSH_OUTPUT" | tail -15
            exit 1
        }
        vlog "$PUSH_OUTPUT"
        log "✅ Schema synced with db push."
    else
        log "✅ Migrations applied."
    fi
else
    log "⏭️  Skipping migrations (--no-migrate)."
fi

# ═══════════════════════════════════════════════════════════════
# Step 4: Run database seed
# ═══════════════════════════════════════════════════════════════
if [ "$NO_SEED" = false ]; then
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log "Step 4: Database seed"
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    SEED_OUTPUT=$(docker_exec "npx tsx prisma/seed.ts" 2>&1) || {
        log "❌ Database seed failed:"
        echo "$SEED_OUTPUT" | tail -15
        log "   The app may still work with existing data, but new templates/configs won't be applied."
        log "   Check the error and fix before continuing."
        exit 1
    }
    vlog "$SEED_OUTPUT"

    # Check for key seed success markers
    if echo "$SEED_OUTPUT" | grep -q "Notification template fixes applied"; then
        log "✅ Notification template fixes applied"
    fi
    if echo "$SEED_OUTPUT" | grep -q "Notification templates created"; then
        log "✅ Notification templates seeded"
    fi
    if echo "$SEED_OUTPUT" | grep -q "🎉 Database seeding completed"; then
        log "✅ Database seed completed."
    else
        log "⚠️  Seed may not have completed fully — check output for errors"
    fi
else
    log "⏭️  Skipping seed (--no-seed)."
fi

# ═══════════════════════════════════════════════════════════════
# Step 5: Build frontend container
# ═══════════════════════════════════════════════════════════════
if [ "$NO_BUILD" = false ]; then
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log "Step 5: Building frontend container (960MB RAM — this takes a while)..."
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    BUILD_FLAG=""
    if [ "$NO_CACHE" = true ]; then
        BUILD_FLAG="--no-cache"
    fi
    FE_BUILD_OUTPUT=$(ssh_exec "docker compose -f $COMPOSE_FILE build $BUILD_FLAG frontend" 2>&1) || {
        log "❌ Frontend Docker build failed:"
        echo "$FE_BUILD_OUTPUT" | tail -20
        exit 1
    }
    vlog "$FE_BUILD_OUTPUT"
    log "✅ Frontend built."
fi

# ═══════════════════════════════════════════════════════════════
# Step 6: Restart all containers
# ═══════════════════════════════════════════════════════════════
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "Step 6: Restarting all containers..."
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
ssh_exec "docker compose -f $COMPOSE_FILE up -d" >/dev/null 2>&1

log "Waiting for backend to be ready..."
sleep 8

# ═══════════════════════════════════════════════════════════════
# Step 7: Health checks
# ═══════════════════════════════════════════════════════════════
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "Step 7: Health checks"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 7a. Backend health (via nginx → backend container, since backend port is internal)
HEALTH=$(ssh "$PROD_HOST" "docker exec citadel-cwc-portal-nginx-1 curl -s -o /dev/null -w '%{http_code}' http://backend:3000/health 2>/dev/null" 2>/dev/null || echo "000")
if [ "$HEALTH" = "200" ]; then
    log "✅ Backend healthy (HTTP 200)"
else
    log "❌ Backend health check failed (HTTP $HEALTH)"
    log "   Check logs: ssh $PROD_HOST 'cd $PROD_DIR && docker compose -f $COMPOSE_FILE logs backend --tail 50'"
    exit 1
fi

# 7b. Frontend health
FE_STATUS=$(ssh "$PROD_HOST" "curl -s -o /dev/null -w '%{http_code}' https://cwc.citadelgroup.com.my/ --insecure" 2>/dev/null || echo "000")
if [ "$FE_STATUS" = "200" ] || [ "$FE_STATUS" = "301" ]; then
    log "✅ Frontend accessible (HTTP $FE_STATUS)"
else
    log "⚠️  Frontend returned HTTP $FE_STATUS (may need manual check)"
fi

# 7c. Container status summary
log ""
log "Container status:"
ssh "$PROD_HOST" "cd $PROD_DIR && docker compose -f $COMPOSE_FILE ps --format 'table {{.Name}}\t{{.Status}}'" 2>/dev/null | while read -r line; do
    log "  $line"
done

# ═══════════════════════════════════════════════════════════════
# Done
# ═══════════════════════════════════════════════════════════════
log ""
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "✅ Deploy complete!"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log ""
log "Post-deploy verification commands:"
log "  Backend logs:  ssh $PROD_HOST 'cd $PROD_DIR && docker compose -f $COMPOSE_FILE logs backend --tail 50'"
log "  Frontend logs: ssh $PROD_HOST 'cd $PROD_DIR && docker compose -f $COMPOSE_FILE logs frontend --tail 20'"
log "  DB check:      ssh $PROD_HOST 'cd $PROD_DIR && docker compose -f $COMPOSE_FILE exec -T backend npx prisma studio'"