# Plan 1: Critical Security & DevOps Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish production-grade deployment infrastructure, tighten security, and add database backup strategy so the system can be safely deployed.

**Architecture:** Dockerfile for backend + frontend, GitHub Actions CI pipeline for lint/build, production-hardened rate limits and security headers, database backup script.

**Tech Stack:** Docker, GitHub Actions, PostgreSQL pg_dump, Node.js, Express, Prisma

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `backend/Dockerfile` | Backend container image |
| Create | `frontend/Dockerfile` | Frontend container image (nginx) |
| Create | `frontend/nginx.conf` | Nginx config for SPA routing |
| Create | `docker-compose.prod.yml` | Production compose with all services |
| Create | `.github/workflows/ci.yml` | CI pipeline: lint, build, test |
| Modify | `backend/src/middleware/rateLimit.middleware.ts` | Tighten auth rate limits |
| Modify | `backend/src/config/index.ts` | Add production config validation |
| Create | `scripts/backup-db.sh` | Database backup script |
| Create | `backend/.dockerignore` | Exclude node_modules, .env from image |
| Create | `frontend/.dockerignore` | Exclude node_modules from image |

---

### Task 1: Backend Dockerfile

**Files:**
- Create: `backend/Dockerfile`
- Create: `backend/.dockerignore`

- [ ] **Step 1: Create `.dockerignore`**

```
node_modules
dist
.env
.env.*
logs
coverage
uploads
```

- [ ] **Step 2: Create `backend/Dockerfile`**

```dockerfile
# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci
RUN npx prisma generate
COPY . .
RUN npm run build

# Stage 2: Production
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma ./prisma
RUN mkdir -p uploads logs
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

- [ ] **Step 3: Build and verify the image**

Run: `cd backend && docker build -t cwc2-backend:test .`
Expected: Successful build with no errors

- [ ] **Step 4: Commit**

```bash
git add backend/Dockerfile backend/.dockerignore
git commit -m "feat: add backend Dockerfile with multi-stage build"
```

---

### Task 2: Frontend Dockerfile

**Files:**
- Create: `frontend/Dockerfile`
- Create: `frontend/.dockerignore`
- Create: `frontend/nginx.conf`

- [ ] **Step 1: Create `frontend/.dockerignore`**

```
node_modules
dist
.env
.env.*
```

- [ ] **Step 2: Create `frontend/nginx.conf`**

```nginx
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;
    gzip_min_length 256;

    # SPA fallback - all routes serve index.html (HashRouter handles client routing)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
}
```

- [ ] **Step 3: Create `frontend/Dockerfile`**

```dockerfile
# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Serve
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

- [ ] **Step 4: Commit**

```bash
git add frontend/Dockerfile frontend/.dockerignore frontend/nginx.conf
git commit -m "feat: add frontend Dockerfile with nginx SPA routing"
```

---

### Task 3: Production Docker Compose

**Files:**
- Create: `docker-compose.prod.yml`

