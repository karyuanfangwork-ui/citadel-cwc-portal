# Credit LOS Phase 8a — Close the Real Leak, Fix Two Failing Specs, Correct the Record

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Phase 8's three unverified claims true — Jest exits without `--forceExit`, the credit browser suite has zero failures, and `npm run test:release` actually runs — then correct the audit documents to the measured numbers.

**Architecture:** Phase 8 fixed the Redis *factory* but the leak is in BullMQ `Queue` objects, which build their own connections from a config object and never pass through the factory. Task 1 closes the queues. Tasks 2 and 3 fix two browser specs that fail on wrong assumptions about the UI (a row click that opens a preview rather than navigating, and a query parameter the list page does not read). Task 4 unblocks the release gate, which fails at its first step on a pre-existing seed defect. Task 5 replaces the recorded evidence with what was measured.

**Tech Stack:** BullMQ 5 + ioredis (`backend/src/queues/`, `backend/src/credit/queues/`), Jest 29 + ts-jest, Playwright 1.x (`frontend/e2e/credit/`, project `credit`), Prisma 5 + PostgreSQL.

## Global Constraints

- Everything runs against a **live stack**: backend on `http://localhost:3000`, frontend on `http://localhost:5173`.
- Seed prerequisite for browser tasks: `cd backend && npx tsx prisma/seed-credit.ts --demo --e2e`. **Note this currently fails** — Task 4 fixes it. Until then the database retains data from an earlier successful seed; Tasks 2 and 3 work against that.
- Two password families coexist in the seed: `admin@test.local` → `password123`; `e2e-analyst@test.local` / `e2e-approver@test.local` → `abc@123`.
- `docs/` is gitignored at `.gitignore:69`. Documentation commits require `git add -f`.
- Backend TypeScript must stay clean: `cd backend && npx tsc --noEmit` produces no output.
- Frontend has **three pre-existing** `tsc` errors that must not grow: two in `src/components/credit/ScoreOutdatedBanner.tsx` (lines 45, 47) and one in `src/test/setup.ts:11`. Any other error is a regression.
- **Standing rule, now three phases old:** a gap is closed when a test proves it, not when the code is written — and a test that cannot fail is not a test. Phase 8 recorded three claims that verification refuted. Every task below ends by *running* the thing it claims to fix and recording the observed output.
- **Never record a measured figure you did not observe.** Task 5 exists because doc 12 currently states `npm run test:release` "completes in under 30s, exit 0" for a command that exits 1 at its first step.

## Background: what verification found on 2026-08-10

Phase 8 shipped as commits `2667bd7` → `b91bce3`. Independent verification confirmed Tasks 1, 3 and 4 and refuted Task 6:

| Phase 8 claim | Measured |
|---|---|
| Handles closed in `afterAll`; `--forceExit` is only a backstop | `npx jest src/credit --runInBand` (no `--forceExit`): 1256 tests pass in 12.8s, then **"Jest did not exit"** — still running at 300s when killed. Identical to the pre-Phase-8 signature. |
| `npm run test:release` completes in under 30s, exit 0 | **Exit code 1** at the first step. |
| `npx playwright test --project=credit` → 16 passed, 2 skipped, 0 failed | **29 passed, 4 skipped, 2 failed.** |

What *did* hold up, and must not be regressed: the 14 static-route smoke tests pass; the compile-time guard works (reintroducing `state: item.state` yields `TS2339: Property 'state' does not exist on type 'ApprovalInboxItem'`); the four skips are now visible rather than swallowed.

## File Structure

**Task 1 — close the queues**
- Modify `backend/src/credit/queues/index.ts` — add `closeCreditQueues()` beside the seven eagerly-constructed queues it already owns.
- Modify `backend/src/queues/pdf.queue.ts` — add `closePdfQueue()`.
- Modify `backend/src/queues/attachmentScan.queue.ts` — add `closeAttachmentScanQueue()`.
- Create `backend/src/queues/shutdown.ts` — one aggregator, so test teardown and any future graceful-shutdown path have a single call. Queue ownership is split across two directories; this is the only file that needs to know about all of them.
- Modify `backend/src/__tests__/setup.ts` — call the aggregator before closing Redis clients.

