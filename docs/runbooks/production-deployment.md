# CWC Production Deployment Runbook

Status: operational. This runbook documents the full workflow for deploying the latest `dev2.0` changes to the CWC production server.

## Purpose

Deploy new code to production safely. The critical constraint is that **code is baked into Docker images** — there is no host-mounted source and no Node.js on the prod host. A `git pull + restart` will NOT pick up code changes. You must rebuild the images, then recreate the containers.

## Server facts

| Item | Value |
|---|---|
| Host | `root@152.42.246.217` |
| Repo path | `/var/www/citadel-cwc-portal` |
| Branch | `dev2.0` |
| Compose file | `docker-compose.prod.yml` |
| Domain | `https://cwc.citadelgroup.com.my` |
| RAM | 2GB total (~960MB usable) — **build backend and frontend separately or OOM** |
| CPU | 1 vCPU |
| DB container | `citadel-cwc-portal-postgres-1` |
| DB | `help_center`, user `cwc_admin` |
| DB password | in `.env` on prod (never read/print it) |

## ⚠️ Critical rule: never deploy without explicit approval

Never commit, push, build, migrate, or deploy to production without the user explicitly saying to. Making code changes, verifying they compile, and running tests locally is fine — but the moment you'd touch production (git push, SSH to server, docker build, migrate, `up -d`), STOP and ask. This overrides everything else.

## Architecture: how deployment works

| Container | Mounts | Code source |
|---|---|---|
| `backend-1` | `uploads/` and `logs/` volumes only | Baked into Docker image |
| `frontend-1` | None | Baked into Docker image |
| `postgres-1` | `postgres_data` volume | Data persists in volume |
| `redis-1` | `redis_data` volume | Data persists in volume |
| `nginx-1` | Config files from host | Reverse proxy |
| `certbot-1` | Cert volumes | SSL auto-renewal |

The `backend/Dockerfile` is a multi-stage build that compiles TypeScript into `dist/`, then copies it into a production image. The `frontend/Dockerfile` builds the Vite app and copies static assets into an nginx image.

## Quick deploy checklist

1. **DB backup** — always dump before touching prod
2. **Commit & push** — push to `origin/dev2.0`
3. **Run `deploy.sh`** — automated full deploy, or manual steps below
4. **Verify** — health check + spot-check in browser

## Standard deployment procedure

Use this procedure for every production deployment. Production deployment
requires explicit approval before SSH, Docker builds, migrations, seeds, or
container restarts.

### 1. Local pre-flight

Run the checks from the repository root before touching production:

```bash
git status --short --branch
git fetch origin
git log -1 --oneline

cd backend
npm run build

cd ../frontend
npm run build
npx tsc --noEmit
```

Confirm the intended commit has been pushed:

```bash
git status --short --branch
git ls-remote origin refs/heads/dev2.0
```

### 2. Back up production first

Run from the local repository root. Do not proceed if the dump fails or is
empty:

```bash
mkdir -p backups
ssh root@152.42.246.217 \
  "docker exec citadel-cwc-portal-postgres-1 \
   pg_dump -U cwc_admin -d help_center \
   --no-owner --no-privileges" \
  > backups/prod_full_$(date +%Y%m%d_%H%M%S).sql

ls -lh backups/prod_full_*.sql
```

### 3. Choose the deployment path

Check whether the release changes Prisma schema or migrations:

```bash
git diff <previous-production-commit>..HEAD -- backend/prisma/
```

For code-only changes with no schema changes, use:

```bash
./deploy.sh --no-seed --no-migrate --no-cache --verbose
```

`--no-cache` is recommended for new backend/frontend code because Docker can
otherwise reuse stale image layers. `--no-seed` is the default and preserves
production-managed configuration. `--no-migrate` is safe only when there are
no schema changes.

For releases containing schema or migration changes, use:

```bash
./deploy.sh --no-seed --no-cache --verbose
```

Before this path, run the pre-deploy database audit described in the manual
procedure below when the release affects `tenant_id`, `CHECK` constraints, or
existing production data. If migration status reports a failed migration,
stop and resolve that migration deliberately; do not blindly use
`prisma db push --accept-data-loss`.

### 4. Seed only when explicitly required

Do not run the general seed for an ordinary code deployment. If seed data is
part of the approved release, use:

```bash
./deploy.sh --seed --no-cache --verbose
```

Production seed execution must preserve admin-managed configuration through
`RETAIN_ADMIN_CONFIG=true`. Never run demo-data clear scripts or destructive
reset commands against production.

