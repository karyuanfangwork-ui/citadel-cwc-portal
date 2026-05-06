# CWC 2.0 Deployment Guide — DigitalOcean Droplet

Complete step-by-step guide to deploy the Enterprise Help Center to a DigitalOcean Droplet,
with full admin console configuration migration from local to production.

---

## ⚠️ PRE-DEPLOYMENT CHECKLIST — Complete These FIRST

Before you start configuring the server, complete these prerequisites. **Skipping these will cause deployment failures.**

### ✅ 1. DigitalOcean Droplet Created

[ ] Droplet created in DigitalOcean Control Panel
[ ] **OS:** Ubuntu 24.04 LTS x64
[ ] **Plan:** Minimum 2 GB RAM / 1 vCPU (Basic plan)
[ ] **Region:** Singapore (sgp1) — same as your Spaces bucket
[ ] **Authentication:** SSH key added (recommended) or password set
[ ] **Monitoring:** Enabled (optional but recommended)
[ ] **Backups:** Enabled (optional, weekly backups)

**You need:**
- Droplet IP address (e.g., `159.65.123.45`)
- SSH access working (`ssh root@YOUR_DROPLET_IP`)

---

### ✅ 2. DNS Configuration at Exabytes (For Domain Access)

**IF using a domain (e.g., `cwc.citadelgroup.com.my`):**

[ ] Log into Exabytes Client Area: https://www.exabytes.com.my/clientarea.php
[ ] Navigate to: **Domains → My Domains → citadelgroup.com.my → Manage → DNS Management**
[ ] Add A Record:

| Field | Value |
|-------|-------|
| **Host/Name** | `cwc` |
| **Type** | `A` |
| **Points to/Value** | `YOUR_DROPLET_IP` |
| **TTL** | `300` or `14400` |

[ ] **Wait for propagation** (5-30 minutes usually, up to 48 hours)
[ ] **Verify DNS:**

```bash
dig cwc.citadelgroup.com.my +short
# Should return: YOUR_DROPLET_IP
```

**IF NOT using a domain (testing with IP only):**

[ ] Skip DNS setup
[ ] You will access via `http://YOUR_DROPLET_IP` (no HTTPS)
[ ] Browser will show "Not Secure" warning — this is normal
[ ] Plan to add domain + SSL later for production

---

### ✅ 3. DigitalOcean Spaces (File Storage)

[ ] Spaces bucket created in DigitalOcean Control Panel
[ ] **Region:** Singapore (sgp1)
[ ] **Bucket Name:** `citadel-super-app` (or your chosen name)
[ ] **Access Key** generated (starts with `DO...`)
[ ] **Secret Key** saved securely (shown only once!)
[ ] **Endpoint:** `https://sgp1.digitaloceanspaces.com`

**You need:**
- S3 Access Key (e.g., `DO801TLAFUY4ZELCC4ZA`)
- S3 Secret Key (keep this private!)
- Bucket name

---

### ✅ 4. Email Service (Resend)