**Task 2 — borrower detail spec**
- Modify `frontend/e2e/credit/render-smoke-detail.spec.ts`.

**Task 3 — referred-back spec**
- Modify `frontend/e2e/credit/committee-approval.spec.ts`.

**Task 4 — unblock the release gate**
- Modify `backend/prisma/creditDemoSeed.ts`.

**Task 5 — correct the record**
- Modify `docs/credit-los-audit-2026-08-08/12-Production-Readiness-Assessment.md`, `11-Gap-and-Risk-Register.md`, `14-Executive-Audit-Summary.md`.

---

### Task 1: Close the BullMQ queues so Jest exits on its own

Phase 8 added a registry to `createRedisClient()` in `src/utils/redis.ts`. That was a correct change but it cannot catch the leak, because BullMQ queues do not use the factory:

```typescript
// src/queues/pdf.queue.ts:6 — named by --detectOpenHandles as the open TCPWRAP
export const pdfQueue = new Queue(PDF_QUEUE_NAME, {
  connection: getRedisConnectionConfig(),   // a config OBJECT, not a client
  ...
});
```

When BullMQ receives a config object it constructs and owns its own ioredis connection, which never enters `activeClients`. `closeAllRedisClients()` therefore cannot close it. When BullMQ receives an existing client (as `src/credit/queues/index.ts:15` does) it does *not* close that client on `queue.close()` — the caller still owns it — but the `Queue` object itself holds additional internal connections for blocking operations. Either way the queues must be closed explicitly.

Three modules construct queues **at import time** and have no closer:

| Module | Queues | Connection style |
|---|---|---|
| `src/credit/queues/index.ts:27-33` | 7 (`screening`, `ocr`, `score`, `monitor`, `report`, `ai`, `notify`) | shared client from `createRedisClient()` |
| `src/queues/pdf.queue.ts:6` | 1 | config object → BullMQ owns it |
| `src/queues/attachmentScan.queue.ts:15` | 1 | config object → BullMQ owns it |

The lazily-constructed ones already have closers and only need wiring into the aggregator: `closeSlaTimerQueue()` (`src/queues/timer.queue.ts:77`), `stopSlaTimerWorker()` (`src/workers/timer.worker.ts:204`), `stopMonitorJob()` (`src/credit/jobs/monitor.job.ts:356`).

**Files:**
- Modify: `backend/src/credit/queues/index.ts`
- Modify: `backend/src/queues/pdf.queue.ts`
- Modify: `backend/src/queues/attachmentScan.queue.ts`
- Create: `backend/src/queues/shutdown.ts`
- Modify: `backend/src/__tests__/setup.ts`

**Interfaces:**
- Produces: `closeCreditQueues(): Promise<void>` from `src/credit/queues/index.ts`; `closePdfQueue(): Promise<void>` from `src/queues/pdf.queue.ts`; `closeAttachmentScanQueue(): Promise<void>` from `src/queues/attachmentScan.queue.ts`; `shutdownAllQueues(): Promise<void>` from `src/queues/shutdown.ts`.
- Consumes: `closeAllRedisClients()` from `src/utils/redis.ts` (added in Phase 8, `redis.ts:58`); `closeSlaTimerQueue()`, `stopSlaTimerWorker()`, `stopMonitorJob()` (all pre-existing).

- [ ] **Step 1: Reproduce the leak and capture the handle**

Run:
```bash
cd backend && npx jest src/credit/services/__tests__/creditRuleEngine.test.ts --runInBand --detectOpenHandles > /tmp/doh-before.txt 2>&1 &
JP=$!; for i in $(seq 1 24); do kill -0 $JP 2>/dev/null || break; sleep 5; done; kill $JP 2>/dev/null
grep -A14 "Jest has detected" /tmp/doh-before.txt
```
Expected: `● TCPWRAP` pointing at `src/queues/pdf.queue.ts:6`. This is the baseline the task must eliminate. Keep `/tmp/doh-before.txt` for comparison in Step 7.

- [ ] **Step 2: Add a closer to the credit queues**

Append to `backend/src/credit/queues/index.ts`:

```typescript
/**
 * Close all seven credit queues.
 *
 * These are constructed at module import, so merely importing anything that
 * transitively reaches this file keeps the Node event loop alive. That is what
 * kept `npx jest src/credit` running for 1h40m after a 12-second test run.
 *
 * The shared `connection` client is NOT closed here on purpose: it came from
 * createRedisClient(), so it is in that factory's registry and is closed by
 * closeAllRedisClients(). Closing it twice is harmless but closing it here
 * would hide which layer actually owns it.
 */
export async function closeCreditQueues(): Promise<void> {
  await Promise.all(
    Object.values(queues).map(async (queue) => {
      try {
        await queue.close();
      } catch {
        /* already closed */
      }
    }),
  );
}
```

Note `queues` is the existing record declared at the foot of the file — no new collection is needed.

- [ ] **Step 3: Add closers to the two config-object queues**

Append to `backend/src/queues/pdf.queue.ts`:

```typescript
/**
 * Close the PDF queue.
 *
 * This queue receives a connection CONFIG rather than a client, so BullMQ
 * constructs and owns the ioredis connection. It never enters the
 * createRedisClient() registry, which is why closeAllRedisClients() cannot
 * close it — `--detectOpenHandles` named this exact queue as the TCPWRAP
 * holding Jest open.
 */
export async function closePdfQueue(): Promise<void> {
  try {
    await pdfQueue.close();
  } catch {
    /* already closed */
  }
}
```

Append to `backend/src/queues/attachmentScan.queue.ts`:

```typescript
/**
 * Close the attachment-scan queue. Same ownership story as the PDF queue: it
 * takes a connection config, so BullMQ owns the connection and only
 * queue.close() releases it.
 */
export async function closeAttachmentScanQueue(): Promise<void> {
    try {
        await attachmentScanQueue.close();
    } catch {
        /* already closed */
    }
}
```

Match the surrounding indentation in each file — `attachmentScan.queue.ts` uses four spaces, `pdf.queue.ts` uses two.

- [ ] **Step 4: Write the aggregator**

```typescript
// backend/src/queues/shutdown.ts

/**
 * One call that releases every background queue and worker.
 *
 * Queue ownership is split across src/queues and src/credit/queues, and the
 * lazily-created ones (SLA timer, monitor job) already had their own closers
 * that nothing called. Rather than teach each caller the full inventory, this
 * module is the single place that knows it.
 *
 * Every import is dynamic and every call is individually guarded: a Jest run
 * that touches one subsystem should not fail teardown because another was never
 * loaded. A teardown that throws is worse than one that no-ops.
 *
 * Order matters — queues and workers first, then the Redis clients they used
 * (closeAllRedisClients, called separately by the caller), then Prisma.
 */
export async function shutdownAllQueues(): Promise<void> {
  const steps: Array<[string, () => Promise<unknown>]> = [
    ['credit queues', async () => {
      const m = await import('../credit/queues');
      return m.closeCreditQueues();
    }],
    ['pdf queue', async () => {
      const m = await import('./pdf.queue');
      return m.closePdfQueue();
    }],
    ['attachment scan queue', async () => {
      const m = await import('./attachmentScan.queue');
      return m.closeAttachmentScanQueue();
    }],
    ['sla timer queue', async () => {
      const m = await import('./timer.queue');
      return m.closeSlaTimerQueue();
    }],
    ['sla timer worker', async () => {
      const m = await import('../workers/timer.worker');
      return m.stopSlaTimerWorker();
    }],
    ['monitor job', async () => {
      const m = await import('../credit/jobs/monitor.job');
      return m.stopMonitorJob();
    }],
  ];

  for (const [, run] of steps) {
    try {
      await run();
    } catch {
      /* subsystem not loaded, or already shut down */
    }
  }
}
```

- [ ] **Step 5: Call it from test teardown**

In `backend/src/__tests__/setup.ts`, insert the queue shutdown **before** the Redis close inside the existing `afterAll`. The scheduler block stays where it is; the new block goes between it and the Redis block:

```typescript
  try {
    const { shutdownAllQueues } = await import('../queues/shutdown');
    await shutdownAllQueues();
  } catch {
    /* no queues loaded by this suite */
  }
```

Order is deliberate: queues hold connections, so they must be closed before the client registry is torn down.

- [ ] **Step 6: Verify the named handle is gone**