### 5. Verify after deployment

```bash
ssh root@152.42.246.217 \
  "cd /var/www/citadel-cwc-portal && \
   docker compose -f docker-compose.prod.yml ps"

ssh root@152.42.246.217 \
  "docker exec citadel-cwc-portal-nginx-1 \
   curl -s -o /dev/null -w '%{http_code}' \
   http://backend:3000/health"

curl -sk https://cwc.citadelgroup.com.my/ \
  -o /dev/null -w '%{http_code}\n'
```

The backend health check should return `200`, and the public site should
return `200` or `301`.

For a schema deployment, also confirm:

```bash
ssh root@152.42.246.217 \
  "cd /var/www/citadel-cwc-portal && \
   docker compose -f docker-compose.prod.yml exec -T backend \
   npx prisma migrate status"
```

Finally, verify the actual changed feature in the browser, not only the
health endpoint. For frontend changes, hard-refresh with `Cmd+Shift+R` on
macOS or use a private window if the old bundle is cached.

### 6. Rollback

If the release must be rolled back, identify the last known-good commit:

```bash
ssh root@152.42.246.217 \
  "cd /var/www/citadel-cwc-portal && git log --oneline -10"
```

Then checkout that commit, rebuild both images separately with `--no-cache`,
and recreate the services. Restore the database only when the deployment
changed data/schema and the verified pre-deploy backup is required. Never use
`prisma migrate reset` or drop the production database as a routine rollback.

---

## Method A: deploy.sh (recommended)

A comprehensive deploy script exists at `deploy.sh` in the repo root. It runs **from your local machine** and SSHs into prod automatically. This is the simplest and safest way to deploy.

```bash
./deploy.sh                           # Full deploy: pre-flight + pull + Docker build + migrate + status backfill + health check
./deploy.sh --seed                    # Explicitly run the guarded database seed
./deploy.sh --no-seed                 # Skip database seed (default; preserves production config)
./deploy.sh --no-migrate              # Skip Prisma migrations (no schema changes)
./deploy.sh --no-cache                # Force Docker rebuild without cache (fixes stale images)
./deploy.sh --verbose                 # Detailed output
./deploy.sh --no-seed --no-migrate    # Just pull + build + restart
```

### What deploy.sh does (each step)

| Step | Action | Details |
|---|---|---|
| **0** | Pre-flight | Local `tsc --noEmit` check, warns on uncommitted changes, checks local vs remote commit sync |
| **1** | Git pull | `git fetch && git checkout dev2.0 && git pull origin dev2.0` on prod |
| **2** | Build backend | `docker compose -f docker-compose.prod.yml build backend` |
| **2b** | Verify code | Restarts backend, checks marker file to detect stale Docker cache |
| **3** | Migrate | `npx prisma migrate status` → resolve failed migrations → `npx prisma migrate deploy` → fallback `prisma db push` |
| **3c** | Status catalog backfill + verification | Creates only missing legacy status definitions; preserves all existing status labels, categories, lifecycle, active, and retired fields; fails closed on unresolved references |
| **4** | Seed (opt-in) | Only when `./deploy.sh --seed` is supplied; production seed requires `RETAIN_ADMIN_CONFIG=true` and skips admin-owned config mutations |
| **5** | Build frontend | `docker compose -f docker-compose.prod.yml build frontend` (slow on 2GB RAM) |
| **6** | Restart | `docker compose -f docker-compose.prod.yml up -d` |
| **7** | Health check | Backend HTTP 200 on `/health`, frontend HTTP 200/301 on public URL |

### deploy.sh limitations

- Does NOT run pre-deploy DB audit scripts. For schema changes involving CHECK constraints or `tenant_id`, run those manually before deploy.sh (see Method B step 4).
- For schema changes, run the pre-deploy audit first, then deploy.sh.

---

## Method B: manual step-by-step

If `deploy.sh` fails or you need fine-grained control:

### 1. DB backup (ALWAYS do this first)

```bash
ssh root@152.42.246.217 \
  "docker exec citadel-cwc-portal-postgres-1 \
   pg_dump -U cwc_admin -d help_center --no-owner --no-privileges" \
  > backups/prod_full_$(date +%Y%m%d_%H%M%S).sql
```

Or use the server-side script:

```bash
ssh root@152.42.246.217 "cd /var/www/citadel-cwc-portal && bash scripts/backup-db.sh"
```

### 2. Commit & push (local)