[ ] Resend account created: https://resend.com
[ ] **API Key** generated
[ ] **Verified Domain** for sending (or use Resend's test domain)
[ ] **From Email** configured (e.g., `noreply-cwc@citadelgroup.com.my`)

**You need:**
- Resend API Key (starts with `re_...`)
- Verified sender email address

**Alternative for testing:** Use Resend's test domain (`@resend.dev`) — no domain verification needed, but emails go to Resend dashboard only.

---

### ✅ 5. SSH Key Ready

[ ] SSH key pair exists on your local machine:

```bash
# Check for existing keys
ls -la ~/.ssh/
# Look for: id_rsa, id_rsa.pub, id_ed25519, id_ed25519.pub
```

[ ] **If no key exists, create one:**

```bash
ssh-keygen -t ed25519 -C "your_email@example.com"
```

[ ] Public key content ready to copy to Droplet:

```bash
cat ~/.ssh/id_ed25519.pub
# Copy the entire output (starts with: ssh-ed25519 AAAA...)
```

---

### ✅ 6. Secrets Generated

Generate these cryptographically secure secrets before deployment:

```bash
# JWT_SECRET (64 chars)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# JWT_REFRESH_SECRET (64 chars)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# SESSION_SECRET (32 chars)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# DB_PASSWORD (strong password)
# Use a password manager or: openssl rand -base64 32

# REDIS_PASSWORD (strong password)
# Use a password manager or: openssl rand -base64 32
```

[ ] All secrets saved securely (password manager, encrypted file, etc.)

---

### ✅ 7. Local Database Backup (If Migrating Existing Data)

[ ] Local database is up-to-date with all admin config
[ ] Backup created:

```bash
pg_dump -U postgres -d help_center -F c -f /tmp/cwc_local_dump.backup
```

[ ] OR `seed-admin-config.ts` regenerated from local DB

---

### ✅ 8. GitHub Repository Access

[ ] Repository URL ready: `https://github.com/karyuanfangwork-ui/citadel-cwc-portal.git`
[ ] If private repo: SSH key or PAT (Personal Access Token) ready
[ ] Latest code pushed to `main` branch

---

## 📋 Pre-Deployment Summary

Fill this in before proceeding:

```
DROPLET_IP: _______________
DOMAIN (if using): _______________
DNS STATUS: ☐ Propagated / ☐ Not using domain / ☐ Pending

S3_ACCESS_KEY: DO_______________
S3_BUCKET: _______________
S3_REGION: sgp1

RESEND_API_KEY: re________________
EMAIL_FROM: _______________

DB_PASSWORD: _______________
REDIS_PASSWORD: _______________
JWT_SECRET: _______________
JWT_REFRESH_SECRET: _______________
SESSION_SECRET: _______________

SSH_PUBLIC_KEY: ☐ Ready / ☐ Need to create
```

---

## ⚠️ Common Pre-Deployment Mistakes

| Mistake | Consequence | Fix |
|---------|-------------|-----|
| DNS not propagated | SSL cert fails | Wait 30 min, verify with `dig` |
| Wrong Droplet region | S3 latency, egress fees | Use sgp1 for both |
| S3 Secret Key lost | Can't recover — must regenerate | Save immediately when created |
| No SSH key ready | Can't access server after hardening | Create before starting |
| Secrets not generated | `.env` incomplete, app won't start | Run the `node -e` commands above |
| Domain skip without HTTP config | App unreachable | Follow "Testing Without Domain" section |

---

## Table of Contents

## Table of Contents

## Table of Contents

### Option A: Docker Compose
1. [Architecture Overview](#1-architecture-overview)
2. [Option A: Docker Compose Deployment](#option-a-docker-compose-deployment-recommended)
   - [A.1 Prerequisites](#a1-prerequisites)
   - [A.2 Install Docker & Docker Compose](#a2-install-docker--docker-compose)
   - [A.3 Clone Repository](#a3-clone-repository)
   - [A.4 Create Environment File](#a4-create-environment-file)
   - [A.5 Configure Nginx for SSL](#a5-configure-nginx-for-ssl)
   - [A.6 Obtain SSL Certificate](#a6-obtain-ssl-certificate)
   - [A.7 Start All Services](#a7-start-all-services)
   - [A.8 Run Migrations & Seed](#a8-run-migrations--seed)
   - [A.9 Verify Deployment](#a9-verify-deployment)
   - [A.10 Docker Compose Useful Commands](#a10-docker-compose-useful-commands)
   - [A.11 Docker Volume Locations](#a11-docker-volume-locations)
   - [A.12 Update Workflow](#a12-update-workflow-day-to-day)

### Option B: Native/PM2
B. [Option B: Native/PM2 Deployment](#option-b-nativepm2-deployment)
   - [B.1 Architecture Overview](#b1-architecture-overview-native)
   - [B.2 Droplet Setup](#b2-droplet-setup)
   - [B.3 DNS & SSL](#b3-dns--ssl)
   - [B.4 Server Hardening](#b4-server-hardening)
   - [B.5 Install Dependencies](#b5-install-dependencies)
   - [B.6 Clone & Configure](#b6-clone--configure)
   - [B.7 Environment Variables](#b7-environment-variables)
   - [B.8 Database Migration & Seed](#b8-database-migration--seed)
   - [B.9 Admin Console Data Migration](#b9-admin-console-data-migration)
   - [B.10 Build & Deploy](#b10-build--deploy)
   - [B.11 Nginx Reverse Proxy](#b11-nginx-reverse-proxy)
   - [B.12 SSL with Certbot](#b12-ssl-with-certbot)
   - [B.13 Process Management (PM2)](#b13-process-management-pm2)
   - [B.14 Backup Strategy](#b14-backup-strategy)
   - [B.15 Verification Checklist](#b15-verification-checklist)
   - [B.16 Troubleshooting](#b16-troubleshooting)

---

## 1. Architecture Overview

```
Internet
  │
  └── :443 (HTTPS) ──► Nginx Container (reverse proxy + SSL termination)
                          ├── /api/* ──► Backend Container (Node.js :3000)
                          └── /*      ──► Frontend Container (Nginx :80)
  │
  ├── Droplet Internal
  │     └── Docker Network
              ├── postgres:5432
              ├── redis:6379
              ├── backend:3000
              └── frontend:80
  │
  └── External Services
        ├── DigitalOcean Spaces (S3-compatible file storage, sgp1)
        └── Resend (email delivery)
```

**Deployment Options:**

| Option | Best For | Pros | Cons |
|--------|----------|------|------|
| **Option A: Docker Compose** (Recommended) | Quick setup, consistent environments, easy updates | Single command deploy, all deps containerized, clean teardown | Less direct access to services |
| **Option B: Native/PM2** | Debugging, custom configs, existing infra | Direct DB access, easier profiling, more control | Manual dep setup, more moving parts |

---

## 🧪 Option C: Testing Without a Domain (HTTP Only)

**Use this if you don't have a domain yet and want to test with IP only.**

### What's Different

| Feature | With Domain | Without Domain (IP Only) |
|---------|-------------|--------------------------|
| **URL** | `https://cwc.citadelgroup.com.my` | `http://YOUR_DROPLET_IP` |
| **SSL/HTTPS** | ✅ Yes (Let's Encrypt) | ❌ No (HTTP only) |
| **Browser Warning** | ✅ None | ⚠️ "Not Secure" |
| **Certbot Setup** | Required | Skip entirely |
| **Cookie Domain** | `.citadelgroup.com.my` | Empty (no domain) |
| **CORS Origin** | `https://domain.com` | `http://YOUR_DROPLET_IP` |
| **Production Ready** | ✅ Yes | ❌ Testing only |

### C.1 Skip SSL/Certbot Steps

**Do NOT run the certbot certificate command.** In `docker-compose.prod.yml`, you can comment out the certbot service (optional — it won't hurt to leave it):

```yaml
  # certbot:
  #   image: certbot/certbot
  #   volumes:
  #     - certbot_certs:/etc/letsencrypt
  #     - certbot_webroot:/var/www/certbot
  #   entrypoint: "/bin/sh -c 'trap exit TERM; while :; do certbot renew; sleep 12h & wait $${!}; done;'"
```

### C.2 Update Nginx Config for HTTP Only

Create `/var/www/citadel-cwc-portal/nginx/conf.d/default.conf`:

```nginx
server {
    listen 80;
    server_name _;  # Accept any host (including direct IP)

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    # Frontend
    location / {
        proxy_pass http://frontend:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        try_files $uri $uri/ /index.html;
    }

    # API → Backend
    location /api/ {
        proxy_pass http://backend:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        client_max_body_size 10m;
    }

    # SSE — no buffering
    location /api/v1/notifications/sse {
        proxy_pass http://backend:3000;
        proxy_http_version 1.1;
        proxy_set_header Connection '';
        proxy_set_header Host $host;
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 86400s;
        chunked_transfer_encoding off;
    }

    # Health check
    location /health {
        proxy_pass http://backend:3000;
    }
}
```

### C.3 Update `.env` for IP Access

```bash
# ================================================================
# CWC 2.0 — TESTING WITHOUT DOMAIN (HTTP ONLY)
# ================================================================

# -- Database --
DB_USER=cwc_admin
DB_PASSWORD=CHANGE_THIS_STRONG_PASSWORD

# -- Redis --
REDIS_PASSWORD=CHANGE_THIS_REDIS_PASSWORD

# -- JWT Secrets --
JWT_SECRET=generate_64_char_hex_here
JWT_REFRESH_SECRET=generate_another_64_char_hex_here
SESSION_SECRET=generate_32_char_hex_here

# -- CORS (USE YOUR DROPLET IP) --
CORS_ORIGIN=http://YOUR_DROPLET_IP

# -- Cookies (NO DOMAIN FOR IP) --
COOKIE_SAME_SITE=lax
COOKIE_DOMAIN=

# -- Application --
APP_NAME="Enterprise Help Center"
APP_URL=http://YOUR_DROPLET_IP
ADMIN_EMAIL=admin@helpdesk.com

# -- Email (Resend) --
RESEND_API_KEY=your_resend_api_key_here
EMAIL_FROM="Citadel Help Center <noreply-cwc@citadelgroup.com.my>"
EMAIL_REPLY_TO="help@citadelgroup.com.my"

# -- DigitalOcean Spaces --
S3_ENDPOINT=https://sgp1.digitaloceanspaces.com
S3_REGION=sgp1
S3_BUCKET=citadel-super-app
S3_ACCESS_KEY=DO801TLAFUY4ZELCC4ZA
S3_SECRET_KEY=YOUR_S3_SECRET_KEY
S3_FORCE_PATH_STYLE=false

# -- Rate Limiting --
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# -- Logging --
LOG_LEVEL=info
LOG_FORMAT=json

# -- Security --
PASSWORD_MIN_LENGTH=8
CHECK_PASSWORD_BREACH=true

# -- SLA --
SLA_SCHEDULE_MODE=cron
SLA_CRON_EXPRESSION="0 9 * * 1-5"
SLA_CHECK_INTERVAL_MS=60000

# -- Frontend Build Arg --
VITE_API_URL=http://YOUR_DROPLET_IP/api/v1
```

### C.4 Firewall — Open Port 80

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp  # Keep for when you add domain later
sudo ufw enable
```

### C.5 Deploy (Skip SSL Step)

```bash
cd /var/www/citadel-cwc-portal

# Skip the certbot command — go straight to:
docker compose -f docker-compose.prod.yml up -d --build

# Run migrations
docker compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy
docker compose -f docker-compose.prod.yml exec backend npm run prisma:seed
```

### C.6 Access Your App

Open browser and go to:
```
http://YOUR_DROPLET_IP
```

Example: `http://159.65.123.45`

**Expected:**
- ✅ App loads normally
- ⚠️ Browser shows "Not Secure" warning — this is normal for HTTP
- ✅ All features work (login, requests, uploads, etc.)

### C.7 Upgrading to Domain + HTTPS Later

When you get a domain:

1. **Add DNS record at Exabytes** (see Pre-Deployment Checklist #2)
2. **Wait for propagation** (`dig cwc.citadelgroup.com.my +short`)
3. **Get SSL certificate:**

```bash
docker run --rm \
  -v citadel-cwc-portal_certbot_certs:/etc/letsencrypt \
  -v citadel-cwc-portal_certbot_webroot:/var/www/certbot \
  certbot/certbot certonly \
  --webroot \
  -w /var/www/certbot \
  -d cwc.citadelgroup.com.my \
  --email karyuan.fang@citadelgroup.com.my \
  --agree-tos \
  --no-eff-email
```

4. **Update `.env`:**

```bash
CORS_ORIGIN=https://cwc.citadelgroup.com.my
APP_URL=https://cwc.citadelgroup.com.my
VITE_API_URL=https://cwc.citadelgroup.com.my/api/v1
COOKIE_DOMAIN=.citadelgroup.com.my
```

5. **Update Nginx config** to the full HTTPS version (see Option A.5)

6. **Rebuild:**

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

---

## ⚡ Quick Start: Choose Your Path

**Have a domain ready?**
→ Follow **Option A: Docker Compose** (next section)

**Testing without domain?**
→ Follow **Option C: Testing Without a Domain** (this section)

**Want bare-metal control?**
→ Follow **Option B: Native/PM2** (later in this guide)

---

## Option A: Docker Compose Deployment (Recommended)

### A.1 Prerequisites

```bash
# SSH into your Droplet
ssh root@YOUR_DROPLET_IP

# Create deploy user
adduser deploy
usermod -aG sudo deploy

# Copy SSH key
mkdir -p /root/.ssh
cp ~/.ssh/authorized_keys /root/.ssh/
chown -R root:root /root/.ssh
chmod 700 /root/.ssh
chmod 600 /root/.ssh/authorized_keys

# Switch to deploy user
su - deploy
```

### A.2 Install Docker & Docker Compose

```bash
# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker deploy

# Install Docker Compose plugin
sudo apt install -y docker-compose-plugin

# Verify (log out and back in for group change to take effect)
exit
ssh root@YOUR_DROPLET_IP
docker --version
docker compose version
```

### A.3 Clone Repository

```bash
cd /var/www
git clone https://github.com/karyuanfangwork-ui/citadel-cwc-portal.git
cd citadel-cwc-portal
```

### A.4 Create Environment File

Create `/var/www/citadel-cwc-portal/.env`:

```bash
# ================================================================
# CWC 2.0 PRODUCTION ENVIRONMENT — Docker Compose
# ================================================================

# -- Database --
DB_USER=cwc_admin
DB_PASSWORD=CHANGE_THIS_STRONG_PASSWORD

# -- Redis --
REDIS_PASSWORD=CHANGE_THIS_REDIS_PASSWORD

# -- JWT Secrets (generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))") --
JWT_SECRET=generate_64_char_hex_here
JWT_REFRESH_SECRET=generate_another_64_char_hex_here
SESSION_SECRET=generate_32_char_hex_here

# -- CORS --
CORS_ORIGIN=https://cwc.citadelgroup.com.my

# -- Cookies --
COOKIE_SAME_SITE=lax
COOKIE_DOMAIN=.citadelgroup.com.my

# -- Application --
APP_NAME="Enterprise Help Center"
APP_URL=https://cwc.citadelgroup.com.my
ADMIN_EMAIL=admin@helpdesk.com

# -- Email (Resend) --
RESEND_API_KEY=your_resend_api_key_here
EMAIL_FROM="Citadel Help Center <noreply-cwc@citadelgroup.com.my>"
EMAIL_REPLY_TO="help@citadelgroup.com.my"

# -- DigitalOcean Spaces --
S3_ENDPOINT=https://sgp1.digitaloceanspaces.com
S3_REGION=sgp1
S3_BUCKET=citadel-super-app
S3_ACCESS_KEY=DO801TLAFUY4ZELCC4ZA
S3_SECRET_KEY=YOUR_S3_SECRET_KEY
S3_FORCE_PATH_STYLE=false

# -- Rate Limiting --
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# -- Logging --
LOG_LEVEL=info
LOG_FORMAT=json

# -- Security --
PASSWORD_MIN_LENGTH=8
CHECK_PASSWORD_BREACH=true

# -- SLA --
SLA_SCHEDULE_MODE=cron
SLA_CRON_EXPRESSION="0 9 * * 1-5"
SLA_CHECK_INTERVAL_MS=60000

# -- Frontend Build Arg --
VITE_API_URL=https://cwc.citadelgroup.com.my/api/v1
```

Secure it:
```bash
chmod 600 /var/www/citadel-cwc-portal/.env
```

### A.5 Configure Nginx for SSL

Create `/var/www/citadel-cwc-portal/nginx/conf.d/default.conf`:

```nginx
server {
    listen 80;
    server_name cwc.citadelgroup.com.my;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name cwc.citadelgroup.com.my;

    ssl_certificate /etc/letsencrypt/live/cwc.citadelgroup.com.my/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/cwc.citadelgroup.com.my/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;

    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    # Frontend
    location / {
        proxy_pass http://frontend:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # API → Backend
    location /api/ {
        proxy_pass http://backend:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        client_max_body_size 10m;
    }

    # SSE — no buffering
    location /api/v1/notifications/sse {
        proxy_pass http://backend:3000;
        proxy_http_version 1.1;
        proxy_set_header Connection '';
        proxy_set_header Host $host;
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 86400s;
        chunked_transfer_encoding off;
    }

    # Health check
    location /health {
        proxy_pass http://backend:3000;
    }
}
```

### A.6 Obtain SSL Certificate

```bash
# Get certificate before starting containers
docker run --rm \
  -v citadel-cwc-portal_certbot_certs:/etc/letsencrypt \
  -v citadel-cwc-portal_certbot_webroot:/var/www/certbot \
  certbot/certbot certonly \
  --webroot \
  -w /var/www/certbot \
  -d cwc.citadelgroup.com.my \
  --email karyuan.fang@citadelgroup.com.my \
  --agree-tos \
  --no-eff-email
```

### A.7 Start All Services

```bash
cd /var/www/citadel-cwc-portal

# Build and start all containers
docker compose -f docker-compose.prod.yml up -d --build

# Check status
docker compose -f docker-compose.prod.yml ps

# View logs
docker compose -f docker-compose.prod.yml logs -f backend
```

### A.8 Run Migrations & Seed

```bash
# Run database migrations
docker compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy

# Seed database (fresh install)
docker compose -f docker-compose.prod.yml exec backend npm run prisma:seed
```

### A.9 Verify Deployment

```bash
# Health check
curl -s https://cwc.citadelgroup.com.my/health | jq
# Expected: { "status": "ok", "environment": "production" }

# Test login
curl -s https://cwc.citadelgroup.com.my/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.local","password":"abc@123"}' | jq '.token'
# Expected: JWT token string

# Check containers
docker compose -f docker-compose.prod.yml ps
# All should show "Up" status
```

### A.10 Docker Compose Useful Commands

```bash
# View logs
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f nginx
docker compose -f docker-compose.prod.yml logs -f postgres

# Restart a service
docker compose -f docker-compose.prod.yml restart backend

# Shell into container
docker compose -f docker-compose.prod.yml exec backend sh
docker compose -f docker-compose.prod.yml exec postgres psql -U cwc_admin -d help_center

# Stop everything
docker compose -f docker-compose.prod.yml down

# Rebuild without cache
docker compose -f docker-compose.prod.yml build --no-cache

# Update after git pull
docker compose -f docker-compose.prod.yml up -d --build
```

### A.11 Docker Volume Locations

| Volume | Purpose |
|--------|---------|
| `postgres_data` | PostgreSQL database files |
| `redis_data` | Redis persistence |
| `uploads` | File uploads (S3 is primary, this is fallback) |
| `backend_logs` | Backend application logs |
| `certbot_certs` | SSL certificates |
| `certbot_webroot` | Let's Encrypt challenge files |

### A.12 Update Workflow (Day-to-Day)

```bash
# 1. SSH into server
ssh root@cwc.citadelgroup.com.my

# 2. Pull latest code
cd /var/www/citadel-cwc-portal
git pull origin main

# 3. Rebuild and restart
docker compose -f docker-compose.prod.yml up -d --build

# 4. Run new migrations (if any)
docker compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy

# 5. Verify
curl -s https://cwc.citadelgroup.com.my/health | jq
```

---

## Option B: Native/PM2 Deployment

### B.1 Architecture Overview (Native)

```
Internet
  │
  ├── :443 (HTTPS) ──► Nginx (reverse proxy + SSL termination)
  │                       ├── /api/* ──► Backend (Node.js :3000)
  │                       └── /*      ──► Frontend (Nginx :8080 static)
  │
  ├── Droplet Internal
  │     ├── PostgreSQL :5432 (native install)
  │     ├── Redis :6379 (native install)
  │     ├── Backend (PM2, port 3000)
  │     └── Frontend (Nginx static, port 8080)
  │
  └── External Services
        ├── DigitalOcean Spaces (S3-compatible file storage, sgp1)
        └── Resend (email delivery)
```

**Tech Stack on Server:**
- Node.js 20 LTS
- PostgreSQL 15
- Redis 7
- Nginx (reverse proxy + static frontend)
- PM2 (process manager)
- Certbot (Let's Encrypt SSL)

---

## 2. Droplet Setup

### B.2 Droplet Setup

### 2.1 Create the Droplet

Log into DigitalOcean and create a new Droplet:

| Setting | Recommendation |
|---------|--------------|
| Image | Ubuntu 24.04 LTS x64 |
| Plan | Basic / 2 GB RAM / 1 vCPU (minimum) |
| Datacenter | Singapore (sgp1) — same as your Spaces bucket |
| Authentication | SSH key (recommended) or password |
| Monitoring | Enable |
| Backups | Enable (weekly) |

### 2.2 SSH into the Droplet

```bash
ssh root@YOUR_DROPLET_IP
```

Or with a custom SSH key:
```bash
ssh -i ~/.ssh/your_key root@YOUR_DROPLET_IP
```

### 2.3 Create a Deploy User

```bash
# Create user
adduser deploy
usermod -aG sudo deploy

# Copy SSH key for deploy user
mkdir -p /root/.ssh
cp ~/.ssh/authorized_keys /root/.ssh/
chown -R root:root /root/.ssh
chmod 700 /root/.ssh
chmod 600 /root/.ssh/authorized_keys

# Switch to deploy user
su - deploy
```

---

## B.3 DNS & SSL

### 3.1 Point Your Domain

In your DNS provider (Cloudflare, DigitalOcean DNS, etc.):

```
Type: A
Name: cwc (or @ for root domain)
Value: YOUR_DROPLET_IP
TTL: 300
```

Example: `cwc.citadelgroup.com.my` → `YOUR_DROPLET_IP`

Wait for DNS propagation (usually 1-5 minutes with DigitalOcean DNS, up to 48h with others).

Verify:
```bash
dig cwc.citadelgroup.com.my +short
# Should return your droplet IP
```

---

## B.4 Server Hardening

### 4.1 Firewall (UFW)

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp        # SSH
sudo ufw allow 80/tcp        # HTTP (Let's Encrypt challenge + redirect)
sudo ufw allow 443/tcp       # HTTPS
sudo ufw enable
sudo ufw status
```

### 4.2 SSH Hardening

```bash
sudo nano /etc/ssh/sshd_config
```

Change these settings:
```
PermitRootLogin no
PasswordAuthentication no
Port 22                    # Or change to a non-standard port
```

```bash
sudo systemctl restart sshd
```

**IMPORTANT:** Test SSH login in a NEW terminal before closing your current session!

### 4.3 Automatic Security Updates

```bash
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

---

## B.5 Install Dependencies

### 5.1 System Packages

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y \
  build-essential \
  curl \
  git \
  nginx \
  certbot \
  python3-certbot-nginx \
  postgresql-15 \
  redis-server \
  ufw \
  htop \
  jq
```

### 5.2 Node.js 20 LTS

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify
node --version   # v20.x.x
npm --version    # 10.x.x
```

### 5.3 PM2 (Process Manager)

```bash
sudo npm install -g pm2
```

### 5.4 PostgreSQL Setup

```bash
# Start PostgreSQL
sudo systemctl enable postgresql
sudo systemctl start postgresql

# Create database and user
sudo -u postgres psql <<EOF
CREATE USER cwc_admin WITH PASSWORD 'CHANGE_THIS_STRONG_PASSWORD';
CREATE DATABASE help_center OWNER cwc_admin;
GRANT ALL PRIVILEGES ON DATABASE help_center TO cwc_admin;
\c help_center
GRANT ALL ON SCHEMA public TO cwc_admin;
EOF
```

### 5.5 Redis Setup

```bash
sudo systemctl enable redis-server
sudo systemctl start redis-server

# Set a password
sudo sed -i 's/# requirepass foobared/requirepass CHANGE_THIS_REDIS_PASSWORD/' /etc/redis/redis.conf
sudo systemctl restart redis-server

# Test
redis-cli -a CHANGE_THIS_REDIS_PASSWORD ping
# Should return: PONG
```

---

## B.6 Clone & configure

### 6.1 Clone the Repository

```bash
cd /var/www
git clone https://github.com/karyuanfangwork-ui/citadel-cwc-portal.git
cd citadel-cwc-portal
```

### 6.2 Install Backend Dependencies

```bash
cd /var/www/citadel-cwc-portal/backend
npm ci
npx prisma generate
```

### 6.3 Install Frontend Dependencies

```bash
cd /var/www/citadel-cwc-portal/frontend
npm ci
```

---

## B.7 Environment Variables

### 7.1 Backend `.env` (CRITICAL)

Create `/var/www/citadel-cwc-portal/backend/.env`:

```env
# ================================================================
# CWC 2.0 PRODUCTION ENVIRONMENT
# ================================================================

# -- REQUIRED (app fails to start without these) --
NODE_ENV=production
DATABASE_URL="postgresql://cwc_admin:CHANGE_THIS_STRONG_PASSWORD@localhost:5432/help_center?schema=public"
JWT_SECRET=CHANGE_TO_RANDOM_64BYTE_HEX
JWT_REFRESH_SECRET=CHANGE_TO_ANOTHER_RANDOM_64BYTE_HEX

# -- CORS --
CORS_ORIGIN=https://cwc.citadelgroup.com.my

# -- Redis --
REDIS_URL="redis://:CHANGE_THIS_REDIS_PASSWORD@localhost:6379"

# -- Session --
SESSION_SECRET=CHANGE_TO_RANDOM_STRING
SESSION_MAX_AGE=86400000

# -- Cookies (production) --
COOKIE_SAME_SITE=lax
COOKIE_DOMAIN=.citadelgroup.com.my

# -- Application --
APP_NAME="Enterprise Help Center"
APP_URL=https://cwc.citadelgroup.com.my
ADMIN_EMAIL=admin@helpdesk.com
PORT=3000

# -- Email (Resend) --
RESEND_API_KEY=your_resend_api_key_here
EMAIL_FROM="Citadel Help Center <noreply-cwc@citadelgroup.com.my>"
EMAIL_REPLY_TO="help@citadelgroup.com.my"

# -- DigitalOcean Spaces (S3) --
S3_ENDPOINT=https://sgp1.digitaloceanspaces.com
S3_REGION=sgp1
S3_BUCKET=citadel-super-app
S3_ACCESS_KEY=DO801TLAFUY4ZELCC4ZA
S3_SECRET_KEY=YOUR_S3_SECRET_KEY
S3_FORCE_PATH_STYLE=false

# -- Rate Limiting --
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# -- Logging --
LOG_LEVEL=info
LOG_FORMAT=json

# -- Security --
PASSWORD_MIN_LENGTH=8
CHECK_PASSWORD_BREACH=true

# -- SLA Checker --
SLA_SCHEDULE_MODE=cron
SLA_CRON_EXPRESSION="0 9 * * 1-5"
SLA_CHECK_INTERVAL_MS=60000

# -- Approval Thresholds --
HARDWARE_VP_APPROVAL_THRESHOLD=2500
GROUP_CEO_APPROVAL_THRESHOLD=15000
```

**Generate secure secrets:**
```bash
# JWT_SECRET
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
# JWT_REFRESH_SECRET
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
# SESSION_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 7.2 Frontend `.env`

Create `/var/www/citadel-cwc-portal/frontend/.env.production`:

```env
VITE_API_URL=https://cwc.citadelgroup.com.my/api/v1
```

**Note:** This is baked into the Vite build at compile time. It CANNOT be changed after build
without rebuilding the frontend.

### 7.3 Secure the .env Files

```bash
chmod 600 /var/www/citadel-cwc-portal/backend/.env
chmod 600 /var/www/citadel-cwc-portal/frontend/.env.production
```

---

## B.8 Database Migration & Seed

### 8.1 Run Migrations

```bash
cd /var/www/citadel-cwc-portal/backend
npx prisma migrate deploy
```

This applies all 29 migrations in order. **Do NOT use `prisma migrate dev`** in production.

### 8.2 Seed Database (Fresh Install)

```bash
cd /var/www/citadel-cwc-portal/backend
npm run prisma:seed
```

This creates:
- 3 service desks (IT, HR, Finance)
- All roles & permissions (ADMIN, AGENT, IT_AGENT, NORMAL_STAFF, CEO, CTO, CFO, GROUP_CEO, HIRING_MANAGER, FINANCE_HEAD)
- All request types & categories
- All workflow types & transitions
- Notification templates
- Banner configs
- Status definitions
- Escalation rules
- Onboarding/offboarding templates
- Test user accounts

**Test accounts after seed:**
| Email | Password | Role |
|-------|----------|------|
| admin@test.local | abc@123 | Admin |
| hr@test.local | abc@123 | HR Agent |
| it@test.local | abc@123 | IT Agent |
| ceo@test.local | abc@123 | CEO |
| groupceo@company.com | groupceo123 | Group CEO |

### 8.3 Change Test Passwords (IMPORTANT!)

After seeding, change all test account passwords immediately:

```bash
# Login as admin, then use the API or admin console to reset passwords
# Or use the password reset flow
```

---

## B.9 Admin Console Data Migration

This is the critical section for migrating your **local admin console configuration**
to the production server. There are 3 approaches, listed from most recommended.

### 9.1 Approach A: pg_dump + pg_restore (RECOMMENDED)

This is the cleanest method. Dump your local PostgreSQL and restore it on the server.
**This moves ALL data including admin config, users, AND any test requests.**

**On your LOCAL machine:**
```bash
# Dump the local database
pg_dump -U postgres -d help_center -F c -f /tmp/cwc_local_dump.backup

# If you want ONLY admin config (no test requests), use selective dump:
pg_dump -U postgres -d help_center -F c \
  -t ServiceDesk -t ServiceCategory -t RequestType -t WorkflowType \
  -t WorkflowStep -t WorkflowTransition -t NotificationTemplate \
  -t BannerConfig -t RequestStatusDefinition -t EscalationRule \
  -t Entity -t RequestTypeEntityRouting -t SystemSetting \
  -t OnboardingTaskTemplate -t OffboardingTaskTemplate \
  -t Role -t Permission -t RolePermission \
  -t User -t UserRole \
  -f /tmp/cwc_admin_config_only.backup

# Transfer to server
scp /tmp/cwc_local_dump.backup root@YOUR_DROPLET_IP:/tmp/
```

**On the SERVER:**
```bash
# If fresh seed was already done, clear it first
sudo -u postgres psql -c "DROP DATABASE help_center;"
sudo -u postgres psql -c "CREATE DATABASE help_center OWNER cwc_admin;"

# Restore
pg_restore -U cwc_admin -d help_center -c /tmp/cwc_local_dump.backup

# Or if selective dump, restore after migration deploy:
# Run migrations first, then restore config tables
npx prisma migrate deploy
pg_restore -U cwc_admin -d help_center -c /tmp/cwc_admin_config_only.backup

# Clean up
rm /tmp/cwc_local_dump.backup
```

### 9.2 Approach B: JSON Export/Import via seed-admin-config.ts

The project already has `seed-admin-config.ts` (auto-generated from local DB).
This file contains all admin console settings as JavaScript constants.

**On your LOCAL machine** (regenerate from latest DB):
```bash
cd /Users/fangkaryuan/cwc2.0/citadel-cwc-portal/backend

# If you have a script to regenerate seed-admin-config.ts, run it.
# Otherwise, the existing file already contains your current admin config.
```

**On the SERVER** (use RETAIN_ADMIN_CONFIG flag):
```bash
cd /var/www/citadel-cwc-portal/backend

# First seed: load everything (admin config from seed-admin-config.ts)
npm run prisma:seed

# Future re-seeds: preserve admin console changes made via the UI
RETAIN_ADMIN_CONFIG=true npm run prisma:seed
```

The `RETAIN_ADMIN_CONFIG=true` flag ensures that when you re-seed, only accounts
(users, roles, permissions) are updated — all admin console settings made through
the UI are untouched.

### 9.3 Approach C: API-Based Migration

If you've customized settings via the Admin Console UI that aren't in seed files:

1. Export from local admin console APIs
2. Import into production admin console APIs

**Export script** (run on local machine):
```bash
# Get auth token
TOKEN=$(curl -s http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.local","password":"abc@123"}' | jq -r '.token')

# Export all system settings
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/system-settings | jq '.' > /tmp/system-settings.json

# Export all notification templates
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/notification-templates | jq '.' > /tmp/notification-templates.json

# Export all escalation rules
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/escalation-rules | jq '.' > /tmp/escalation-rules.json

# Export all banner configs
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/banner-configs | jq '.' > /tmp/banner-configs.json

# Export all workflow transitions
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/workflow-transitions | jq '.' > /tmp/workflow-transitions.json

# Export all status definitions
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/request-status-definitions | jq '.' > /tmp/status-definitions.json

# Export all service desks (with request types)
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/service-desks | jq '.' > /tmp/service-desks.json
```

**Import script** (run on production server after basic seed):
```bash
# Login to production
PROD_URL=https://cwc.citadelgroup.com.my/api/v1
TOKEN=$(curl -s $PROD_URL/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.local","password":"abc@123"}' | jq -r '.token')

# Import system settings
cat /tmp/system-settings.json | jq -c '.data[]' | while read setting; do
  curl -s -X PUT -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$setting" $PROD_URL/system-settings/$(echo $setting | jq -r '.key')
done

# Repeat for other entities...
```

### 9.4 Admin Console Tables Reference

These are the tables that hold admin console configuration:

| Table | What It Contains | Migration Priority |
|-------|-----------------|-------------------|
| ServiceDesk | 3 desks (IT, HR, Finance) + assignment strategy | HIGH |
| ServiceCategory | Categories per desk | HIGH |
| RequestType | Request types with form configs, SLAs | HIGH |
| WorkflowType | Approval workflow definitions | HIGH |
| WorkflowStep | Steps in each workflow | HIGH |
| WorkflowTransition | Status transitions & auto-assign rules | HIGH |
| NotificationTemplate | Email/push notification templates | HIGH |
| BannerConfig | Announcement banner settings | MEDIUM |
| RequestStatusDefinition | Custom status labels & colors | MEDIUM |
| EscalationRule | SLA escalation rules | MEDIUM |
| Entity | Departments (IT, HR, Finance, etc.) | MEDIUM |
| RequestTypeEntityRouting | Which entity handles which type | MEDIUM |
| SystemSetting | Key-value system settings | MEDIUM |
| OnboardingTaskTemplate | Default onboarding checklists | LOW |
| OffboardingTaskTemplate | Default offboarding checklists | LOW |
| Role | Role definitions | HIGH |
| Permission | Permission definitions | HIGH |
| RolePermission | Role→Permission mappings | HIGH |
| User | User accounts | HIGH (if migrating users) |
| UserRole | User→Role assignments | HIGH (if migrating users) |

---

## B.10 Build & Deploy

### 10.1 Build Frontend

```bash
cd /var/www/citadel-cwc-portal/frontend

# Make sure .env.production exists with VITE_API_URL
npm run build
```

This outputs static files to `frontend/dist/`.

### 10.2 Build Backend

```bash
cd /var/www/citadel-cwc-portal/backend
npm run build
```

This compiles TypeScript to `backend/dist/`.

### 10.3 Create Required Directories

```bash
cd /var/www/citadel-cwc-portal/backend
mkdir -p uploads logs
```

---

## B.11 Nginx Reverse Proxy

### 11.1 Create Nginx Config

```bash
sudo nano /etc/nginx/sites-available/cwc
```

Paste this configuration:

```nginx
# Upstream: Backend Node.js API
upstream cwc_backend {
    server 127.0.0.1:3000;
    keepalive 64;
}

server {
    listen 80;
    server_name cwc.citadelgroup.com.my;

    # Let's Encrypt challenge
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    # Redirect HTTP to HTTPS
    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name cwc.citadelgroup.com.my;

    # ---- SSL (will be configured by certbot, placeholders below) ----
    ssl_certificate     /etc/letsencrypt/live/cwc.citadelgroup.com.my/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/cwc.citadelgroup.com.my/privkey.pem;

    # SSL hardening
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;
    ssl_session_tickets off;

    # HSTS
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;

    # ---- Security Headers ----
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # ---- Frontend (Static Files) ----
    root /var/www/citadel-cwc-portal/frontend/dist;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml image/svg+xml;
    gzip_min_length 256;

    # Cache static assets (Vite generates hashed filenames)
    location ~* /assets/.*\.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    # API requests → Backend
    location /api/ {
        proxy_pass http://cwc_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Request-ID $request_id;
        proxy_cache_bypass $http_upgrade;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;

        # Body size (file uploads up to 10MB)
        client_max_body_size 10m;
    }

    # SSE endpoint — no buffering
    location /api/v1/notifications/sse {
        proxy_pass http://cwc_backend;
        proxy_http_version 1.1;
        proxy_set_header Connection '';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 86400s;
        chunked_transfer_encoding off;
    }

    # Health check
    location /health {
        proxy_pass http://cwc_backend;
        proxy_set_header Host $host;
    }

    # SPA fallback — all other routes → index.html
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### 11.2 Enable the Site

```bash
sudo ln -sf /etc/nginx/sites-available/cwc /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test config
sudo nginx -t

# Reload
sudo systemctl reload nginx
```

---

## B.12 SSL with Certbot

### 12.1 Initial Certificate (before DNS resolves won't work)

First, make sure your domain DNS is pointing to the droplet IP (Section 3).

```bash
# Create certbot webroot
sudo mkdir -p /var/www/certbot

# Get certificate
sudo certbot certonly \
  --webroot \
  -w /var/www/certbot \
  -d cwc.citadelgroup.com.my \
  --email karyuan.fang@citadelgroup.com.my \
  --agree-tos \
  --no-eff-email

# Auto-renewal (certbot installs a cron by default)
sudo certbot renew --dry-run
```

### 12.2 After First Certificate

Nginx config already references the Let's Encrypt paths. Reload Nginx:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

### 12.3 Auto-Renewal

Certbot installs a systemd timer for auto-renewal. Verify:

```bash
sudo systemctl list-timers | grep certbot
```

---

## B.13 Process Management (PM2)

### 13.1 Start the Backend

```bash
cd /var/www/citadel-cwc-portal/backend

# Start with PM2
pm2 start dist/index.js \
  --name cwc-backend \
  --node-args="--max-old-space-size=512" \
  --env production

# Save PM2 process list (auto-restart on reboot)
pm2 save
pm2 startup
# PM2 will output a sudo command — run it to install the systemd service
```

### 13.2 PM2 Ecosystem Config (Alternative)

Create `/var/www/citadel-cwc-portal/ecosystem.config.js`:

```javascript
module.exports = {
  apps: [
    {
      name: 'cwc-backend',
      script: 'dist/index.js',
      cwd: '/var/www/citadel-cwc-portal/backend',
      instances: 1,
      exec_mode: 'fork',
      node_args: '--max-old-space-size=512',
      env: {
        NODE_ENV: 'production',
      },
      // Auto-restart on crash
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      // Logs
      error_file: '/var/www/citadel-cwc-portal/backend/logs/pm2-error.log',
      out_file: '/var/www/citadel-cwc-portal/backend/logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      // Graceful shutdown
      listen_timeout: 10000,
      kill_timeout: 10000,
    },
  ],
};
```

Then:
```bash
pm2 start ecosystem.config.js
pm2 save
```

### 13.3 Useful PM2 Commands

```bash
pm2 status                    # List processes
pm2 logs cwc-backend          # Tail logs
pm2 logs cwc-backend --lines 100  # Last 100 lines
pm2 restart cwc-backend       # Restart
pm2 stop cwc-backend          # Stop
pm2 delete cwc-backend        # Remove from PM2
pm2 monit                     # Resource monitor
pm2 describe cwc-backend      # Process details
```

---

## B.14 Deployment Workflow (Day-to-Day)

After initial setup, use this workflow for updates:

```bash
# 1. SSH into server
ssh root@cwc.citadelgroup.com.my

# 2. Pull latest code
cd /var/www/citadel-cwc-portal
git pull origin main

# 3. Backend: install deps + build + migrate
cd backend
npm ci
npx prisma generate
npx prisma migrate deploy       # Apply any new migrations (safe, non-destructive)
npm run build
pm2 restart cwc-backend

# 4. Frontend: install deps + build (VITE_API_URL baked in at build time)
cd ../frontend
npm ci
npm run build
# No restart needed — Nginx serves static files from dist/

# 5. Verify
curl -s https://cwc.citadelgroup.com.my/health | jq
```

---

## B.15 Backup Strategy

### 15.1 Database Backup Script

The project includes `scripts/backup-db.sh`. Adapt it for native PostgreSQL:

```bash
sudo nano /var/www/citadel-cwc-portal/scripts/backup-db-native.sh
```

```bash
#!/bin/bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/www/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/help_center_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "[$(date)] Starting database backup..."
pg_dump -U cwc_admin -d help_center | gzip > "$BACKUP_FILE"

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

```bash
chmod +x /var/www/citadel-cwc-portal/scripts/backup-db-native.sh
```

### 15.2 Schedule Daily Backups

```bash
# Add pg_password to .pgpass for non-interactive backup
echo "localhost:5432:help_center:cwc_admin:CHANGE_THIS_STRONG_PASSWORD" | \
  sudo tee /root/.pgpass
sudo chmod 600 /root/.pgpass


# Add to crontab (daily at 2 AM)
crontab -e
# Add:
0 2 * * * /var/www/citadel-cwc-portal/scripts/backup-db-native.sh >> /var/www/logs/backup.log 2>&1
```

### 15.3 Off-Site Backup (DigitalOcean Spaces)

```bash
# Install s3cmd or rclone
sudo apt install -y s3cmd

# Configure s3cmd for DigitalOcean Spaces
s3cmd --configure
# Use: sgp1.digitaloceanspaces.com
# Access Key: DO801TLAFUY4ZELCC4ZA
# Secret Key: YOUR_S3_SECRET_KEY

# Upload backup to Spaces
s3cmd put /var/www/backups/help_center_*.sql.gz \
  s3://citadel-super-app/backups/
```

---

## B.16 Verification Checklist

Run through every item after deployment:

```bash
# BACKEND
curl -s https://cwc.citadelgroup.com.my/health | jq
# Expected: { "status": "ok", "environment": "production" }

curl -s https://cwc.citadelgroup.com.my/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.local","password":"abc@123"}' | jq '.token'
# Expected: JWT token string

# DATABASE
sudo -u postgres psql -d help_center -c "SELECT count(*) FROM \"ServiceDesk\";"
# Expected: 3 (IT, HR, Finance)

sudo -u postgres psql -d help_center -c "SELECT count(*) FROM \"RequestType\";"
# Expected: varies — check against local

sudo -u postgres psql -d help_center -c "SELECT count(*) FROM \"WorkflowType\";"
# Expected: multiple

sudo -u postgres psql -d help_center -c "SELECT count(*) FROM \"NotificationTemplate\";"
# Expected: 7+

sudo -u postgres psql -d help_center -c "SELECT * FROM \"SystemSetting\";"
# Expected: your admin console settings

# REDIS
redis-cli -a CHANGE_THIS_REDIS_PASSWORD ping
# Expected: PONG

# FRONTEND
curl -sI https://cwc.citadelgroup.com.my/ | head -5
# Expected: HTTP/2 200

curl -s https://cwc.citadelgroup.com.my/ | grep -o '<title>.*</title>'
# Expected: page title

# SSL
echo | openssl s_client -connect cwc.citadelgroup.com.my:443 2>/dev/null | \
  openssl x509 -noout -dates
# Expected: valid dates, not expired

# S3 (file upload test)
# Upload a test file via the app and verify it appears in DigitalOcean Spaces

# SSE (real-time notifications)
# Login to app, open browser devtools → Network → EventSource
# Should see /api/v1/notifications/sse connection

# PM2
pm2 status
# Expected: cwc-backend online, 0 restarts

# LOGS
pm2 logs cwc-backend --lines 20
# Expected: no errors, "Server running on port 3000 in production mode"
```

---

## B.17 Troubleshooting

### Backend won't start

```bash
# Check PM2 logs
pm2 logs cwc-backend --lines 50

# Common issues:
# - Missing JWT_SECRET or JWT_REFRESH_SECRET → generate and add to .env
# - DATABASE_URL wrong → check credentials, run: psql -U cwc_admin -d help_center
# - Port 3000 in use → lsof -i :3000

# Run backend manually for debugging
cd /var/www/citadel-cwc-portal/backend
NODE_ENV=production node dist/index.js
```

### Database connection failed

```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Test connection
psql -U cwc_admin -d help_center -h localhost

# Check pg_hba.conf for auth method
sudo cat /etc/postgresql/15/main/pg_hba.conf
# Should have: local all cwc_admin md5
#              host  all cwc_admin 127.0.0.1/32 md5
```

### Redis connection failed

```bash
sudo systemctl status redis-server
redis-cli -a YOUR_PASSWORD ping

# Check bind address
sudo grep "^bind" /etc/redis/redis.conf
# Should be: bind 127.0.0.1
```

### Frontend shows blank page

```bash
# Check that dist/ was built
ls -la /var/www/citadel-cwc-portal/frontend/dist/

# Check index.html references correct asset paths
cat /var/www/citadel-cwc-portal/frontend/dist/index.html | head -20

# Verify VITE_API_URL was set during build
grep -r "api/v1" /var/www/citadel-cwc-portal/frontend/dist/assets/*.js | head -3
# Should show: https://cwc.citadelgroup.com.my/api/v1
```

### CORS errors in browser

```bash
# Check backend .env has correct CORS_ORIGIN
grep CORS_ORIGIN /var/www/citadel-cwc-portal/backend/.env
# Must be: CORS_ORIGIN=https://cwc.citadelgroup.com.my

# Check Nginx is passing correct headers
curl -sI https://cwc.citadelgroup.com.my/api/v1/auth/login | grep -i cors
```

### Cookie not set / Auth not working

Production cookies require:
- `COOKIE_SAME_SITE=lax` (or `none` for cross-domain)
- If `COOKIE_SAME_SITE=none`, cookies MUST be secure (HTTPS)
- `COOKIE_DOMAIN=.citadelgroup.com.my` (dot prefix for subdomain sharing)
- CORS must include credentials

### 502 Bad Gateway

```bash
# Backend is down or Nginx can't reach it
pm2 status
curl http://localhost:3000/health
sudo nginx -t
```

### File uploads not working

```bash
# Verify S3 config
grep "S3_" /var/www/citadel-cwc-portal/backend/.env

# Test S3 connection from server
node -e "
const { S3Client, ListBucketsCommand } = require('@aws-sdk/client-s3');
const s3 = new S3Client({
  endpoint: 'https://sgp1.digitaloceanspaces.com',
  region: 'sgp1',
  credentials: { accessKeyId: 'DO801TLAFUY4ZELCC4ZA', secretAccessKey: 'YOUR_KEY' },
  forcePathStyle: false,
});
s3.send(new ListBucketsCommand({})).then(r => console.log(r)).catch(e => console.error(e));
"
```

---

## Quick Reference: All Server Ports

| Port | Service | Exposed |
|------|---------|---------|
| 22 | SSH | Yes |
| 80 | Nginx (HTTP → HTTPS redirect) | Yes |
| 443 | Nginx (HTTPS) | Yes |
| 3000 | Backend (Node.js) | No (Nginx proxies) |
| 5432 | PostgreSQL | No (localhost only) |
| 6379 | Redis | No (localhost only) |

---

## Quick Reference: File Paths

| Path | Purpose |
|------|---------|
| `/var/www/citadel-cwc-portal/` | Application root |
| `/var/www/citadel-cwc-portal/backend/` | Backend |
| `/var/www/citadel-cwc-portal/frontend/dist/` | Frontend static build |
| `/var/www/citadel-cwc-portal/backend/.env` | Backend env vars |
| `/var/www/citadel-cwc-portal/frontend/.env.production` | Frontend env vars |
| `/var/www/citadel-cwc-portal/backend/uploads/` | Uploaded files (if local storage) |
| `/var/www/citadel-cwc-portal/backend/logs/` | Application logs |
| `/var/www/backups/` | Database backups |
| `/etc/nginx/sites-available/cwc` | Nginx config |
| `/etc/letsencrypt/live/cwc.citadelgroup.com.my/` | SSL certs |

---

*Generated for CWC 2.0 — Citadel Group Technologies Sdn Bhd*
*Last updated: May 2026*