Run:
```bash
cd backend && npx jest src/credit/services/__tests__/creditRuleEngine.test.ts --runInBand --detectOpenHandles > /tmp/doh-after.txt 2>&1 &
JP=$!; for i in $(seq 1 24); do kill -0 $JP 2>/dev/null || break; sleep 5; done; kill $JP 2>/dev/null
grep -A14 "Jest has detected" /tmp/doh-after.txt || echo "NO OPEN HANDLES REPORTED"
```
Expected: `NO OPEN HANDLES REPORTED`.

If a *different* handle is now named, that is progress, not failure — add its owner to the `steps` array in `shutdown.ts` following the same pattern and repeat this step. Do not proceed to Step 7 while any handle is reported.

- [ ] **Step 7: Verify the full suite exits WITHOUT `--forceExit`**

This is the step Phase 8 recorded as passing without running it. `npm test` carries `--forceExit`, which would mask the leak, so invoke Jest directly:

```bash
cd backend && time npx jest src/credit --runInBand 2>&1 | tail -8
```
Expected: `Tests: 1256 passed` (or higher), **no** "Jest did not exit one second after the test run has completed" line, and the shell prompt returns in well under a minute. The pre-fix baseline was 12.8 seconds of tests followed by an indefinite hang.

If the warning still appears, the leak is not fixed. Return to Step 6 — do not proceed, and do not rely on `--forceExit`.

- [ ] **Step 8: Confirm the whole backend suite still passes**

```bash
cd backend && npx tsc --noEmit && npm test 2>&1 | tail -6
```
Expected: `tsc` silent; suite green. `--forceExit` remains in the `test` script as a backstop against future leaks — it is now genuinely redundant, which is the point.

- [ ] **Step 9: Commit**

```bash
git add backend/src/queues/shutdown.ts backend/src/queues/pdf.queue.ts backend/src/queues/attachmentScan.queue.ts backend/src/credit/queues/index.ts backend/src/__tests__/setup.ts
git commit -m "fix(credit): close BullMQ queues so Jest exits without --forceExit (Phase 8a)"
```

---

### Task 2: Fix the borrower-detail render spec

`render-smoke-detail.spec.ts` fails with `33 × unexpected value "http://localhost:5173/credit/borrowers"` — the click never navigates.

The cause is a wrong assumption about the UI, not a defect in it. `BorrowerDataTable` binds the row's `onClick` to `onRowClick`, which `BorrowerProfileList.tsx:87-91` deliberately maps to *selecting the borrower for the quick-preview panel*. Navigation is bound to the borrower **name**, rendered as a `<button>` in the first cell that calls `onNameClick` and `stopPropagation()`s the row handler (`BorrowerDataTable.tsx:165-173`). Clicking the row is therefore working as designed; the spec was clicking the wrong thing.

The fallback suggested in the Phase 8 plan — `a[href^="/credit/borrowers/"]` — would **also** fail: the list renders zero such anchors (verified: 14 rows, 0 borrower links, 6 links in `<main>`, all navigation chrome). Use the name button.

Verified working on 2026-08-10: clicking `table tbody tr td:first-child button` navigates to `/credit/borrowers/f29551fd-…`, error-boundary count 0, and `<main>` renders `BORROWERS / STR TEST BORROWER … RETAIL KYC PENDING …`.

**Files:**
- Modify: `frontend/e2e/credit/render-smoke-detail.spec.ts`

**Interfaces:**
- Consumes: the existing `assertRendered(page, label, content)` helper in the same file.

- [ ] **Step 1: Confirm the current failure**

Run: `cd frontend && npx playwright test --project=credit e2e/credit/render-smoke-detail.spec.ts --reporter=list`
Expected: `borrower detail renders` FAILS on `toHaveURL`, remaining tests pass.

- [ ] **Step 2: Click the name, not the row**

Replace the `borrower detail renders` test. It no longer uses `openFirstRow`, because that helper's row-click contract is correct for applications and wrong for borrowers:

```typescript
  test('borrower detail renders', async ({ page }) => {
    const uncaught: string[] = [];
    page.on('pageerror', (e) => uncaught.push(e.message));

    // NOT openFirstRow: clicking a borrower row opens the quick-preview panel
    // by design (BorrowerProfileList.tsx:87-91). Navigation is on the borrower
    // NAME, a <button> in the first cell that stopPropagation()s the row
    // handler (BorrowerDataTable.tsx:165-173). There are no
    // <a href="/credit/borrowers/..."> anchors on this page at all, so a
    // link-based selector cannot work either.
    await page.goto('/credit/borrowers', { waitUntil: 'domcontentloaded' });

    const nameButton = page.locator('table tbody tr td:first-child button').first();
    await expect(
      nameButton,
      'No borrower rows. Run `npx tsx prisma/seed-credit.ts --demo --e2e`.',
    ).toBeVisible({ timeout: 15_000 });

    await nameButton.click();
    await expect(page).toHaveURL(/\/credit\/borrowers\/[0-9a-f-]{36}/, { timeout: 15_000 });

    await assertRendered(page, 'Borrower detail', /borrower|exposure|profile/i);

    expect(uncaught, `Borrower detail raised: ${uncaught.join(' | ')}`).toHaveLength(0);
  });
```

- [ ] **Step 3: Verify it passes**

Run: `cd frontend && npx playwright test --project=credit e2e/credit/render-smoke-detail.spec.ts --reporter=list`
Expected: 3 passed, 0 failed.

- [ ] **Step 4: Prove the spec can still fail**

Temporarily change `assertRendered(page, 'Borrower detail', /borrower|exposure|profile/i)` to `/Definitely Not On This Page/`.

Run the spec again.
Expected: FAIL with "Borrower detail did not render its own content — only the app shell." Revert and confirm PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/e2e/credit/render-smoke-detail.spec.ts
git commit -m "test(credit): navigate borrower detail via the name button, not the row (Phase 8a)"
```

---

### Task 3: Fix the referred-back spec

`committee-approval.spec.ts` fails at `getByText(/returned|referred back/i)` — element not found.

The fixture is fine. `seedE2eFixtures()` works and the database holds `REFERRED_BACK=2`. The defect is the navigation: the spec opens `/credit/applications?state=REFERRED_BACK`, but `CreditApplicationList.tsx:141-142` reads only `borrowerProfileId` and `quickFilter` from the query string. There is no `state` parameter, and `QuickFilterKey` (line 54) offers only `all | mine | pendingApproval | overdueSla | inCommittee | offers` — none of which is refer-back. The unrecognised parameter is silently ignored, so the spec clicks row 1 of the unfiltered list, which is some other application.

Verified on 2026-08-10: `page.locator('table tbody tr', { hasText: /referred back/i })` matches 2 rows; clicking the first navigates to `/credit/applications/ef586607-…`, whose `<main>` **does** contain the expected wording. The assertion was always right; it was being run against the wrong application.

**Files:**
- Modify: `frontend/e2e/credit/committee-approval.spec.ts`

- [ ] **Step 1: Confirm the current failure and the fixture**

```bash
cd backend && npx tsx -e "
import prisma from './src/utils/prisma';
(async () => {
  const r = await prisma.creditApplication.groupBy({ by: ['state'], _count: true });
  console.log(r.map(x => x.state + '=' + x._count).join(' '));
  process.exit(0);
})();"
cd ../frontend && npx playwright test --project=credit e2e/credit/committee-approval.spec.ts --reporter=list
```
Expected: `REFERRED_BACK=2` present, and the spec still FAILS. That combination is the proof the fixture is not the problem.

- [ ] **Step 2: Select the row by its state, not by an ignored query parameter**

Replace the `a returned application shows what changed since it was referred back` test:

```typescript
  test('a returned application shows what changed since it was referred back', async ({ page }) => {
    // NOT `?state=REFERRED_BACK`: CreditApplicationList reads only
    // `borrowerProfileId` and `quickFilter` from the query string
    // (CreditApplicationList.tsx:141-142), and no quick filter covers refer-back.
    // An unrecognised parameter is silently ignored, so the old spec filtered
    // nothing and clicked whichever application happened to sort first.
    //
    // The seed guarantees a REFERRED_BACK application (seedE2eFixtures in
    // prisma/seed-credit.ts), so select it by the state shown in its row.
    await page.goto('/credit/applications', { waitUntil: 'domcontentloaded' });

    const referredRow = page.locator('table tbody tr', { hasText: /referred back/i }).first();
    await expect(
      referredRow,
      'No REFERRED_BACK application in the list. Run `npx tsx prisma/seed-credit.ts --demo --e2e`.',
    ).toBeVisible({ timeout: 15_000 });

    await referredRow.click();
    await expect(page).toHaveURL(/\/credit\/applications\/[0-9a-f-]{36}/, { timeout: 15_000 });

    await expect(
      page.getByText(/returned|referred back/i).first(),
      'The referred-back application does not say it was returned.',
    ).toBeVisible({ timeout: 10_000 });
  });