```bash
git add .
git commit -m "descriptive message"
git push origin dev2.0
```

### 3. Pull & build on production

```bash
ssh root@152.42.246.217
cd /var/www/citadel-cwc-portal
git stash                  # if local uncommitted changes exist
git pull origin dev2.0
git stash pop               # restore local changes

# Build backend first (uses ~1GB RAM)
docker compose -f docker-compose.prod.yml build backend

# Restart backend so new migrations are available inside the container
docker compose -f docker-compose.prod.yml up -d backend
```

**Wait for backend to be ready before proceeding:**

```bash
sleep 5
docker exec citadel-cwc-portal-nginx-1 curl -s -o /dev/null -w '%{http_code}' http://backend:3000/health
# Should return 200
```

### 4. Pre-deploy DB audit (CRITICAL — before migrate)

Always run these checks before `migrate deploy`. Skipping this can cause migrations to fail on CHECK constraints, ghost rows, or data mismatches.

```bash
# Copy fix scripts to prod
scp backups/pre-deploy-verify-prod.sql root@152.42.246.217:/tmp/
scp backups/pre-deploy-fix-prod.sql root@152.42.246.217:/tmp/
scp backups/post-deploy-verify-prod.sql root@152.42.246.217:/tmp/

# Step 1: Read-only audit — confirm state before changes
docker exec -i citadel-cwc-portal-postgres-1 psql -U cwc_admin -d help_center -f /tmp/pre-deploy-verify-prod.sql

# Step 2: Apply fixes (idempotent, transactional, NULL-backfill + ghost-row cleanup)
docker exec -i citadel-cwc-portal-postgres-1 psql -U cwc_admin -d help_center -f /tmp/pre-deploy-fix-prod.sql

# Step 3: Run migrations
docker exec citadel-cwc-portal-backend-1 npx prisma migrate deploy

# Step 4: Post-deploy verification
docker exec -i citadel-cwc-portal-postgres-1 psql -U cwc_admin -d help_center -f /tmp/post-deploy-verify-prod.sql
```

If `migrate deploy` fails on a specific migration, see "Prisma Migration Failures" in Pitfalls.

### 4b. Fallback: db push (only if migrate deploy fails)

```bash
docker exec citadel-cwc-portal-backend-1 npx prisma db push --accept-data-loss
```

After `db push`, backfill NULL `tenant_id` rows:

```bash
docker exec citadel-cwc-portal-postgres-1 psql -U cwc_admin -d help_center \
  -c "UPDATE requests SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;"
```

### 5. Run seed (if seed data changed)

```bash
docker exec citadel-cwc-portal-backend-1 npx tsx prisma/seed.ts
```

Watch for:
- `Notification templates created` — new templates added
- `Notification template fixes applied` — bug fixes applied
- `Database seeding completed` — full success

### 6. Build frontend

```bash
# Build frontend (slow — uses ~1.5GB RAM)
docker compose -f docker-compose.prod.yml build frontend

# If Docker cache is stale, rebuild without cache:
docker compose -f docker-compose.prod.yml build --no-cache frontend
```

### 7. Restart all containers

```bash
docker compose -f docker-compose.prod.yml up -d
# If nginx config changed:
docker compose -f docker-compose.prod.yml restart nginx
```

### 8. Verify

```bash
# Container status
docker compose -f docker-compose.prod.yml ps

# Backend health (via internal nginx proxy)
docker exec citadel-cwc-portal-nginx-1 curl -s -o /dev/null -w '%{http_code}' http://backend:3000/health
# Expect: 200

# Frontend accessibility
curl -sk https://cwc.citadelgroup.com.my/ -o /dev/null -w '%{http_code}'
# Expect: 200 or 301

# Schema sync check (always confirm after ANY backend deploy)
docker exec citadel-cwc-portal-backend-1 npx prisma migrate status
# Should output: "Database schema is up to date!"
```

---

## Post-deploy: "changes not visible" troubleshooting

### 1. Confirm code is actually in the container

```bash
# Search for a unique string from your changes in the compiled JS/CSS
docker compose -f docker-compose.prod.yml exec -T frontend sh -c 'grep -r "YOUR_UNIQUE_STRING" /usr/share/nginx/html/assets/*.js'
docker compose -f docker-compose.prod.yml exec -T backend sh -c 'grep -r "YOUR_UNIQUE_STRING" /app/dist/'
```

If strings ARE present → browser cache issue (step 3).

### 2. Check container is using the new image

