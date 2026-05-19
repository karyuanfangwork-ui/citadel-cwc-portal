# Scheduler Admin Console — Design Spec
**Date:** 2026-05-19  
**Status:** Approved

---

## Overview

Add a "Scheduler" tab to the existing Admin Settings page (Configuration group) that lets admins view, edit, enable/disable, and manually trigger all background cron jobs at runtime. Changes persist to PostgreSQL and survive server restarts.

---

## Current State

Three background job files exist in the backend:

| File | Library | Jobs |
|------|---------|------|
| `backend/src/jobs/sla-checker.ts` | node-cron | SLA breaches, escalations, stale pauses |
| `backend/src/jobs/crm-checker.ts` | node-cron | 7 CRM automation checks |
| `backend/src/credit/jobs/monitor.job.ts` | BullMQ | Covenant, payment, facility review monitoring |

Configuration is currently env-var only. The credit monitor job is defined but **not wired to startup** (`startMonitorJob()` is never called in `index.ts`).

---

## Architecture: Option A — Thin API layer over existing job files

Existing job files are minimally changed to accept a config object instead of reading env vars directly. A new `SchedulerConfig` table persists config. A new REST API provides runtime control. The frontend adds one new tab.

---

## Data Model

```prisma
model SchedulerConfig {
  id         String    @id @default(cuid())
  jobKey     String    @unique  // e.g. "sla", "crm.activity_reminders"
  label      String             // Human-readable display name
  enabled    Boolean   @default(true)
  mode       String    @default("cron")  // "cron" | "interval"
  cronExpr   String?            // e.g. "0 9 * * 1-5"
  intervalMs Int?               // e.g. 60000
  lastRunAt  DateTime?
  lastStatus String?            // "success" | "error"
  lastError  String?
  updatedAt  DateTime  @updatedAt
  updatedBy  String?            // userId of last editor
}
```

**9 default rows seeded on first startup:**

| jobKey | label | Default cronExpr |
|--------|-------|-----------------|
| `sla` | SLA Checker | `0 9 * * 1-5` |
| `crm.activity_reminders` | CRM: Activity Reminders | `0 */4 * * *` |
| `crm.lead_aging` | CRM: Lead Aging | `0 8 * * 1-5` |
| `crm.overdue_followups` | CRM: Overdue Follow-Ups | `30 8 * * 1-5` |
| `crm.stale_deals` | CRM: Stale Deals | `0 9 * * 1-5` |
| `crm.trust_reviews` | CRM: Trust Review Dates | `0 10 * * 1-5` |
| `crm.kyc_expiration` | CRM: KYC Expiration | `0 6 * * 1-5` |
| `crm.rep_inactivity` | CRM: Rep Inactivity | `0 16 * * 1-5` |
| `credit.monitor` | Credit Daily Monitor | interval, 86400000ms |

Seed reads current env vars as defaults so existing deployments are not disrupted.

---

## Backend API

**Router:** `backend/src/routes/scheduler.routes.ts`  
**Controller:** `backend/src/controllers/scheduler.controller.ts`  
**Service:** `backend/src/services/scheduler.service.ts`  
**Mount point:** `/api/v1/admin/scheduler`  
**Auth:** All endpoints require `admin:access` permission

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | List all SchedulerConfig rows + live enabled/running status |
| `PATCH` | `/:jobKey` | Update config fields (enabled, mode, cronExpr, intervalMs) |
| `POST` | `/:jobKey/trigger` | Run job once immediately, out of schedule |
| `POST` | `/:jobKey/restart` | Stop current task handle and restart with latest DB config |

**Startup flow (`initScheduler()`):**
1. Called from `index.ts` after DB is ready
2. Reads all `SchedulerConfig` rows; seeds defaults if table is empty
3. For each enabled job, calls the appropriate `start*()` function with the DB config
4. Wires credit monitor (`startMonitorJob()`) — currently unwired, fixed here
5. Stores task handles in `Map<jobKey, ScheduledTask | Worker>`