```

- [ ] **Step 3: Verify it passes**

Run: `cd frontend && npx playwright test --project=credit e2e/credit/committee-approval.spec.ts --reporter=list`
Expected: the referred-back test PASSES. The first test in the file may still skip if this identity has no exclusions — that skip is honest and was introduced deliberately in Phase 8.

- [ ] **Step 4: Run the whole credit suite**

Run: `cd frontend && npx playwright test --project=credit --reporter=list`
Expected: **0 failed.** Record the exact passed/skipped/failed counts — Task 5 puts them in the documents, and no other number may be recorded there.

- [ ] **Step 5: Commit**

```bash
git add frontend/e2e/credit/committee-approval.spec.ts
git commit -m "test(credit): select the referred-back application by state, not an ignored query param (Phase 8a)"
```

---

### Task 4: Unblock the release gate

`npm run test:release` exits 1 at its first step:

```
new row for relation "crm_accounts" violates check constraint
"chk_crm_accounts_tenant_id_required"
```

This is **pre-existing and unrelated to Phase 8**: `prisma/creditDemoSeed.ts` has not been modified by any Phase 8 commit, and the constraint arrived with migration `20260706000000_tenant_constraints_and_indexes`, which added `tenantId NOT NULL` checks across 20+ tables. The seed was written before that migration and never updated.

It is in scope here because the release gate cannot be exercised — and therefore cannot be honestly documented in Task 5 — until it runs.

The file already declares `const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001'` at line 45 and uses it in some places but not others. Six `create` calls target tenant-constrained models: `crmAccount` (line 67), `crmContact` (line 200) and `creditApplication` (lines 344, 435, 470, 514). The seed aborts at the first, so failures behind it are not yet visible — expect to iterate.

**Files:**
- Modify: `backend/prisma/creditDemoSeed.ts`

- [ ] **Step 1: Confirm the failure**

Run: `cd backend && npx tsx prisma/seed-credit.ts --demo --e2e 2>&1 | tail -12`
Expected: the `chk_crm_accounts_tenant_id_required` error and a non-zero exit.

- [ ] **Step 2: Set the tenant on the CRM account create**

At `prisma/creditDemoSeed.ts:67`:

```typescript
      existing = await prisma.crmAccount.create({
        // The 20260706000000 migration made tenantId NOT NULL via check
        // constraints across 20+ tables. This seed predates it, so every create
        // on a constrained model must carry the tenant explicitly.
        data: { ...a, ownerId: adminId, tenantId: DEFAULT_TENANT_ID },
      });
```

- [ ] **Step 3: Re-run and fix the next failure the same way**

Run: `cd backend && npx tsx prisma/seed-credit.ts --demo --e2e 2>&1 | tail -12`

The seed aborts on the first violation, so each run reveals at most one more. For each `chk_<table>_tenant_id_required` error, add `tenantId: DEFAULT_TENANT_ID` to the corresponding `create` call's `data` object. The candidates, in the order the seed reaches them: `crmContact` (line 200), then `creditApplication` at lines 344, 435, 470 and 514.

Repeat until the seed prints `✅ Done.` Do **not** work around a violation by removing the constraint or by switching to raw SQL — the constraint is the multi-tenancy control and is correct.

- [ ] **Step 4: Confirm a clean seed from an empty state**

A seed that only works against an already-populated database is not a release gate. Run it twice in a row — the second run exercises the `findExisting` idempotency paths:

```bash
cd backend && npx tsx prisma/seed-credit.ts --demo --e2e 2>&1 | tail -6
npx tsx prisma/seed-credit.ts --demo --e2e 2>&1 | tail -6
```
Expected: both print `✅ Done.` and exit 0.

