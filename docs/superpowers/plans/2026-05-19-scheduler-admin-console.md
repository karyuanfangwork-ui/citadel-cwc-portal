# Scheduler Admin Console Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Scheduler" tab to Admin Settings that lets admins view, edit, enable/disable, and manually trigger all background cron/BullMQ jobs, with changes persisted to PostgreSQL.

**Architecture:** A new `SchedulerConfig` Prisma table stores one row per job. A `scheduler.service.ts` owns a `Map<jobKey, handle>` of live task handles and exposes start/stop/trigger per-job. A REST API at `/api/v1/admin/scheduler` wires the service to HTTP. Existing job files (`sla-checker.ts`, `crm-checker.ts`, `monitor.job.ts`) are refactored to accept a `JobConfig` param instead of reading env vars.

**Tech Stack:** Node.js, Express, Prisma/PostgreSQL, node-cron, BullMQ, React 19, Tailwind CSS, Axios

---

## File Map

**Backend — new files:**
- `backend/src/services/scheduler.service.ts` — central service: Map of handles, initScheduler(), start/stop/trigger per jobKey
- `backend/src/controllers/scheduler.controller.ts` — REST handlers
- `backend/src/routes/scheduler.routes.ts` — router + permission guard

**Backend — modified files:**
- `backend/prisma/schema.prisma` — add `SchedulerConfig` model
- `backend/src/jobs/sla-checker.ts` — accept `JobConfig` param, remove env-var reads
- `backend/src/jobs/crm-checker.ts` — accept per-job `JobConfig` map, remove env-var reads
- `backend/src/credit/jobs/monitor.job.ts` — accept `JobConfig` param, remove hardcoded interval
- `backend/src/routes/index.ts` — mount scheduler router
- `backend/src/index.ts` — replace `startSlaChecker()` + `startCrmChecker()` with `initScheduler()`

**Frontend — new files:**
- `frontend/src/services/scheduler.service.ts` — Axios calls for GET, PATCH, POST trigger/restart
- `frontend/src/components/admin/SchedulerSettings.tsx` — full tab UI

**Frontend — modified files:**
- `frontend/src/components/admin/adminConstants.ts` — add `scheduler` tab to Configuration group
- `frontend/pages/AdminSettings.tsx` — import + render SchedulerSettings tab

---

## Task 1: Prisma Schema — Add SchedulerConfig model

**Files:**
- Modify: `backend/prisma/schema.prisma`

- [ ] **Step 1: Add model to schema**

Open `backend/prisma/schema.prisma` and append this model at the end of the file:

```prisma
model SchedulerConfig {
  id         String    @id @default(cuid())
  jobKey     String    @unique
  label      String
  enabled    Boolean   @default(true)
  mode       String    @default("cron")
  cronExpr   String?
  intervalMs Int?
  lastRunAt  DateTime?
  lastStatus String?
  lastError  String?
  updatedAt  DateTime  @updatedAt
  updatedBy  String?
}
```

- [ ] **Step 2: Run migration**

```bash
cd backend && npx prisma migrate dev --name add_scheduler_config
```

Expected: `The following migration(s) have been created and applied... add_scheduler_config`

- [ ] **Step 3: Regenerate Prisma client**

```bash
cd backend && npm run prisma:generate
```

Expected: `Generated Prisma Client`

- [ ] **Step 4: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/
git commit -m "feat(scheduler): add SchedulerConfig prisma model"
```

---

## Task 2: Refactor sla-checker.ts to accept JobConfig

**Files:**
- Modify: `backend/src/jobs/sla-checker.ts`

- [ ] **Step 1: Replace file content**

Replace the entire contents of `backend/src/jobs/sla-checker.ts` with:

```typescript
import cron, { ScheduledTask } from 'node-cron';
import { checkSlaBreaches, checkEscalations } from '../services/sla.service';
import { checkStalePauses } from '../services/sla-pause.service';
import { logger } from '../utils/logger';

export interface JobConfig {
  enabled: boolean;
  mode: 'cron' | 'interval';
  cronExpr?: string;
  intervalMs?: number;
}

let intervalId: ReturnType<typeof setInterval> | null = null;
let cronTask: ScheduledTask | null = null;

export async function runSlaChecks(): Promise<void> {
  await checkStalePauses().catch((err) => logger.error('Stale SLA pause check failed', { error: err }));
  await checkSlaBreaches().catch((err) => logger.error('SLA breach check failed', { error: err }));
  await checkEscalations().catch((err) => logger.error('SLA escalation check failed', { error: err }));
}

export function startSlaChecker(cfg: JobConfig): void {
  stopSlaChecker();
  if (!cfg.enabled) {
    logger.info('SLA checker disabled — skipping');
    return;
  }
  if (cfg.mode === 'cron') {
    const expr = cfg.cronExpr || '0 9 * * 1-5';
    if (!cron.validate(expr)) {
      logger.error(`Invalid SLA cron expression: "${expr}". Falling back to interval (60s).`);
      startSlaIntervalMode(60000);
      return;
    }
    runSlaChecks();
    cronTask = cron.schedule(expr, () => {
      logger.info(`SLA checker running (cron: ${expr})`);
      runSlaChecks();
    });
    logger.info(`SLA checker started (cron: ${expr})`);
  } else {
    startSlaIntervalMode(cfg.intervalMs || 60000);
  }
}