**PATCH + live apply flow:**
1. Validate cron expression via `node-cron.validate()` if mode is `"cron"`
2. Write updated row to DB
3. Stop existing task handle from the Map
4. Start new task with updated config, update Map
5. Return updated config

**Trigger flow:**
1. Look up job function by jobKey
2. Execute directly (not via scheduler)
3. Update `lastRunAt` and `lastStatus` in DB
4. Return `{ triggered: true, jobKey }`

**Error handling:**
- Invalid cron expression → 400 with message
- Unknown jobKey → 404
- Job execution error on trigger → 500, `lastError` written to DB

---

## Job File Changes

Each job's `start*()` function signature changes from reading env vars to accepting a config object:

```typescript
// Before
export function startSlaChecker() { /* reads process.env */ }

// After
export function startSlaChecker(config: JobConfig) { /* uses config param */ }

interface JobConfig {
  enabled: boolean;
  mode: 'cron' | 'interval';
  cronExpr?: string;
  intervalMs?: number;
}
```

Env var fallback removed from job files — `initScheduler()` handles defaults from DB.

---

## Frontend

**New file:** `frontend/src/components/admin/SchedulerSettings.tsx`  
**Tab entry:** Added to `adminConstants.ts` in the **Configuration** group  
**API service:** New methods added to `frontend/src/services/admin.service.ts` (or new `scheduler.service.ts`)

### UI Layout

A card-based table with one row per job. CRM's 7 sub-jobs are grouped under a collapsible "CRM Automation" section.

**Per-row columns:**

| Column | Content |
|--------|---------|
| Job Name | Label string |
| Status | Enabled/Disabled toggle (calls PATCH + restart) |
| Mode | `cron` / `interval` badge |
| Schedule | Cron expression or interval display with plain-English hint |
| Last Run | Relative timestamp + success (green) / error (red) chip |
| Actions | Edit icon · Run Now button |

**Edit flow:**
- Inline expand or small modal
- Mode selector radio (cron / interval)
- Cron expression text input — shows plain-English description below (client-side parse)
- Interval input with unit selector (minutes / hours)
- Save → `PATCH /:jobKey` → `POST /:jobKey/restart` → refetch list
- Cancel discards changes

**Run Now:**
- `POST /:jobKey/trigger`
- Toast: "SLA Checker triggered successfully"
- Refetch row to update Last Run

**Error states:**
- Invalid cron expression shown inline before save
- API errors shown as toast

---

## Files to Create / Modify

**Backend — new:**
- `backend/src/routes/scheduler.routes.ts`
- `backend/src/controllers/scheduler.controller.ts`
- `backend/src/services/scheduler.service.ts`

**Backend — modified:**
- `backend/prisma/schema.prisma` — add `SchedulerConfig` model
- `backend/prisma/migrations/` — new migration
- `backend/src/jobs/sla-checker.ts` — accept config param
- `backend/src/jobs/crm-checker.ts` — accept config param
- `backend/src/credit/jobs/monitor.job.ts` — accept config param
- `backend/src/routes/index.ts` — mount scheduler router
- `backend/src/index.ts` — replace `startSlaChecker()` / `startCrmChecker()` calls with `initScheduler()`

**Frontend — new:**
- `frontend/src/components/admin/SchedulerSettings.tsx`
- `frontend/src/services/scheduler.service.ts`

**Frontend — modified:**
- `frontend/src/components/admin/adminConstants.ts` — add Scheduler tab to Configuration group
- `frontend/pages/AdminSettings.tsx` — import and wire SchedulerSettings tab

---

## Out of Scope

- BullMQ queue health dashboard (queue job counts, retry management) — future addition
- Per-job audit log of who changed what schedule
- Email/notification on job failure
- Multi-instance / clustered server support (single-node only)