- [ ] **Step 1: Create `docker-compose.prod.yml` at project root**

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: help_center
      POSTGRES_USER: ${DB_USER:-postgres}
      POSTGRES_PASSWORD: ${DB_PASSWORD:?DB_PASSWORD is required}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD:-changeme}
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://${DB_USER:-postgres}:${DB_PASSWORD}@postgres:5432/help_center?schema=public
      REDIS_URL: redis://:${REDIS_PASSWORD:-changeme}@redis:6379
      JWT_SECRET: ${JWT_SECRET:?JWT_SECRET is required}
      JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET:?JWT_REFRESH_SECRET is required}
      CORS_ORIGIN: ${CORS_ORIGIN:-http://localhost}
      PORT: 3000
    ports:
      - "3000:3000"
    volumes:
      - uploads:/app/uploads

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    restart: unless-stopped
    depends_on:
      - backend
    ports:
      - "80:80"

volumes:
  postgres_data:
  redis_data:
  uploads:
```

- [ ] **Step 2: Create `.env.production.example` at project root**

```bash
# Required - set these before deploying
DB_PASSWORD=change-me-to-strong-password
JWT_SECRET=change-me-to-random-64-char-string
JWT_REFRESH_SECRET=change-me-to-different-random-64-char-string
CORS_ORIGIN=https://your-domain.com

# Optional
DB_USER=postgres
REDIS_PASSWORD=change-me-redis-password
```

- [ ] **Step 3: Commit**

```bash
git add docker-compose.prod.yml .env.production.example
git commit -m "feat: add production docker-compose with required secrets validation"
```

---

### Task 4: Tighten Rate Limits for Production

**Files:**
- Modify: `backend/src/middleware/rateLimit.middleware.ts`

- [ ] **Step 1: Read current rate limit middleware**

Run: `cat backend/src/middleware/rateLimit.middleware.ts`

- [ ] **Step 2: Update authLimiter from 1000 to 10 requests per 15 minutes**

Replace the `authLimiter` definition. Change `max` from `1000` to:

```typescript
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'development' ? 1000 : 10,
  message: {
    status: 'error',
    message: 'Too many authentication attempts. Please try again after 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
```

- [ ] **Step 3: Verify the backend still compiles**

Run: `cd backend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add backend/src/middleware/rateLimit.middleware.ts
git commit -m "fix: tighten auth rate limit to 10/15min in production"
```

---

### Task 5: Production Config Validation

**Files:**
- Modify: `backend/src/config/index.ts`

- [ ] **Step 1: Add startup validation at the bottom of `config/index.ts`**

After the existing `export default config` line, add:

```typescript
// Validate critical config in production
if (config.env === 'production') {
  const required: Array<[string, string]> = [
    ['JWT_SECRET', config.jwt.secret],
    ['JWT_REFRESH_SECRET', config.jwt.refreshSecret],
    ['DATABASE_URL', config.database.url],
  ];

  for (const [name, value] of required) {
    if (!value || value.includes('change-this') || value.includes('your-super-secret')) {
      throw new Error(`Production requires a secure ${name}. Current value is a default/placeholder.`);
    }
  }
}
```

- [ ] **Step 2: Verify the backend still compiles**

Run: `cd backend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add backend/src/config/index.ts
git commit -m "feat: add production config validation for secrets"
```

---

### Task 6: Database Backup Script

**Files:**
- Create: `scripts/backup-db.sh`

- [ ] **Step 1: Create `scripts/backup-db.sh`**

```bash
#!/bin/bash
set -euo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-./backups}"
DB_CONTAINER="${DB_CONTAINER:-$(docker compose -f docker-compose.prod.yml ps -q postgres)}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/help_center_${TIMESTAMP}.sql.gz"

# Create backup directory
mkdir -p "$BACKUP_DIR"

echo "[$(date)] Starting database backup..."

# Dump and compress
docker exec "$DB_CONTAINER" pg_dump -U postgres help_center | gzip > "$BACKUP_FILE"

# Verify backup is not empty
if [ ! -s "$BACKUP_FILE" ]; then
  echo "[$(date)] ERROR: Backup file is empty!"
  rm -f "$BACKUP_FILE"
  exit 1
fi

FILESIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "[$(date)] Backup created: $BACKUP_FILE ($FILESIZE)"

# Cleanup old backups
find "$BACKUP_DIR" -name "help_center_*.sql.gz" -mtime +${RETENTION_DAYS} -delete
echo "[$(date)] Cleaned up backups older than ${RETENTION_DAYS} days"

echo "[$(date)] Backup complete."
```

- [ ] **Step 2: Make it executable**

Run: `chmod +x scripts/backup-db.sh`

- [ ] **Step 3: Commit**

```bash
git add scripts/backup-db.sh
git commit -m "feat: add database backup script with retention policy"
```

---

### Task 7: GitHub Actions CI Pipeline

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  backend:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: backend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
          cache-dependency-path: backend/package-lock.json
      - run: npm ci
      - run: npx prisma generate
      - run: npm run lint
      - run: npm run build

  frontend:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: frontend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json
      - run: npm ci
      - run: npm run build
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "feat: add GitHub Actions CI pipeline for lint and build"
```

---

## Summary

After completing all 7 tasks, you will have:
- Dockerized backend (multi-stage build) and frontend (nginx SPA)
- Production docker-compose with required secrets validation
- Hardened auth rate limits (10/15min in production vs 1000 in dev)
- Startup config validation preventing placeholder secrets in production
- Automated database backup script with 30-day retention
- GitHub Actions CI running lint + build on every PR