function startSlaIntervalMode(ms: number): void {
  logger.info(`SLA checker started (interval: ${ms / 1000}s)`);
  runSlaChecks();
  intervalId = setInterval(() => { runSlaChecks(); }, ms);
}

export function stopSlaChecker(): void {
  if (intervalId) { clearInterval(intervalId); intervalId = null; }
  if (cronTask) { cronTask.stop(); cronTask = null; }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd backend && npx tsc --noEmit 2>&1 | grep sla-checker
```

Expected: no output (no errors)

- [ ] **Step 3: Commit**

```bash
git add backend/src/jobs/sla-checker.ts
git commit -m "feat(scheduler): refactor sla-checker to accept JobConfig param"
```

---

## Task 3: Refactor crm-checker.ts to accept per-job JobConfig map

**Files:**
- Modify: `backend/src/jobs/crm-checker.ts`

- [ ] **Step 1: Replace file content**

Replace the entire contents of `backend/src/jobs/crm-checker.ts` with:

```typescript
import cron, { ScheduledTask } from 'node-cron';
import {
  checkActivityReminders,
  checkLeadAging,
  checkOverdueFollowUps,
  checkStaleDeals,
  checkTrustReviewDates,
  checkKycExpiration,
  checkRepInactivity,
} from '../services/crm-automation.service';
import { logger } from '../utils/logger';

export interface JobConfig {
  enabled: boolean;
  mode: 'cron' | 'interval';
  cronExpr?: string;
  intervalMs?: number;
}

export type CrmJobKey =
  | 'crm.activity_reminders'
  | 'crm.lead_aging'
  | 'crm.overdue_followups'
  | 'crm.stale_deals'
  | 'crm.trust_reviews'
  | 'crm.kyc_expiration'
  | 'crm.rep_inactivity';

export const CRM_JOB_FNS: Record<CrmJobKey, () => Promise<void>> = {
  'crm.activity_reminders': () => checkActivityReminders().catch((e) => logger.error('[CRM] Activity reminders failed', { error: e })),
  'crm.lead_aging':         () => checkLeadAging().catch((e) => logger.error('[CRM] Lead aging failed', { error: e })),
  'crm.overdue_followups':  () => checkOverdueFollowUps().catch((e) => logger.error('[CRM] Overdue follow-ups failed', { error: e })),
  'crm.stale_deals':        () => checkStaleDeals().catch((e) => logger.error('[CRM] Stale deals failed', { error: e })),
  'crm.trust_reviews':      () => checkTrustReviewDates().catch((e) => logger.error('[CRM] Trust reviews failed', { error: e })),
  'crm.kyc_expiration':     () => checkKycExpiration().catch((e) => logger.error('[CRM] KYC expiration failed', { error: e })),
  'crm.rep_inactivity':     () => checkRepInactivity().catch((e) => logger.error('[CRM] Rep inactivity failed', { error: e })),
};

const tasks = new Map<CrmJobKey, ScheduledTask | ReturnType<typeof setInterval>>();

export function startCrmJob(jobKey: CrmJobKey, cfg: JobConfig): void {
  stopCrmJob(jobKey);
  if (!cfg.enabled) {
    logger.info(`[CRM] ${jobKey} disabled — skipping`);
    return;
  }
  const fn = CRM_JOB_FNS[jobKey];
  if (cfg.mode === 'cron') {
    const expr = cfg.cronExpr || '0 9 * * 1-5';
    if (!cron.validate(expr)) {
      logger.error(`[CRM] Invalid cron for ${jobKey}: "${expr}" — skipping`);
      return;
    }
    const task = cron.schedule(expr, () => {
      logger.info(`[CRM] ${jobKey} running (cron: ${expr})`);
      fn();
    });
    tasks.set(jobKey, task);
    logger.info(`[CRM] ${jobKey} scheduled (cron: ${expr})`);
  } else {
    const ms = cfg.intervalMs || 3600000;
    const id = setInterval(() => { fn(); }, ms);
    tasks.set(jobKey, id);
    logger.info(`[CRM] ${jobKey} started (interval: ${ms / 1000}s)`);
  }
}

export function stopCrmJob(jobKey: CrmJobKey): void {
  const handle = tasks.get(jobKey);
  if (!handle) return;
  if (typeof handle === 'object' && 'stop' in handle) {
    (handle as ScheduledTask).stop();
  } else {
    clearInterval(handle as ReturnType<typeof setInterval>);
  }
  tasks.delete(jobKey);
}

export function startCrmChecker(configs: Record<CrmJobKey, JobConfig>): void {
  (Object.keys(configs) as CrmJobKey[]).forEach((key) => startCrmJob(key, configs[key]));
}

export function stopCrmChecker(): void {
  (Object.keys(CRM_JOB_FNS) as CrmJobKey[]).forEach(stopCrmJob);
  logger.info('[CRM] All CRM jobs stopped');
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd backend && npx tsc --noEmit 2>&1 | grep crm-checker
```

Expected: no output

- [ ] **Step 3: Commit**

```bash
git add backend/src/jobs/crm-checker.ts
git commit -m "feat(scheduler): refactor crm-checker to accept per-job JobConfig map"
```

---

## Task 4: Refactor monitor.job.ts to accept JobConfig

**Files:**
- Modify: `backend/src/credit/jobs/monitor.job.ts`

- [ ] **Step 1: Add JobConfig import and param to startMonitorJob**

At the top of `backend/src/credit/jobs/monitor.job.ts`, add the import (after existing imports):

```typescript
import { JobConfig } from '../../jobs/sla-checker';
```

Then replace the `startMonitorJob` function signature and repeat interval line:

```typescript
export function startMonitorJob(cfg: JobConfig = { enabled: true, mode: 'interval', intervalMs: 86400000 }) {
  if (!cfg.enabled) {
    logger.info('[MonitorJob] Credit monitor disabled — skipping');
    return;
  }
  try {
    monitorQueue = new Queue(QUEUE_NAME, { connection: REDIS_CONFIG });

    monitorWorker = new Worker(QUEUE_NAME, async () => {
      await processDailyCheck();
    }, { connection: REDIS_CONFIG });

    const repeatMs = cfg.intervalMs || 86400000;
    monitorQueue.add('daily-check', {}, {
      repeat: { every: repeatMs },
    });

    logger.info(`[MonitorJob] Started monitoring queue: ${QUEUE_NAME} (interval: ${repeatMs / 1000}s)`);
  } catch (error) {
    logger.warn(`[MonitorJob] Could not start monitoring job (Redis may not be available): ${error}`);
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd backend && npx tsc --noEmit 2>&1 | grep monitor.job
```

Expected: no output

- [ ] **Step 3: Commit**

```bash
git add backend/src/credit/jobs/monitor.job.ts
git commit -m "feat(scheduler): refactor monitor.job to accept JobConfig param"
```

---

## Task 5: Create scheduler.service.ts

**Files:**
- Create: `backend/src/services/scheduler.service.ts`

- [ ] **Step 1: Create the service file**

Create `backend/src/services/scheduler.service.ts`:

```typescript
import cron from 'node-cron';
import prisma from '../utils/prisma';
import { logger } from '../utils/logger';
import { startSlaChecker, stopSlaChecker, runSlaChecks, JobConfig } from '../jobs/sla-checker';
import { startCrmJob, stopCrmJob, CrmJobKey, CRM_JOB_FNS } from '../jobs/crm-checker';
import { startMonitorJob, stopMonitorJob, processDailyCheck } from '../credit/jobs/monitor.job';

export interface SchedulerConfigRow {
  id: string;
  jobKey: string;
  label: string;
  enabled: boolean;
  mode: string;
  cronExpr: string | null;
  intervalMs: number | null;
  lastRunAt: Date | null;
  lastStatus: string | null;
  lastError: string | null;
  updatedAt: Date;
  updatedBy: string | null;
}

const DEFAULT_CONFIGS: Omit<SchedulerConfigRow, 'id' | 'updatedAt'>[] = [
  { jobKey: 'sla',                    label: 'SLA Checker',              enabled: true, mode: 'cron', cronExpr: process.env.SLA_CRON_EXPRESSION || '0 9 * * 1-5', intervalMs: null, lastRunAt: null, lastStatus: null, lastError: null, updatedBy: null },
  { jobKey: 'crm.activity_reminders', label: 'CRM: Activity Reminders',  enabled: true, mode: 'cron', cronExpr: '0 */4 * * *',   intervalMs: null, lastRunAt: null, lastStatus: null, lastError: null, updatedBy: null },
  { jobKey: 'crm.lead_aging',         label: 'CRM: Lead Aging',          enabled: true, mode: 'cron', cronExpr: '0 8 * * 1-5',   intervalMs: null, lastRunAt: null, lastStatus: null, lastError: null, updatedBy: null },
  { jobKey: 'crm.overdue_followups',  label: 'CRM: Overdue Follow-Ups',  enabled: true, mode: 'cron', cronExpr: '30 8 * * 1-5',  intervalMs: null, lastRunAt: null, lastStatus: null, lastError: null, updatedBy: null },
  { jobKey: 'crm.stale_deals',        label: 'CRM: Stale Deals',         enabled: true, mode: 'cron', cronExpr: '0 9 * * 1-5',   intervalMs: null, lastRunAt: null, lastStatus: null, lastError: null, updatedBy: null },
  { jobKey: 'crm.trust_reviews',      label: 'CRM: Trust Review Dates',  enabled: true, mode: 'cron', cronExpr: '0 10 * * 1-5',  intervalMs: null, lastRunAt: null, lastStatus: null, lastError: null, updatedBy: null },
  { jobKey: 'crm.kyc_expiration',     label: 'CRM: KYC Expiration',      enabled: true, mode: 'cron', cronExpr: '0 6 * * 1-5',   intervalMs: null, lastRunAt: null, lastStatus: null, lastError: null, updatedBy: null },
  { jobKey: 'crm.rep_inactivity',     label: 'CRM: Rep Inactivity',      enabled: true, mode: 'cron', cronExpr: '0 16 * * 1-5',  intervalMs: null, lastRunAt: null, lastStatus: null, lastError: null, updatedBy: null },
  { jobKey: 'credit.monitor',         label: 'Credit Daily Monitor',     enabled: true, mode: 'interval', cronExpr: null, intervalMs: 86400000, lastRunAt: null, lastStatus: null, lastError: null, updatedBy: null },
];

async function seedDefaults(): Promise<void> {
  for (const cfg of DEFAULT_CONFIGS) {
    await prisma.schedulerConfig.upsert({
      where: { jobKey: cfg.jobKey },
      update: {},
      create: cfg,
    });
  }
  logger.info('[Scheduler] Default configs seeded');
}

function toJobConfig(row: SchedulerConfigRow): JobConfig {
  return {
    enabled: row.enabled,
    mode: row.mode as 'cron' | 'interval',
    cronExpr: row.cronExpr ?? undefined,
    intervalMs: row.intervalMs ?? undefined,
  };
}

function startJobByKey(row: SchedulerConfigRow): void {
  const cfg = toJobConfig(row);
  if (row.jobKey === 'sla') {
    startSlaChecker(cfg);
  } else if (row.jobKey.startsWith('crm.')) {
    startCrmJob(row.jobKey as CrmJobKey, cfg);
  } else if (row.jobKey === 'credit.monitor') {
    startMonitorJob(cfg);
  }
}

function stopJobByKey(jobKey: string): void {
  if (jobKey === 'sla') {
    stopSlaChecker();
  } else if (jobKey.startsWith('crm.')) {
    stopCrmJob(jobKey as CrmJobKey);
  } else if (jobKey === 'credit.monitor') {
    stopMonitorJob();
  }
}

export async function initScheduler(): Promise<void> {
  const count = await prisma.schedulerConfig.count();
  if (count === 0) await seedDefaults();

  const rows = await prisma.schedulerConfig.findMany();
  for (const row of rows) {
    startJobByKey(row as SchedulerConfigRow);
  }
  logger.info(`[Scheduler] Initialized ${rows.length} jobs`);
}

export async function shutdownScheduler(): Promise<void> {
  stopSlaChecker();
  stopCrmJob('crm.activity_reminders');
  stopCrmJob('crm.lead_aging');
  stopCrmJob('crm.overdue_followups');
  stopCrmJob('crm.stale_deals');
  stopCrmJob('crm.trust_reviews');
  stopCrmJob('crm.kyc_expiration');
  stopCrmJob('crm.rep_inactivity');
  await stopMonitorJob();
  logger.info('[Scheduler] All jobs stopped');
}

export async function listConfigs(): Promise<SchedulerConfigRow[]> {
  return prisma.schedulerConfig.findMany({ orderBy: { jobKey: 'asc' } }) as Promise<SchedulerConfigRow[]>;
}

export async function updateConfig(
  jobKey: string,
  patch: { enabled?: boolean; mode?: string; cronExpr?: string | null; intervalMs?: number | null },
  updatedBy: string,
): Promise<SchedulerConfigRow> {
  const existing = await prisma.schedulerConfig.findUnique({ where: { jobKey } });
  if (!existing) throw Object.assign(new Error(`Unknown jobKey: ${jobKey}`), { status: 404 });

  if (patch.mode === 'cron' && patch.cronExpr && !cron.validate(patch.cronExpr)) {
    throw Object.assign(new Error(`Invalid cron expression: "${patch.cronExpr}"`), { status: 400 });
  }

  const updated = await prisma.schedulerConfig.update({
    where: { jobKey },
    data: { ...patch, updatedBy },
  });
  return updated as SchedulerConfigRow;
}

export async function restartJob(jobKey: string): Promise<void> {
  const row = await prisma.schedulerConfig.findUnique({ where: { jobKey } });
  if (!row) throw Object.assign(new Error(`Unknown jobKey: ${jobKey}`), { status: 404 });
  stopJobByKey(jobKey);
  startJobByKey(row as SchedulerConfigRow);
  logger.info(`[Scheduler] Restarted job: ${jobKey}`);
}

export async function triggerJob(jobKey: string): Promise<void> {
  const row = await prisma.schedulerConfig.findUnique({ where: { jobKey } });
  if (!row) throw Object.assign(new Error(`Unknown jobKey: ${jobKey}`), { status: 404 });

  try {
    if (jobKey === 'sla') {
      await runSlaChecks();
    } else if (jobKey.startsWith('crm.')) {
      await CRM_JOB_FNS[jobKey as CrmJobKey]();
    } else if (jobKey === 'credit.monitor') {
      await processDailyCheck();
    }
    await prisma.schedulerConfig.update({
      where: { jobKey },
      data: { lastRunAt: new Date(), lastStatus: 'success', lastError: null },
    });
  } catch (err: any) {
    await prisma.schedulerConfig.update({
      where: { jobKey },
      data: { lastRunAt: new Date(), lastStatus: 'error', lastError: String(err?.message || err) },
    });
    throw err;
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd backend && npx tsc --noEmit 2>&1 | grep scheduler.service
```

Expected: no output

- [ ] **Step 3: Commit**

```bash
git add backend/src/services/scheduler.service.ts
git commit -m "feat(scheduler): add scheduler.service.ts — central init/stop/trigger"
```

---

## Task 6: Create scheduler.controller.ts and scheduler.routes.ts

**Files:**
- Create: `backend/src/controllers/scheduler.controller.ts`
- Create: `backend/src/routes/scheduler.routes.ts`

- [ ] **Step 1: Create controller**

Create `backend/src/controllers/scheduler.controller.ts`:

```typescript
import { Request, Response, NextFunction } from 'express';
import * as schedulerService from '../services/scheduler.service';

export async function listJobs(req: Request, res: Response, next: NextFunction) {
  try {
    const configs = await schedulerService.listConfigs();
    res.json({ jobs: configs });
  } catch (err) { next(err); }
}

export async function updateJob(req: Request, res: Response, next: NextFunction) {
  try {
    const { jobKey } = req.params;
    const { enabled, mode, cronExpr, intervalMs } = req.body;
    const userId = (req as any).user?.id || 'system';
    const updated = await schedulerService.updateConfig(jobKey, { enabled, mode, cronExpr, intervalMs }, userId);
    res.json({ job: updated });
  } catch (err: any) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
}

export async function triggerJob(req: Request, res: Response, next: NextFunction) {
  try {
    const { jobKey } = req.params;
    await schedulerService.triggerJob(jobKey);
    res.json({ triggered: true, jobKey });
  } catch (err: any) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
}

export async function restartJob(req: Request, res: Response, next: NextFunction) {
  try {
    const { jobKey } = req.params;
    await schedulerService.restartJob(jobKey);
    res.json({ restarted: true, jobKey });
  } catch (err: any) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
}
```

- [ ] **Step 2: Create router**

Create `backend/src/routes/scheduler.routes.ts`:

```typescript
import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { listJobs, updateJob, triggerJob, restartJob } from '../controllers/scheduler.controller';

const router = Router();

router.use(authenticate, requirePermission('admin:access'));

router.get('/', listJobs);
router.patch('/:jobKey', updateJob);
router.post('/:jobKey/trigger', triggerJob);
router.post('/:jobKey/restart', restartJob);

export default router;
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd backend && npx tsc --noEmit 2>&1 | grep -E "scheduler\.(controller|routes)"
```

Expected: no output

- [ ] **Step 4: Commit**

```bash
git add backend/src/controllers/scheduler.controller.ts backend/src/routes/scheduler.routes.ts
git commit -m "feat(scheduler): add scheduler controller and routes"
```

---

## Task 7: Wire scheduler into routes/index.ts and index.ts

**Files:**
- Modify: `backend/src/routes/index.ts`
- Modify: `backend/src/index.ts`

- [ ] **Step 1: Mount scheduler router in routes/index.ts**

In `backend/src/routes/index.ts`, add after the last import line:

```typescript
import schedulerRoutes from './scheduler.routes';
```

Then add after the existing route mounts (find the line `router.use('/credit', creditRoutes)` and add below it):

```typescript
router.use('/admin/scheduler', schedulerRoutes);
```

- [ ] **Step 2: Replace job startup in index.ts**

In `backend/src/index.ts`, replace:

```typescript
import { startSlaChecker, stopSlaChecker } from './jobs/sla-checker';
import { startCrmChecker, stopCrmChecker } from './jobs/crm-checker';
```

with:

```typescript
import { initScheduler, shutdownScheduler } from './services/scheduler.service';
```

Then replace:

```typescript
    startSlaChecker();
    startCrmChecker();
```

with:

```typescript
    initScheduler();
```

Then in `gracefulShutdown`, replace:

```typescript
    stopSlaChecker();
    stopCrmChecker();
```

with:

```typescript
    await shutdownScheduler();
```

- [ ] **Step 3: Verify TypeScript compiles clean**

```bash
cd backend && npx tsc --noEmit 2>&1
```

Expected: no errors

- [ ] **Step 4: Start the backend and check logs**

```bash
cd backend && npm run dev 2>&1 | head -20
```

Expected: logs show `[Scheduler] Initialized 9 jobs` and individual job start messages.

- [ ] **Step 5: Test the GET endpoint**

```bash
curl -s http://localhost:3000/api/v1/admin/scheduler \
  -H "Authorization: Bearer $(curl -s -X POST http://localhost:3000/api/v1/auth/login \
    -H 'Content-Type: application/json' \
    -d '{"email":"admin@test.local","password":"abc@123"}' | jq -r .token)" | jq '.jobs | length'
```

Expected: `9`

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/index.ts backend/src/index.ts
git commit -m "feat(scheduler): wire initScheduler into app startup and mount API routes"
```

---

## Task 8: Frontend — scheduler.service.ts

**Files:**
- Create: `frontend/src/services/scheduler.service.ts`

- [ ] **Step 1: Create service file**

Create `frontend/src/services/scheduler.service.ts`:

```typescript
import api from './api';

export interface SchedulerJob {
  id: string;
  jobKey: string;
  label: string;
  enabled: boolean;
  mode: 'cron' | 'interval';
  cronExpr: string | null;
  intervalMs: number | null;
  lastRunAt: string | null;
  lastStatus: 'success' | 'error' | null;
  lastError: string | null;
  updatedAt: string;
  updatedBy: string | null;
}

export interface UpdateJobPayload {
  enabled?: boolean;
  mode?: 'cron' | 'interval';
  cronExpr?: string | null;
  intervalMs?: number | null;
}

export const schedulerService = {
  async listJobs(): Promise<SchedulerJob[]> {
    const res = await api.get('/admin/scheduler');
    return res.data.jobs;
  },

  async updateJob(jobKey: string, payload: UpdateJobPayload): Promise<SchedulerJob> {
    const res = await api.patch(`/admin/scheduler/${jobKey}`, payload);
    return res.data.job;
  },

  async triggerJob(jobKey: string): Promise<void> {
    await api.post(`/admin/scheduler/${jobKey}/trigger`);
  },

  async restartJob(jobKey: string): Promise<void> {
    await api.post(`/admin/scheduler/${jobKey}/restart`);
  },
};
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep scheduler.service
```

Expected: no output

- [ ] **Step 3: Commit**

```bash
git add frontend/src/services/scheduler.service.ts
git commit -m "feat(scheduler): add frontend scheduler.service.ts"
```

---

## Task 9: Frontend — SchedulerSettings.tsx

**Files:**
- Create: `frontend/src/components/admin/SchedulerSettings.tsx`

- [ ] **Step 1: Create component**

Create `frontend/src/components/admin/SchedulerSettings.tsx`:

```tsx
import React, { useEffect, useState, useCallback } from 'react';
import { schedulerService, SchedulerJob, UpdateJobPayload } from '../../services/scheduler.service';

function parseCronHint(expr: string): string {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return expr;
  const [min, hour, , , dow] = parts;
  const days = dow === '*' ? 'every day' : dow === '1-5' ? 'Mon–Fri' : `day ${dow}`;
  const time = hour === '*' ? 'every hour' : `${hour.padStart(2, '0')}:${min.padStart(2, '0')}`;
  if (hour.startsWith('*/')) return `Every ${hour.slice(2)} hours`;
  return `${days} at ${time}`;
}

function formatInterval(ms: number): string {
  if (ms >= 3600000) return `Every ${ms / 3600000}h`;
  if (ms >= 60000) return `Every ${ms / 60000}min`;
  return `Every ${ms / 1000}s`;
}

function timeAgo(dt: string | null): string {
  if (!dt) return 'Never';
  const diff = Date.now() - new Date(dt).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const CRM_KEYS = [
  'crm.activity_reminders', 'crm.lead_aging', 'crm.overdue_followups',
  'crm.stale_deals', 'crm.trust_reviews', 'crm.kyc_expiration', 'crm.rep_inactivity',
];

interface EditState extends UpdateJobPayload {
  jobKey: string;
  cronInput: string;
  intervalInput: string;
  intervalUnit: 'minutes' | 'hours';
  cronError: string;
}

export default function SchedulerSettings() {
  const [jobs, setJobs] = useState<SchedulerJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [crmExpanded, setCrmExpanded] = useState(true);
  const [saving, setSaving] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setJobs(await schedulerService.listJobs());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleToggle(job: SchedulerJob) {
    try {
      await schedulerService.updateJob(job.jobKey, { enabled: !job.enabled });
      await schedulerService.restartJob(job.jobKey);
      await load();
      showToast(`${job.label} ${!job.enabled ? 'enabled' : 'disabled'}`);
    } catch {
      showToast('Failed to update job');
    }
  }

  async function handleTrigger(job: SchedulerJob) {
    try {
      await schedulerService.triggerJob(job.jobKey);
      showToast(`${job.label} triggered successfully`);
      await load();
    } catch {
      showToast(`Failed to trigger ${job.label}`);
    }
  }

  function openEdit(job: SchedulerJob) {
    const intervalMs = job.intervalMs || 3600000;
    const isHours = intervalMs % 3600000 === 0;
    setEditState({
      jobKey: job.jobKey,
      mode: job.mode,
      cronInput: job.cronExpr || '',
      intervalInput: isHours ? String(intervalMs / 3600000) : String(intervalMs / 60000),
      intervalUnit: isHours ? 'hours' : 'minutes',
      cronError: '',
    });
  }

  async function handleSave() {
    if (!editState) return;
    let cronError = '';
    const payload: UpdateJobPayload = { mode: editState.mode };

    if (editState.mode === 'cron') {
      if (!editState.cronInput.trim()) { cronError = 'Cron expression is required'; }
      payload.cronExpr = editState.cronInput.trim();
    } else {
      const val = Number(editState.intervalInput);
      if (!val || val < 1) { cronError = 'Interval must be a positive number'; }
      payload.intervalMs = editState.intervalUnit === 'hours' ? val * 3600000 : val * 60000;
    }

    if (cronError) { setEditState({ ...editState, cronError }); return; }

    setSaving(true);
    try {
      await schedulerService.updateJob(editState.jobKey, payload);
      await schedulerService.restartJob(editState.jobKey);
      setEditState(null);
      await load();
      showToast('Schedule updated');
    } catch (err: any) {
      setEditState({ ...editState, cronError: err?.response?.data?.error || 'Save failed' });
    } finally {
      setSaving(false);
    }
  }

  function JobRow({ job }: { job: SchedulerJob }) {
    const isEditing = editState?.jobKey === job.jobKey;
    return (
      <div className="border border-gray-100 rounded-lg p-4 mb-2 bg-white">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex-1 min-w-[160px]">
            <span className="font-medium text-gray-800 text-sm">{job.label}</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleToggle(job)}
              className={`relative inline-flex h-5 w-10 rounded-full transition-colors ${job.enabled ? 'bg-blue-600' : 'bg-gray-300'}`}
            >
              <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${job.enabled ? 'translate-x-5' : ''}`} />
            </button>
            <span className="text-xs text-gray-500 ml-1">{job.enabled ? 'On' : 'Off'}</span>
          </div>
          <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${job.mode === 'cron' ? 'bg-indigo-50 text-indigo-700' : 'bg-amber-50 text-amber-700'}`}>
            {job.mode}
          </span>
          <div className="text-xs text-gray-500 min-w-[140px]">
            {job.mode === 'cron'
              ? <><span className="font-mono">{job.cronExpr}</span><br /><span className="text-gray-400">{job.cronExpr ? parseCronHint(job.cronExpr) : ''}</span></>
              : job.intervalMs ? formatInterval(job.intervalMs) : '—'}
          </div>
          <div className="text-xs min-w-[100px]">
            <span className="text-gray-500">{timeAgo(job.lastRunAt)}</span>
            {job.lastStatus && (
              <span className={`ml-1 px-1.5 py-0.5 rounded text-xs font-medium ${job.lastStatus === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {job.lastStatus}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={() => isEditing ? setEditState(null) : openEdit(job)} className="text-xs px-2 py-1 border border-gray-200 rounded hover:bg-gray-50">
              {isEditing ? 'Cancel' : 'Edit'}
            </button>
            <button onClick={() => handleTrigger(job)} className="text-xs px-2 py-1 bg-blue-50 text-blue-700 border border-blue-100 rounded hover:bg-blue-100">
              Run Now
            </button>
          </div>
        </div>

        {isEditing && editState && (
          <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
            <div className="flex gap-4">
              <label className="flex items-center gap-1.5 text-sm">
                <input type="radio" checked={editState.mode === 'cron'} onChange={() => setEditState({ ...editState, mode: 'cron', cronError: '' })} />
                Cron expression
              </label>
              <label className="flex items-center gap-1.5 text-sm">
                <input type="radio" checked={editState.mode === 'interval'} onChange={() => setEditState({ ...editState, mode: 'interval', cronError: '' })} />
                Interval
              </label>
            </div>

            {editState.mode === 'cron' ? (
              <div>
                <input
                  type="text"
                  value={editState.cronInput}
                  onChange={(e) => setEditState({ ...editState, cronInput: e.target.value, cronError: '' })}
                  placeholder="0 9 * * 1-5"
                  className="border border-gray-300 rounded px-3 py-1.5 text-sm font-mono w-64"
                />
                {editState.cronInput && !editState.cronError && (
                  <p className="text-xs text-gray-400 mt-1">{parseCronHint(editState.cronInput)}</p>
                )}
              </div>
            ) : (
              <div className="flex gap-2 items-center">
                <input
                  type="number"
                  min="1"
                  value={editState.intervalInput}
                  onChange={(e) => setEditState({ ...editState, intervalInput: e.target.value, cronError: '' })}
                  className="border border-gray-300 rounded px-3 py-1.5 text-sm w-24"
                />
                <select
                  value={editState.intervalUnit}
                  onChange={(e) => setEditState({ ...editState, intervalUnit: e.target.value as 'minutes' | 'hours' })}
                  className="border border-gray-300 rounded px-2 py-1.5 text-sm"
                >
                  <option value="minutes">minutes</option>
                  <option value="hours">hours</option>
                </select>
              </div>
            )}

            {editState.cronError && <p className="text-xs text-red-600">{editState.cronError}</p>}

            <button
              onClick={handleSave}
              disabled={saving}
              className="text-sm px-4 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save & Apply'}
            </button>
          </div>
        )}
      </div>
    );
  }

  if (loading) return <div className="p-8 text-center text-gray-400">Loading scheduler…</div>;

  const topJobs = jobs.filter((j) => !CRM_KEYS.includes(j.jobKey));
  const crmJobs = jobs.filter((j) => CRM_KEYS.includes(j.jobKey));

  return (
    <div className="max-w-4xl">
      <h2 className="text-lg font-semibold text-gray-800 mb-1">Scheduler</h2>
      <p className="text-sm text-gray-500 mb-6">Configure and control background job schedules. Changes apply immediately and persist across restarts.</p>

      {topJobs.map((j) => <JobRow key={j.jobKey} job={j} />)}

      <div className="mt-4">
        <button
          onClick={() => setCrmExpanded((v) => !v)}
          className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2"
        >
          <span className="material-icons text-base">{crmExpanded ? 'expand_less' : 'expand_more'}</span>
          CRM Automation ({crmJobs.length} jobs)
        </button>
        {crmExpanded && crmJobs.map((j) => <JobRow key={j.jobKey} job={j} />)}
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-lg shadow-lg z-[300]">
          {toast}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep SchedulerSettings
```

Expected: no output

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/admin/SchedulerSettings.tsx
git commit -m "feat(scheduler): add SchedulerSettings tab component"
```

---

## Task 10: Wire Scheduler tab into Admin Settings

**Files:**
- Modify: `frontend/src/components/admin/adminConstants.ts`
- Modify: `frontend/pages/AdminSettings.tsx`

- [ ] **Step 1: Add tab to adminConstants.ts**

In `frontend/src/components/admin/adminConstants.ts`, in the `ADMIN_TABS` array, add after the `email-notifications` entry (still in Configuration group):

```typescript
    { id: 'scheduler',        label: 'Scheduler',         icon: 'schedule',       group: 'Configuration' },
```

Also update the `AdminTabId` type — it's derived automatically from the array via `typeof ADMIN_TABS[number]['id']`, so no manual change needed.

- [ ] **Step 2: Wire component in AdminSettings.tsx**

In `frontend/pages/AdminSettings.tsx`, add the import after the other admin component imports:

```typescript
import SchedulerSettings from '../src/components/admin/SchedulerSettings';
```

Then in the tab render section (find the `switch` or conditional that renders tab content by `activeTab` id), add a case for `'scheduler'`:

```tsx
{activeTab === 'scheduler' && <SchedulerSettings />}
```

- [ ] **Step 3: Smoke test in browser**

Start frontend dev server:
```bash
cd frontend && npm run dev
```

1. Log in as `admin@test.local` / `abc@123`
2. Navigate to Admin Settings → Configuration group
3. Verify "Scheduler" tab appears with `schedule` icon
4. Click the tab — verify 9 job rows load (1 SLA, 7 CRM in collapsible group, 1 Credit Monitor)
5. Toggle a job on/off — verify toggle updates without page reload
6. Click "Edit" on SLA Checker — verify cron expression input and plain-English hint appear
7. Change cron to `0 10 * * 1-5`, click "Save & Apply" — verify success toast appears
8. Click "Run Now" on any job — verify triggered toast appears and Last Run updates

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/admin/adminConstants.ts frontend/pages/AdminSettings.tsx
git commit -m "feat(scheduler): add Scheduler tab to Admin Settings Configuration group"
```

---

## Self-Review Checklist

After completing all tasks, verify:

- [ ] `GET /api/v1/admin/scheduler` returns 9 jobs
- [ ] `PATCH /api/v1/admin/scheduler/sla` with invalid cron returns 400
- [ ] `PATCH /api/v1/admin/scheduler/unknown-key` returns 404
- [ ] `POST /api/v1/admin/scheduler/sla/trigger` updates `lastRunAt` in DB
- [ ] `POST /api/v1/admin/scheduler/sla/restart` applies new config live (check server logs)
- [ ] Disabling a job (`enabled: false`) + restart stops its cron/interval (check server logs)
- [ ] Credit monitor job now starts on server boot (check `[MonitorJob] Started` in logs)
- [ ] Frontend Scheduler tab visible in Admin Settings Configuration group
- [ ] CRM jobs collapse/expand correctly
- [ ] Edit form validates empty cron expression before save
- [ ] TypeScript compiles clean: `cd backend && npx tsc --noEmit && cd ../frontend && npx tsc --noEmit`