```bash
docker inspect citadel-cwc-portal-frontend-1 --format '{{.Image}}'
docker images citadel-cwc-portal-frontend --format '{{.ID}}'
```

If they don't match, container wasn't recreated. Force recreate:

```bash
docker compose -f docker-compose.prod.yml up -d --force-recreate
```

### 3. Browser cache (most common cause)

Frontend nginx sets `Cache-Control: public, immutable` + `expires 1y` on JS/CSS. Vite uses content-hash filenames so a new build = new filename = fresh fetch. However the outer nginx reverse proxy or browser may cache `index.html` itself.

**Fix — tell user to hard-refresh:**
- Mac: Cmd+Shift+R
- Windows: Ctrl+Shift+R
- Or: DevTools → right-click refresh button → "Empty Cache and Hard Reload"
- Fallback: Incognito/Private window

---

## Rollback

If deploy goes wrong:

1. **Find the last good commit:**

   ```bash
   ssh root@152.42.246.217 "cd /var/www/citadel-cwc-portal && git log --oneline -10"
   ```

2. **Reset to previous commit:**

   ```bash
   ssh root@152.42.246.217 "cd /var/www/citadel-cwc-portal && git checkout <commit-hash>"
   ```

3. **Rebuild and restart:**

   ```bash
   ssh root@152.42.246.217 "cd /var/www/citadel-cwc-portal && docker compose -f docker-compose.prod.yml build --no-cache && docker compose -f docker-compose.prod.yml up -d"
   ```

4. **Restore DB if needed:**

   ```bash
   # On prod, terminate connections then restore
   ssh root@152.42.246.217
   docker exec -i citadel-cwc-portal-postgres-1 psql -U postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'help_center' AND pid <> pg_backend_pid();"
   docker exec -i citadel-cwc-portal-postgres-1 psql -U postgres -c "DROP DATABASE help_center;"
   docker exec -i citadel-cwc-portal-postgres-1 psql -U postgres -c "CREATE DATABASE help_center OWNER cwc_admin;"
   # Then pipe the backup SQL in:
   cat backups/prod_full_YYYYMMDD_HHMMSS.sql | ssh root@152.42.246.217 "docker exec -i citadel-cwc-portal-postgres-1 psql -U cwc_admin -d help_center"
   ```

---

## Production diagnostics

### Container uptime check

```bash
ssh root@152.42.246.217 "cd /var/www/citadel-cwc-portal && docker compose -f docker-compose.prod.yml ps --format 'table {{.Name}}\t{{.Status}}\t{{.State}}\t{{.Ports}}'"
```

Normal state: postgres, redis, nginx, certbot up 2-3+ weeks; backend up since last deploy; frontend up since last deploy; clamav up and healthy.

**If backend uptime is very short (< 5 min):** check if a deploy just happened or if the container crashed:

```bash
ssh root@152.42.246.217 "docker inspect citadel-cwc-portal-backend-1 --format 'RestartCount: {{.RestartCount}} StartedAt: {{.State.StartedAt}} ExitCode: {{.State.ExitCode}}'"
```

### Backend log inspection

```bash
# Recent backend logs (last N lines)
ssh root@152.42.246.217 "cd /var/www/citadel-cwc-portal && docker compose -f docker-compose.prod.yml logs backend --tail=200 --no-log-prefix"

# Filter for errors only (last 24h)
ssh root@152.42.246.217 "cd /var/www/citadel-cwc-portal && docker compose -f docker-compose.prod.yml logs backend --since=24h --no-log-prefix | grep -iE 'error|fail|crash|unhandled|reject|exception|fatal|panic'"

# Follow backend logs in real time
ssh root@152.42.246.217 "cd /var/www/citadel-cwc-portal && docker compose -f docker-compose.prod.yml logs backend --tail 100 -f"
```

**Important:** Docker container logs (`docker compose logs`) are the canonical source for recent output. The on-disk `backend/logs/` volume contains stale logs from local development (April-May era) and should NOT be relied on for current production errors.

### Known warning patterns

| Pattern | Severity | Action |
|---|---|---|
| `[TENANT_SCOPE] Unscoped findMany on tenant-scoped model X` | ⚠️ Deprecation | Queries lack tenant-scoping. Will break in future Prisma release. Add `where: { tenantId }` or use `runWithExecutionScope()`. |
| `Rate limiting: using in-memory store` | ⚠️ Config | `RATE_LIMIT_REDIS_ENABLED` not set, so rate limiter falls back to in-memory (lost on restart, not shared across instances). Set `RATE_LIMIT_REDIS_ENABLED=true` in prod. |
| `Resend error ... Too many requests` | ⚠️ Rate limit | Resend free tier caps at 2 req/s. Consider upgrading or implementing send queue/throttle. |