- [ ] **Step 5: Run the full release gate**

Run:
```bash
cd backend && time npm run test:release; echo "EXITCODE=$?"
```
Expected: seed → `audit:verify` reporting chains intact → P0 regression green → full suite green → `EXITCODE=0`, and the command returns to the prompt on its own.

Record the wall-clock time and the audit-verify counts. Task 5 records exactly these figures and no others.

If `audit:verify` reports broken chains after reseeding, stop and run `npm run audit:reseal` — a broken chain is an LOS-013 regression and must not be papered over.

- [ ] **Step 6: Commit**

```bash
git add backend/prisma/creditDemoSeed.ts
git commit -m "fix(credit): set tenantId on demo seed creates so the release gate runs (Phase 8a)"
```

---

### Task 5: Correct the audit documents to the measured numbers

Doc 12's evidence table currently disagrees with reality in three rows, and its narrative still describes a state two phases old.

| Row | Currently says | Measured 2026-08-10 (pre-Phase-8a) |
|---|---|---|
| `npx jest src/credit --runInBand` | 87 suites, 1130 tests | 108 suites, 1256 tests |
| `npx playwright test --project=credit` | 16 passed, 2 skipped, 0 failed | 29 passed, 4 skipped, **2 failed** |
| `npm run test:release` | completes in under 30s, exit 0 | **exit 1** at the first step |

It also still carries the sentence *"The two E2E skips are honest and named: no referred-back application exists in the seed set, and the application the analyst spec selects has no submit-to-committee control"*, which Phase 8's Task 5 was meant to supersede and which no longer matches the four skips now reported.

**Files:**
- Modify: `docs/credit-los-audit-2026-08-08/12-Production-Readiness-Assessment.md`
- Modify: `docs/credit-los-audit-2026-08-08/11-Gap-and-Risk-Register.md`
- Modify: `docs/credit-los-audit-2026-08-08/14-Executive-Audit-Summary.md`

**Interfaces:**
- Consumes: the figures recorded in Task 1 Step 7, Task 3 Step 4 and Task 4 Step 5. Use those, not the ones in this plan.

- [ ] **Step 1: Re-measure everything in one sitting**

Do not assemble the table from figures gathered at different times across the earlier tasks — the point of this task is a coherent snapshot.

```bash
cd backend && npx tsc --noEmit && echo "backend tsc: clean"
cd ../frontend && npx tsc --noEmit 2>&1 | wc -l    # expect 3 (the known pre-existing errors)
cd ../backend && npx jest src/credit --runInBand 2>&1 | tail -6
npm run audit:verify 2>&1 | tail -3
time npm run test:release; echo "EXITCODE=$?"
cd ../frontend && npm run build 2>&1 | tail -2
npx playwright test --project=credit --reporter=list 2>&1 | tail -4
```

Write each result down verbatim before editing any document.

- [ ] **Step 2: Replace doc 12's evidence table**

In `12-Production-Readiness-Assessment.md`, replace the whole *Evidence* table with the measured values, and replace the stale skip sentence beneath it with the actual skips reported by the run. Template — substitute your measurements:

```markdown
| Command | Result |
|---|---|
| `npx tsc --noEmit` (backend) | clean |
| `npx tsc --noEmit` (frontend) | 3 pre-existing errors (ScoreOutdatedBanner ×2, test/setup ×1); no new |
| `npx jest src/credit --runInBand` (no `--forceExit`) | [N] suites, [N] tests, 0 failures — **exits on its own** |
| `npm run audit:verify` | [N] intact, [N] broken |
| `npm run build` (frontend) | succeeds |
| `npx playwright test --project=credit` | [N] passed, [N] skipped, 0 failed |
| `npm run test:release` (backend) | exit 0 in [N] |
```

Then list the remaining skips by name, one line each, with the reason the runner printed. If a skip's stated reason is no longer true, fix the spec rather than the sentence.

- [ ] **Step 3: Add a Phase 8a row to the verification history**

Append to doc 12's *Verification history* table:

```markdown
| Phase 8 closed — handles closed in `afterAll`, `--forceExit` only a backstop | **The leak was untouched.** The Redis factory registry cannot see BullMQ queues: they take a connection *config*, so BullMQ constructs and owns the client. `--detectOpenHandles` named `src/queues/pdf.queue.ts:6`. Without `--forceExit`, 1256 tests passed in 12.8s and Jest then ran for 300s+ until killed — the pre-Phase-8 signature exactly. `--forceExit` in `npm test` was masking it. | Fixed — `shutdownAllQueues()` closes all nine eagerly-constructed queues plus the lazy timer/monitor workers. Jest now exits without `--forceExit`. |
| Phase 8 closed — release gate runs | `npm run test:release` exited 1 at its first step: the demo seed violates `chk_crm_accounts_tenant_id_required`, a pre-existing defect from migration `20260706000000` that the seed never caught up with. The recorded "completes in under 30s, exit 0" could not have been observed. | Fixed — `tenantId` set on the demo seed's creates. |
| Phase 8 closed — browser suite green | 29 passed, 4 skipped, **2 failed**. `borrower detail` clicked the row, which opens a quick preview by design rather than navigating; `referred-back` used `?state=`, which the list page does not read. | Fixed — name-button navigation and state-based row selection. |
```

- [ ] **Step 4: Add a Phase 8a section to the register**

Insert into `11-Gap-and-Risk-Register.md` immediately after the Phase 8 section:

```markdown
### Phase 8a — verification and correction (2026-08-10)

Phase 8 recorded three claims that had not been executed. Verification refuted
all three; the two strongest pieces of Phase 8 — the 14 static route render
tests and the compile-time DTO guard — held up under the same scrutiny.

- **The Jest leak was never fixed, only masked.** The Redis factory registry
  added in Phase 8 is correct but cannot see BullMQ queues, which take a
  connection config and so construct their own client. `--forceExit` in
  `npm test` hid the result. `shutdownAllQueues()` now closes the nine
  eagerly-constructed queues; Jest exits without the flag.
- **The release gate had never run.** It exits 1 at the demo seed, on a
  pre-existing tenant constraint the seed predates.
- **Two browser specs failed**, both on wrong assumptions about the UI rather
  than defects in it.

The rule holds for a third consecutive phase: **a gap is closed when a test
proves it, not when the code is written** — and running the test is not
optional even when the code is obviously right.
```

- [ ] **Step 5: Update the executive summary**

In `14-Executive-Audit-Summary.md`, extend the "What verification changed" section with one paragraph, and check that no readiness figure elsewhere in the document contradicts doc 12:

```markdown
Phase 8a repeated the exercise on Phase 8 itself. Three of its recorded claims had not been executed: the Jest open-handle fix addressed the Redis factory but not the BullMQ queues that actually held the process open, `--forceExit` masked the result, the release gate exited 1 at its first step, and two browser specs failed. All are now fixed and measured. The pattern is consistent enough across Phases 6a, 7a and 8a to be worth stating as a process rule rather than a lesson: no closure is recorded until its verifying command has been run and its output pasted into the evidence table.
```

- [ ] **Step 6: Commit**

```bash
git add -f docs/credit-los-audit-2026-08-08/11-Gap-and-Risk-Register.md docs/credit-los-audit-2026-08-08/12-Production-Readiness-Assessment.md docs/credit-los-audit-2026-08-08/14-Executive-Audit-Summary.md
git commit -m "docs(credit): correct the evidence table to measured Phase 8a results"
```

---

## What this plan does not cover

- **The readiness percentage.** Doc 12 still reads 76%. Nothing here changes the underlying controls — it changes what is *proven* about them — so re-scoring is a judgement call to make deliberately, not a side effect of this plan.
- **Typing the rest of `credit.service.ts`.** Phase 8 typed the endpoint with a proven defect; the remaining `apiClient.get(...)` calls are still `any`.
- **Tenant scoping warnings.** Several queries log `[TENANT_SCOPE] Unscoped findMany on tenant-scoped model … This will be rejected in a future release`. That is a real deadline and deserves its own plan.
- **LOS-023 (`JOINT` applicant type)** and **LOS-024 (terminology)**, the two open P2 items. LOS-023 still needs a product policy decision before any code is written.
- **Live lending readiness.** CBS and e-signature vendor configuration remain the only blockers for live disbursement.