### Startup verification

After a backend restart, confirm these startup messages appear:

```
✅ Credit auto-audit Prisma middleware installed
Rate limiting: using in-memory store ...
🚀 Server running on port 3000 in production mode
📡 API available at http://localhost:3000/api/v1
🏥 Health check at http://localhost:3000/health
[WorkflowEngine] Started
[PdfWorker] Started (concurrency: 2)
[AttachmentScanner] Started (concurrency: 2)
Redis client connected (×5)
SSE: Redis pub/sub adapter initialized
SLA checker started (cron: 0 9 * * 1-5)
[Scheduler] Initialized 9 jobs
[SchedulerLock] Redis lock client connected
```

---

## Quick reference commands

```bash
# Check prod container status
ssh root@152.42.246.217 "cd /var/www/citadel-cwc-portal && docker compose -f docker-compose.prod.yml ps"

# View backend logs (follow)
ssh root@152.42.246.217 "cd /var/www/citadel-cwc-portal && docker compose -f docker-compose.prod.yml logs backend --tail 100 -f"

# Restart backend only (no rebuild — only picks up env changes, NOT code changes)
ssh root@152.42.246.217 "cd /var/www/citadel-cwc-portal && docker compose -f docker-compose.prod.yml restart backend"

# DB shell
ssh root@152.42.246.217 "docker exec -it citadel-cwc-portal-postgres-1 psql -U cwc_admin -d help_center"

# Check current commit on prod
ssh root@152.42.246.217 "cd /var/www/citadel-cwc-portal && git log --oneline -1"

# Disk + memory usage
ssh root@152.42.246.217 "df -h / && free -h"

# Quick DB backup
ssh root@152.42.246.217 "docker exec citadel-cwc-portal-postgres-1 pg_dump -U cwc_admin -d help_center --no-owner --no-privileges" > backups/prod_full_$(date +%Y%m%d_%H%M%S).sql
```

---

## Pitfalls

- **CODE IS BAKED INTO DOCKER IMAGES.** A simple `git pull + docker restart` will NOT deploy new code. You MUST `docker compose build` to bake new code into images, then `docker compose up -d` to restart with the new images.
- **OOM on build:** Always build backend then frontend separately. Frontend Dockerfile uses `NODE_OPTIONS="--max-old-space-size=1536"`. Never run both builds in parallel.
- **Docker build cache serves old code:** `COPY . .` layer can be cached even after `git pull`. Always verify new code is in the container (grep for a unique string). If stale, rebuild with `--no-cache`.
- **TS6133 (unused variable) breaks Docker build:** `npm run build` (tsc) inside the Docker container exits non-zero on TS6133. Local `tsc --noEmit` may pass but Docker build fails. Always run `npm run build` locally before deploying. Fix: remove the unused declaration.
- **Prisma migration fails on pre-existing objects:** If a previous `db push` created enum types or tables without recording a migration, `migrate deploy` fails with `42710` (already exists). Fix: `prisma migrate resolve --applied <name>` then re-run `migrate deploy`, then `db push` for remaining drift.
- **Git stash conflicts:** Production may have local uncommitted changes to `docker-compose.prod.yml` or `.env`. Always `git stash` before pull, `git stash pop` after.
- **Nginx restart needed:** If `nginx/conf.d/default.conf` changed, must `restart nginx` separately — `up -d` only recreates changed service containers.
- **No node/npm on host:** Always use `docker exec` for any Node commands inside the backend container.
- **Seed has pruning logic:** `seed.ts` deletes rows not in `SEED_WORKFLOW_TRANSITIONS`, `SEED_ONBOARDING_TEMPLATES`, and `SEED_OFFBOARDING_TEMPLATES`. Always add new transitions/templates to `seed-admin-config.ts` or data may be deleted. `lifecycleStatus` defaults to DRAFT but portal filters PUBLISHED — always set `lifecycleStatus: 'PUBLISHED'` in seed create/update.
- **✅ RETAIN_ADMIN_CONFIG is set in production (FIXED):** `deploy.sh` runs `RETAIN_ADMIN_CONFIG=true npx tsx prisma/seed.ts` and `docker-compose.prod.yml` sets `RETAIN_ADMIN_CONFIG: ${RETAIN_ADMIN_CONFIG:-true}`. The seed runs in safe mode by default in production — it skips pruning, uses `update: {}` no-ops for config tables, and only backfills structural fields (codes). To force a full re-seed on staging, set `RETAIN_ADMIN_CONFIG=false`.
- **✅ One-time migration cleanups gated behind RETAIN_ADMIN_CONFIG (FIXED):** The permission/role migration code (lines 423-612 of `seed.ts`) that removes deprecated permissions, merges deprecated roles, and deletes stale role-permission assignments is now wrapped in `if (!RETAIN_ADMIN_CONFIG) { ... }`. In production (where `RETAIN_ADMIN_CONFIG=true`), these cleanups are skipped entirely with a log message. They only run in development/staging where `RETAIN_ADMIN_CONFIG` is unset or false.
- **✅ Destructive seed scripts have production guards (FIXED):** `seed-clear-tickets.ts`, `seed-clear-credit.ts`, `seed-crm-demo-remove.ts` all refuse to run when `NODE_ENV=production` unless `ALLOW_PRODUCTION_DATA_CLEAR=true` is explicitly set. The `--clear` flag in `seed-credit.ts` has the same guard. `docker-compose.prod.yml` sets `NODE_ENV: production` so these guards activate automatically.
- **⚠️ Production user upserts still update metadata on every seed run:** The `SEED_PRODUCTION_USERS` section calls `prisma.user.update()` on existing users, overwriting `firstName`, `lastName`, `department`, `jobTitle`, `executiveRole`, `agentTeam`, `entityId`, and `isActive`. This can undo admin edits made through the UI. Consider making this create-only when `RETAIN_ADMIN_CONFIG=true` (skip update if user already exists).
- **docker-compose.prod.yml YAML duplicate keys crash Docker:** `docker-compose.prod.yml` already has `NODE_ENV: production` on line 63. Adding a second `NODE_ENV` entry causes `yaml: construct errors: mapping key already defined` and the entire `docker compose build` fails. Always check for existing keys before inserting env vars into the YAML.
- **✅ Notification template fixes gated behind RETAIN_ADMIN_CONFIG (FIXED):** `SEED_NOTIFICATION_TEMPLATE_FIXES` patches are now wrapped in `if (!RETAIN_ADMIN_CONFIG) { ... }`. In production, they are skipped with a log message. On dev/staging, they apply as before.
- **Never use `--force-reset` on prod DB.** It drops all data.
- **tenant_id backfill before CHECK constraints:** Migrations adding `CHECK (tenant_id IS NOT NULL)` will FAIL if any row has NULL tenant_id. Always audit and backfill first: `UPDATE <table> SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;`
- **Migration SQL must use snake_case:** Prisma schema uses camelCase (`referenceNumber`), PostgreSQL uses snake_case (`reference_number`). ALWAYS verify column/table names against `information_schema.columns` before writing migration SQL.
- **Notification tenant_id CHECK constraint:** After deploying `chk_notifications_tenant_id_required`, ALL `prisma.notification.create()` calls must include `tenantId`.
- **Seed scripts not in Docker image:** Scripts live in `backend/scripts/` but the Dockerfile only copies `dist/`, `node_modules/`, `package.json`, and `prisma/`. Must `docker cp` scripts into the container before running them.
- **Environment-specific UUIDs:** Production user IDs, territory IDs, and other FK targets differ from local dev. Always query and verify before seeding.
- **Prisma `upsert` requires schema-level `@@unique`, not SQL partial unique indexes:** If a model's uniqueness is enforced by a partial unique index (e.g. `CREATE UNIQUE INDEX … WHERE tenant_id IS NOT NULL`), Prisma's `upsert({ where: { key } })` will fail with `Argument 'where' needs at least one of 'id' arguments`. The `where` clause in `upsert` can only use fields that are `@id`, `@unique`, or part of a `@@unique` constraint in the Prisma schema — database-level partial indexes are invisible to it. Fix: replace `upsert` with `findFirst + create/update` (check-then-act) for any model that lacks a Prisma-level unique constraint on the desired field. **Hit in production:** FeatureFlag seed used `upsert({ where: { key } })` but `key` has no `@unique` — only a partial SQL unique index. Replaced with `findFirst({ where: { key, tenantId } })` + `create`/`update` pattern.
- **Deploy script code verification is a false positive:** Step 2b ("Verifying container has the latest code") runs `git rev-parse HEAD` inside the backend container, but the backend Docker image doesn't include `git`. The step prints a success marker even though the actual output is `exec: "git": executable file not found`. To verify code actually deployed, grep for a unique string from your changes in the compiled JS: `docker exec citadel-cwc-portal-backend-1 grep -r "YOUR_UNIQUE_STRING" /app/dist/`.
- **Migrations referencing not-yet-added columns will fail with `42703`:** ESM production-readiness migrations (tenant_department_rls, etc.) reference columns (`department_id`, `tenant_id` on `requests`, `service_desks`) and tables (`departments`) that don't exist in the production DB yet. `prisma migrate deploy` will fail with `ERROR: column r.department_id does not exist` or `ERROR: relation "departments" does not exist`. Fix: mark each failed migration as applied (`prisma migrate resolve --applied <name>`), then use `prisma db push --accept-data-loss` to sync the full schema. See "ESM Migration Deployment" below for the full recovery procedure.
- **`prisma db push --accept-data-loss` requires NOT NULL columns to have no NULL rows:** If the Prisma schema adds a required (`NOT NULL`) column to a table with existing rows, `db push` will refuse unless all rows have values. Backfill first: `UPDATE table SET col = default_value WHERE col IS NULL;`, then retry `db push`. For `request_attachments.tenant_id` and `department_id`, backfill from the parent `requests` row joined with `service_desks`.
- **`_prisma_migrations` accumulates entries with `finished_at IS NULL`:** These block new migrations from applying. After resolving all failed migrations with `prisma migrate resolve --applied`, also run: `UPDATE _prisma_migrations SET finished_at = NOW() WHERE finished_at IS NULL;` Duplicate entries (same migration_name appearing multiple times) are harmless once `finished_at` is set.
- **ESM Migration Deployment recovery procedure:** When `prisma migrate deploy` fails on ESM migrations that reference columns/tables not yet in the DB:
  1. Mark each failed migration as applied: `docker exec citadel-cwc-portal-backend-1 npx prisma migrate resolve --applied <migration_name>`
  2. Fix NULL `finished_at` entries: `docker exec citadel-cwc-portal-postgres-1 psql -U cwc_admin -d help_center -c "UPDATE _prisma_migrations SET finished_at = NOW() WHERE finished_at IS NULL;"`
  3. Backfill required columns that `db push` will make NOT NULL: `ALTER TABLE request_attachments ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'; ALTER TABLE request_attachments ADD COLUMN IF NOT EXISTS department_id UUID;`
  4. Backfill FK values: `UPDATE request_attachments ra SET department_id = sd.department_id FROM requests r JOIN service_desks sd ON sd.id = r.service_desk_id WHERE ra.request_id = r.id AND ra.department_id IS NULL;` (similarly for `requests.department_id` from `service_desks`)
  5. Run `prisma db push --accept-data-loss` to sync the full schema
  6. Run the seed: `docker exec citadel-cwc-portal-backend-1 npx tsx prisma/seed.ts`
  7. Verify: `docker exec citadel-cwc-portal-backend-1 npx prisma migrate status`
- **On-disk `backend/logs/` volume contains stale local dev logs:** The `backend_logs` Docker volume mounts to `/app/logs/` inside the container and persists across container restarts. In production, this volume often contains old `combined.log` and `error.log` files from local development runs (April-May era) that are NOT current. Docker container logs (`docker compose logs backend`) are the canonical source for production diagnostics. Do not `docker exec cat /app/logs/error.log` and assume those are recent production errors — check timestamps carefully.
- **Tenant-scope deprecation warnings will become hard errors:** Prisma logs `[TENANT_SCOPE] Unscoped findMany on tenant-scoped model X` when a query on a `@@tenant` model lacks a tenant filter. Currently a warning, but Prisma will reject these in a future release. Models flagged in production: `request`, `escalationRule`. Fix by adding `where: { tenantId }` to all findMany/findFirst calls on these models, or using `prisma.$runWithExecutionScope()`.
- **Rate limiting uses in-memory store (not Redis):** When `RATE_LIMIT_REDIS_ENABLED` is not set, rate limiting falls back to in-memory storage. This means rate limits reset on every container restart and are not shared across instances. Set `RATE_LIMIT_REDIS_ENABLED=true` and configure `REDIS_URL` to use the existing Redis instance for production rate limiting.
- **Backend port not exposed:** Port 3000 is internal to Docker network. Health check via `docker exec nginx curl backend:3000/health` or the public URL.
- **DB backup directory:** Always use `backups/` in the project root, not `~/` or `/tmp/`.
- **Always check for Prisma schema changes:** Before deploying, run `git diff <prev>..<curr> -- backend/prisma/` to see if any schema changes exist. If zero changes, skip migrations but still run `prisma migrate status` to confirm no drift.
- **Manual deploy sequence order matters:** The correct order is: (1) build backend, (2) restart backend with `up -d backend`, (3) run `prisma migrate deploy`, (4) run seed, (5) build frontend, (6) `up -d` all services. You MUST restart the backend container before running migrations — the old container image doesn't have the new migration files. Skipping the backend restart and going straight to migrate will fail or apply nothing.
- **Credit demo seed may skip on path resolution:** `npx tsx prisma/seed.ts` may print `⚠️  Credit demo seed skipped: Cannot find module '../src/credit/services/auditChain.service'`. This is because the seed imports from `src/` which isn't compiled into the Docker image. This is non-critical — the main seed and workflow transitions still apply. Only worry if you need the credit demo data specifically.
- **Docker build cache serves stale frontend:** After a `git pull` on prod, `docker compose build frontend` may use cached layers and produce an image with OLD JS. The `COPY . .` layer caches based on file hashes, but Docker's layer cache can still be stale. If Vite output hash is unchanged between builds (e.g. `index-BgohSKVL.js`), the frontend did NOT rebuild. **Always use `docker compose build --no-cache frontend`** when you see cached COPY steps, or verify by grepping for a unique string from your changes inside the container.
- **Response sanitizer destroying Date objects (CRITICAL — caused ALL dates to show "Invalid Date"):** The `stripSensitive()` function in `response-sanitizer.middleware.ts` recursively processes all objects. `typeof new Date() === 'object'` is true, so it falls through to `Object.entries(date) → {}`, converting every Date field (createdAt, updatedAt, publishedAt, etc.) to an empty object `{}`. Express then serializes `{}` as `{}`, and the frontend's `new Date({})` produces "Invalid Date". **Fix:** Add `if (obj instanceof Date) return obj as T;` before the generic object branch in any recursive sanitizer/serializer. This pattern applies to ANY middleware that wraps `res.json()` and recursively walks the response body — always handle `Date`, `RegExp`, `Buffer`, `Map`, `Set` before the plain-object branch.
- **PDF Export hangs forever ("Exporting..." → 60s timeout, no download):** If `enqueuePdf()` stores the job pending state under `pdf:result:{userId}:{jobId}` but the BullMQ job data omits `userId`, the worker writes the done result to `pdf:result:{jobId}` (legacy key) while `getPdfResult()` polls `pdf:result:{userId}:{jobId}` (user-scoped key) and always finds "pending". The frontend times out after 60s. **Fix:** ensure `pdfQueue.add('generate', { html, s3Key, userId })` includes `userId`. Audit all callers of `enqueuePdf()` to verify they pass `userId`.

---

## Local DB restore from production dump

To restore a production database dump into your local PostgreSQL for development/testing:

```bash
# 1. Dump from production (already covered in Method B step 1)
ssh root@152.42.246.217 \
  "docker exec citadel-cwc-portal-postgres-1 \
   pg_dump -U cwc_admin -d help_center --no-owner --no-privileges" \
  > backups/prod_full_$(date +%Y%m%d_%H%M%S).sql

# 2. Terminate local connections
PGPASSWORD="password" psql -h localhost -U postgres -d help_center -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'help_center' AND pid <> pg_backend_pid();"

# 3. Drop and recreate
PGPASSWORD="password" psql -h localhost -U postgres -c "DROP DATABASE IF EXISTS help_center;"
PGPASSWORD="password" psql -h localhost -U postgres -c "CREATE DATABASE help_center OWNER postgres;"

# 4. Restore
PGPASSWORD="password" psql -h localhost -U postgres -d help_center -f backups/prod_full_YYYYMMDD_HHMMSS.sql

# 5. Verify
PGPASSWORD="password" psql -h localhost -U postgres -d help_center -c \
  "SELECT count(*) as users FROM users; SELECT count(*) as requests FROM requests;"

# 6. Re-generate Prisma client (important!)
cd backend && npx prisma generate
```

**Note:** Local PostgreSQL must be running and accessible. The default local dev credentials are `postgresql://postgres:password@localhost:5432/help_center`. If `psql` is not on PATH, it's typically at `/opt/homebrew/Cellar/libpq/*/bin/psql`.
