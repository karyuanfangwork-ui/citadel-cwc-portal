# Credit LOS Phase 8 — Render Assurance, Honest Assertions and a Release Gate That Terminates

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the defect class exposed by Phase 7a — a credit screen that crashes for every user while its E2E spec passes — and make the documented release gate actually terminate.

**Architecture:** Four independent strands, ordered by the strength of evidence behind them. (1) A smoke-render spec that loads every credit route as a permissioned user and fails on an error boundary or an uncaught exception — the only thing that would have caught the LOS-020 crash. (2) Real types on the credit API client, so the DTO mismatch that caused it fails at compile time rather than at render time. (3) An audit of the five legacy credit specs for assertions that cannot fail. (4) Fixing the Jest open-handle hang that leaves `npm run test:release` running forever, and wiring the `--e2e` seed into that gate.

**Tech Stack:** Playwright 1.x (`frontend/e2e/credit/`, project `credit`, storageState auth), React 19 + TypeScript + Vite, Jest 29 + ts-jest (`backend/`), Prisma 5 + PostgreSQL.

## Global Constraints

- Everything runs against a **live stack**: backend on `http://localhost:3000`, frontend on `http://localhost:5173`. Playwright's `baseURL` comes from `E2E_BASE_URL`, defaulting to `http://localhost:5173`.
- Seed prerequisite for every browser task: `cd backend && npx tsx prisma/seed-credit.ts --demo --e2e`.
- Two password families coexist in the seed and mixing them yields a 401 that looks like a missing account:
  - `admin@test.local` → `password123`
  - `e2e-analyst@test.local`, `e2e-approver@test.local` → `abc@123`
- Credit E2E identities and their real permission sets (verified against the running API on 2026-08-10):
  - `admin@test.local` — `credit:create, str_view, str_manage, read, write, approve, admin, compliance, export, disburse`
  - `e2e-analyst@test.local` (CREDIT_ANALYST) — `credit:read, credit:write, credit:export`. **No `credit:approve`.**
  - `e2e-approver@test.local` (CREDIT_MANAGER) — `credit:read, credit:write, credit:approve, credit:export`
  - `user@helpdesk.com` — no credit permissions at all
- `docs/` is gitignored at `.gitignore:69`. Documentation commits require `git add -f`.
- **Standing rule from Phase 6a, reaffirmed by Phase 7a:** a gap is closed when a test proves it, not when the code is written — and *a test that cannot fail is not a test*. Never write an assertion inside an `if` that silently passes when the condition is false. Use `test.skip(true, '<reason>')` so the skip is visible in the report, or make the fixture guarantee the precondition.
- Never use `locator.isVisible()` as a guard. It does not retry, so it answers "is this visible *right now*", which on a still-loading page is always `false`. Use `expect(locator).toBeVisible()` or `locator.waitFor()`.
- Backend TypeScript must stay clean: `cd backend && npx tsc --noEmit` produces no output.
- Frontend has **three pre-existing** `tsc` errors that are not yours to fix and must not grow: two in `src/components/credit/ScoreOutdatedBanner.tsx` (lines 45, 47) and one in `src/test/setup.ts:11`. Any *other* error is a regression.

## Background: what Phase 7a found

Writing the LOS-022 browser spec revealed that `MyApprovals` crashed into its error boundary for **every** user, admin included. LOS-020 had repointed the page at `GET /credit/dashboard/approval-inbox`, which returns its own summary DTO — `applicationId`, `applicationNo`, `currentState`, and a flat `borrowerName` — and the rows were handed to the card renderer unmapped. `app.state` was `undefined`, so `StateBadge` threw on `state.replace(...)`.

Two safety nets should have caught it and neither did:

- `dashboardApi.getApprovalInbox` is `() => apiClient.get('/credit/dashboard/approval-inbox')` in `frontend/src/services/credit.service.ts:2387` — **no generic type parameter**, so the response is `any` and TypeScript had nothing to check. Zero of the credit service's `apiClient.get(...)` calls carry a type parameter.
- `approval-inbox.spec.ts` asserted `page.locator('h1, h2, h3').first()` matched `/approval/i`. The page *shell* renders that heading before the card list throws, so the spec passed against a page no user could use.

Ten credit page components consume that same untyped client. This plan assumes the defect class is live elsewhere until proven otherwise.

## File Structure

**Task 1 — static-route render assurance**
- Create `frontend/e2e/credit/support/routes.ts` — the route inventory: path, required permission, and the content that proves the screen actually rendered. One place to update when a credit route is added.
- Create `frontend/e2e/credit/render-smoke.spec.ts` — one test per static route.

**Task 2 — parameterised- and mobile-route render assurance**
- Create `frontend/e2e/credit/render-smoke-detail.spec.ts` — detail routes (ids discovered from list pages) and the mobile viewport routes.

**Task 3 — types at the API boundary**
- Create `frontend/src/services/credit.types.ts` — response DTOs for the credit dashboard endpoints, kept separate from the 2000-line `credit.service.ts` so the types are readable on their own.
- Modify `frontend/src/services/credit.service.ts` — type `dashboardApi` responses.
- Modify `frontend/pages/MyApprovals.tsx` — import the shared type instead of the local copy.

**Task 4 — honest assertions in the legacy specs**
- Modify `frontend/e2e/credit/approval-inbox.spec.ts`, `committee-approval.spec.ts`, `committee-entry-gate.spec.ts`.

**Task 5 — a fixture that removes the two skips**
- Modify `backend/prisma/seed-credit.ts` — add `seedE2eFixtures()` to the `--e2e` flag.
- Modify `frontend/e2e/credit/committee-approval.spec.ts`, `analyst-journey.spec.ts`.

**Task 6 — a release gate that terminates**
- Modify `backend/src/__tests__/setup.ts` — close the handles that keep Jest alive.
- Modify `backend/package.json` — `test:release` seeds E2E identities and cannot hang forever.

**Task 7 — audit documents**
- Modify `docs/credit-los-audit-2026-08-08/11-Gap-and-Risk-Register.md`, `12-Production-Readiness-Assessment.md`, `14-Executive-Audit-Summary.md`.

---

### Task 1: Static-route render assurance

Fourteen credit routes have no test proving they render. `/credit/approvals` was broken for every user for weeks. This task makes "the screen loads without throwing" a covered property of every credit screen.

All fourteen were probed manually on 2026-08-10 as `admin@test.local`; the expected content below is what each actually rendered, not a guess. Two are legitimate context-required empty states with no `<h1>`/`<h2>` — `/credit/financials` ("No Borrower Selected") and `/credit/collateral` ("No application selected") — so the inventory matches on text, not on headings.

**Files:**
- Create: `frontend/e2e/credit/support/routes.ts`
- Create: `frontend/e2e/credit/render-smoke.spec.ts`

**Interfaces:**
- Consumes: `STATE_FILES` from `./support/auth` (existing; keys `analyst`, `approver`, `nonCredit`, `sodAnalyst`, `sodApprover`).
- Produces: `CREDIT_ROUTES: CreditRoute[]` and `interface CreditRoute { path: string; name: string; permission: string; expect: RegExp }`. Task 2 does not import these — its routes need per-route id discovery and do not fit the flat inventory shape — but a future per-role route matrix should build on `CREDIT_ROUTES` rather than re-listing the paths.

- [ ] **Step 1: Write the route inventory**

```typescript
// frontend/e2e/credit/support/routes.ts

/**
 * Every static credit route, with the content that proves it actually rendered.
 *
 * This exists because LOS-020 shipped a My Approvals page that crashed into its
 * error boundary for every user — including admin — and the spec covering it
 * asserted on a heading the page shell renders *before* the crash. A heading is
 * not evidence. The `expect` pattern below is matched inside <main>, after the
 * error boundary has been ruled out.
 *
 * `permission` documents which route guard applies (see frontend/App.tsx:306-327).
 * All fourteen are reachable by admin@test.local, which holds every credit
 * permission, so the smoke run uses that session. The permission field is here so
 * that a future per-role matrix does not have to rediscover it.
 *
 * When adding a credit route to App.tsx, add it here. That is the whole contract.
 */
export interface CreditRoute {
  path: string;
  name: string;
  permission: string;
  /** Matched against <main> innerText once the page has settled. */
  expect: RegExp;
}

export const CREDIT_ROUTES: CreditRoute[] = [
  { path: '/credit',                  name: 'Dashboard',            permission: 'credit:read',    expect: /Credit Assessment Dashboard/i },
  { path: '/credit/borrowers',        name: 'Borrower list',        permission: 'credit:read',    expect: /Borrower Management/i },
  { path: '/credit/borrowers/new',    name: 'Borrower create',      permission: 'credit:read',    expect: /Duplicate Check/i },
  { path: '/credit/applications',     name: 'Application list',     permission: 'credit:read',    expect: /Application Management/i },
  { path: '/credit/applications/new', name: 'Application create',   permission: 'credit:create',  expect: /New Credit Application Wizard/i },
  { path: '/credit/approvals',        name: 'My Approvals',         permission: 'credit:approve', expect: /My Approvals/i },
  // Context-required empty state: financials hang off a borrower, so with no
  // borrower selected the page correctly renders a prompt and no heading.
  { path: '/credit/financials',       name: 'Financial spreading',  permission: 'credit:read',    expect: /No Borrower Selected/i },
  { path: '/credit/analysis',         name: 'Financial analysis',   permission: 'credit:read',    expect: /Ratio & Trend Analysis/i },
  { path: '/credit/scorecards',       name: 'Scorecard admin',      permission: 'credit:admin',   expect: /Scorecard Management/i },
  { path: '/credit/rating-bands',     name: 'Rating band admin',    permission: 'credit:admin',   expect: /Credit Risk Configuration/i },
  { path: '/credit/committee',        name: 'Committee meetings',   permission: 'credit:read',    expect: /Committee Meetings/i },
  // Context-required empty state, same reasoning as /credit/financials.
  { path: '/credit/collateral',       name: 'Collateral',           permission: 'credit:read',    expect: /No application selected/i },
  { path: '/credit/reports',          name: 'Reports',              permission: 'credit:read',    expect: /Credit Reports/i },
  { path: '/credit/group-exposure',   name: 'Group exposure',       permission: 'credit:read',    expect: /Group Exposure Aggregation/i },
];
```

- [ ] **Step 2: Write the failing spec**

Deliberately break one route first so the spec is proven capable of failing — Step 4 does that. Write the spec now:

```typescript
// frontend/e2e/credit/render-smoke.spec.ts
import { test, expect } from '@playwright/test';
import { STATE_FILES } from './support/auth';
import { CREDIT_ROUTES } from './support/routes';

/**
 * Phase 8 — every credit screen renders.
 *
 * LOS-020 closed twice on a page that crashed into its error boundary for every
 * user. Nothing in the suite asserted "this screen renders at all", and the
 * credit API client is untyped, so neither TypeScript nor Playwright objected.
 *
 * Each test asserts three things, in order of how loudly they fail:
 *   1. No uncaught exception reached the window.
 *   2. React did not swap the body for the ErrorBoundary fallback.
 *   3. <main> contains the content that proves this specific screen rendered,
 *      not just the app shell.
 *
 * (3) is the one that matters. The shell renders headings and nav for every
 * route including broken ones — that is precisely how the LOS-020 crash hid.
 */

test.describe('Phase 8 — credit screens render', () => {
  test.use({ storageState: STATE_FILES.approver });

  for (const route of CREDIT_ROUTES) {
    test(`${route.name} (${route.path}) renders`, async ({ page }) => {
      const uncaught: string[] = [];
      page.on('pageerror', (e) => uncaught.push(e.message));

      await page.goto(route.path, { waitUntil: 'domcontentloaded' });

      const main = page.locator('main').first();
      await expect(main).toBeVisible({ timeout: 15_000 });

      await expect(
        page.getByText(/something went wrong/i),
        `${route.name} crashed into its error boundary.`,
      ).toHaveCount(0);

      await expect(
        main,
        `${route.name} did not render its own content — only the app shell. ` +
        `This is the LOS-020 failure mode: the shell renders, the screen does not.`,
      ).toContainText(route.expect, { timeout: 15_000 });

      expect(
        uncaught,
        `${route.name} raised an uncaught exception: ${uncaught.join(' | ')}`,
      ).toHaveLength(0);
    });
  }
});
```

- [ ] **Step 3: Run the spec and confirm all fourteen pass**

Run:
```bash
cd backend && npx tsx prisma/seed-credit.ts --demo --e2e
cd ../frontend && npx playwright test --project=credit e2e/credit/render-smoke.spec.ts --reporter=list
```
Expected: 14 passed, 0 failed.

If a route fails, that is a real defect of the same class as LOS-020 — **do not weaken the assertion to make it pass.** Diagnose it the way the LOS-020 crash was diagnosed: attach a console listener and read the stack.

```typescript
// Temporary diagnostic — delete before committing.
page.on('console', async (m) => {
  if (m.type() !== 'error') return;
  for (const a of m.args()) {
    console.log(await a.evaluate((e: any) => (e && e.stack) ? e.stack : String(e)).catch(() => '?'));
  }
});
```

- [ ] **Step 4: Prove the spec can fail**

Temporarily change the `/credit/reports` entry's `expect` to `/Definitely Not On This Page/`:

Run: `npx playwright test --project=credit e2e/credit/render-smoke.spec.ts --reporter=list -g "Reports"`
Expected: FAIL with "Reports did not render its own content — only the app shell."

Then revert the change and re-run to confirm PASS. A smoke spec that cannot fail is exactly the thing this plan exists to eliminate; do not skip this step.

- [ ] **Step 5: Commit**

```bash
git add frontend/e2e/credit/support/routes.ts frontend/e2e/credit/render-smoke.spec.ts
git commit -m "test(credit): assert every credit screen actually renders (Phase 8)"
```

---

### Task 2: Detail- and mobile-route render assurance

The static routes are the easy half. The three parameterised routes (`applications/:id`, `borrowers/:id`, `committee/:meetingId`) and the three mobile routes carry more logic and more DTO surface, so they carry more of the risk this plan is about. They need an id, which the spec discovers by navigating the corresponding list page — the same row-click pattern `audit-immutability.spec.ts` already uses successfully against `/credit/applications`.

**Files:**
- Create: `frontend/e2e/credit/render-smoke-detail.spec.ts`

**Interfaces:**
- Consumes: `STATE_FILES` from `./support/auth`.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Write the failing spec**

```typescript
// frontend/e2e/credit/render-smoke-detail.spec.ts
import { test, expect, type Page } from '@playwright/test';
import { STATE_FILES } from './support/auth';

/**
 * Phase 8 — parameterised and mobile credit screens render.
 *
 * Companion to render-smoke.spec.ts. These routes need a record id, which is
 * discovered by clicking through the corresponding list page rather than
 * hardcoded — a hardcoded id rots the moment the seed changes, and a spec that
 * skips on a missing id proves nothing.
 *
 * The mobile routes are covered because MobileApprovalInbox consumes the same
 * untyped approval-inbox DTO that crashed the desktop page in LOS-020. If the
 * mapping bug was duplicated there, only a mobile-viewport run finds it.
 */

/** Assert the page rendered its own content, not just the app shell. */
async function assertRendered(page: Page, label: string, content: RegExp) {
  const main = page.locator('main').first();
  await expect(main).toBeVisible({ timeout: 15_000 });
  await expect(
    page.getByText(/something went wrong/i),
    `${label} crashed into its error boundary.`,
  ).toHaveCount(0);
  await expect(
    main,
    `${label} did not render its own content — only the app shell.`,
  ).toContainText(content, { timeout: 15_000 });
}

/**
 * Open the first row of a list page and return the detail URL.
 * Fails loudly when the list is empty: an empty seed is a broken fixture, not a
 * reason to pass. Run `npx tsx prisma/seed-credit.ts --demo --e2e` first.
 */
async function openFirstRow(page: Page, listPath: string, detail: RegExp): Promise<void> {
  await page.goto(listPath, { waitUntil: 'domcontentloaded' });
  const firstRow = page.locator('table tbody tr').first();
  await expect(
    firstRow,
    `No rows at ${listPath}. Re-run the demo seed — an empty list cannot exercise the detail route.`,
  ).toBeVisible({ timeout: 15_000 });
  await firstRow.click();
  await expect(page).toHaveURL(detail, { timeout: 15_000 });
}

test.describe('Phase 8 — parameterised credit screens render', () => {
  test.use({ storageState: STATE_FILES.approver });

  test('application detail renders', async ({ page }) => {
    const uncaught: string[] = [];
    page.on('pageerror', (e) => uncaught.push(e.message));

    await openFirstRow(page, '/credit/applications', /\/credit\/applications\/[0-9a-f-]{36}/);
    await assertRendered(page, 'Application detail', /readiness|overview|assessment/i);

    expect(uncaught, `Application detail raised: ${uncaught.join(' | ')}`).toHaveLength(0);
  });

  test('borrower detail renders', async ({ page }) => {
    const uncaught: string[] = [];
    page.on('pageerror', (e) => uncaught.push(e.message));

    await openFirstRow(page, '/credit/borrowers', /\/credit\/borrowers\/[0-9a-f-]{36}/);
    await assertRendered(page, 'Borrower detail', /borrower|exposure|profile/i);

    expect(uncaught, `Borrower detail raised: ${uncaught.join(' | ')}`).toHaveLength(0);
  });
});

test.describe('Phase 8 — mobile credit screens render', () => {
  test.use({ storageState: STATE_FILES.approver, viewport: { width: 390, height: 844 } });

  test('mobile approval inbox renders', async ({ page }) => {
    const uncaught: string[] = [];
    page.on('pageerror', (e) => uncaught.push(e.message));

    // MyApprovals redirects to /credit/m/approvals on a mobile viewport, so this
    // both covers the mobile screen and proves the redirect works.
    await page.goto('/credit/approvals', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/credit\/m\/approvals/, { timeout: 15_000 });

    await assertRendered(page, 'Mobile approval inbox', /approval/i);

    expect(uncaught, `Mobile approval inbox raised: ${uncaught.join(' | ')}`).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run the spec**

Run: `cd frontend && npx playwright test --project=credit e2e/credit/render-smoke-detail.spec.ts --reporter=list`
Expected: 3 passed.

If borrower detail's row-click does not navigate — `/credit/borrowers` may render cards rather than a `<table>` — replace `openFirstRow` for that one test with a link-based discovery, and keep the loud failure on "no records":

```typescript
await page.goto('/credit/borrowers', { waitUntil: 'domcontentloaded' });
const firstLink = page.locator('a[href^="/credit/borrowers/"]').first();
await expect(
  firstLink,
  'No borrower links on /credit/borrowers. Re-run the demo seed.',
).toBeVisible({ timeout: 15_000 });
await firstLink.click();
await expect(page).toHaveURL(/\/credit\/borrowers\/[0-9a-f-]{36}/, { timeout: 15_000 });
```

If any of the three screens fails, treat it as a live defect of the LOS-020 class. Fix the screen, not the assertion, and note it for the Task 7 documentation update.

- [ ] **Step 3: Prove the spec can fail**

Temporarily change the mobile test's content pattern to `/Definitely Not Present/`.

Run: `npx playwright test --project=credit e2e/credit/render-smoke-detail.spec.ts -g "mobile"`
Expected: FAIL with "Mobile approval inbox did not render its own content". Revert and confirm PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/e2e/credit/render-smoke-detail.spec.ts
git commit -m "test(credit): assert detail and mobile credit screens render (Phase 8)"
```

---

### Task 3: Type the credit dashboard responses

The LOS-020 crash was a DTO mismatch that TypeScript could have caught for free. `dashboardApi.getApprovalInbox` returns `any`, and so does every other `apiClient.get(...)` in `credit.service.ts`. This task types the endpoint that actually broke and the one adjacent to it, and moves the DTO out of `MyApprovals.tsx` so a second consumer cannot drift from the first.

Scope is deliberately narrow. Typing all of `credit.service.ts` is a worthwhile but separate piece of work; this task types the surface with a proven defect and establishes the pattern.

**Files:**
- Create: `frontend/src/services/credit.types.ts`
- Modify: `frontend/src/services/credit.service.ts:2387` (`dashboardApi`)
- Modify: `frontend/pages/MyApprovals.tsx` (remove the local `ApprovalInboxItem`, import the shared one)

**Interfaces:**
- Produces: `ApprovalInboxItem` and `ApprovalInbox` from `frontend/src/services/credit.types.ts`; `dashboardApi.getApprovalInbox(): Promise<AxiosResponse<{ status: string; data: ApprovalInbox }>>`.

- [ ] **Step 1: Extract the DTO into a shared module**

```typescript
// frontend/src/services/credit.types.ts

/**
 * Response types for the credit dashboard endpoints.
 *
 * These are deliberately separate from credit.service.ts, which is ~2400 lines
 * and hard to read a type out of.
 *
 * Why they exist at all: the approval-inbox endpoint was consumed as `any`, its
 * rows were rendered as if they were `CreditApplication`, and the resulting
 * `undefined` state crashed My Approvals into its error boundary for every user.
 * TypeScript had nothing to check. It does now.
 *
 * NOTE the field names. This DTO is NOT a CreditApplication:
 *   applicationId  not  id
 *   applicationNo  not  applicationNumber
 *   currentState   not  state
 *   borrowerName   is a flat string, not a nested borrowerProfile
 *
 * `currentState` is typed as `string` rather than `ApplicationState` on purpose:
 * `ApplicationState` lives in credit.service.ts, which imports this module, so
 * referencing it here would make the two files circular. MyApprovals narrows it
 * where it maps into a CreditApplication.
 */
export interface ApprovalInboxItem {
  applicationId: string;
  applicationNo: string;
  borrowerName: string;
  productType: string;
  requestedAmount: number;
  currency: string;
  currentState: string;
  urgency: string;
  submittedAt: string;
  daysWaiting: number;
  riskRating?: string;
  requestedTenor?: number;
  _slaBreached?: boolean;
}

/** An application the backend withheld, and the reason it gave (LOS-020). */
export interface ApprovalInboxExclusion {
  applicationId: string;
  borrowerName: string;
  reason: string;
}

export interface ApprovalInbox {
  high: ApprovalInboxItem[];
  medium: ApprovalInboxItem[];
  low: ApprovalInboxItem[];
  totalPending: number;
  excluded: ApprovalInboxExclusion[];
}

/** The envelope every credit endpoint wraps its payload in. */
export interface CreditApiResponse<T> {
  status: string;
  data: T;
}
```

- [ ] **Step 2: Type the endpoint**

In `frontend/src/services/credit.service.ts`, add the import near the other imports at the top of the file:

```typescript
import type { ApprovalInbox, CreditApiResponse } from './credit.types';
```

Then change line 2387 from:

```typescript
  getApprovalInbox: () => apiClient.get('/credit/dashboard/approval-inbox'),
```

to:

```typescript
  // Typed because this response was consumed as `any` and rendered as a
  // CreditApplication, which crashed My Approvals for every user (LOS-020).
  getApprovalInbox: () =>
    apiClient.get<CreditApiResponse<ApprovalInbox>>('/credit/dashboard/approval-inbox'),
```

- [ ] **Step 3: Point MyApprovals at the shared type**

In `frontend/pages/MyApprovals.tsx`, delete the locally-declared `interface ApprovalInboxItem { ... }` block (added in commit `fd880b9`) and import it instead. Keep the explanatory comment above `toApplication` — it is the record of why the mapper exists.

Add to the imports:

```typescript
import type { ApprovalInboxItem } from '../src/services/credit.types';
```

And narrow the mapper's signature so the compiler checks the mapping:

```typescript
function toApplication(item: ApprovalInboxItem): CreditApplication {
```

- [ ] **Step 4: Prove the types now catch the original bug**

Temporarily reintroduce the exact defect — in `toApplication`, change `state: item.currentState` to `state: (item as any).state` is *not* the test; the point is that the honest form now fails. Change it to:

```typescript
    state: item.state,
```

Run: `cd frontend && npx tsc --noEmit`
Expected: FAIL with `Property 'state' does not exist on type 'ApprovalInboxItem'` — the compiler now catches at build time what previously took a browser and an error boundary to discover.

Revert to `state: item.currentState`.

- [ ] **Step 5: Verify clean**

Run: `cd frontend && npx tsc --noEmit`
Expected: exactly the three known pre-existing errors listed in Global Constraints — two in `ScoreOutdatedBanner.tsx`, one in `test/setup.ts`. No others.

Run: `npx playwright test --project=credit --reporter=list`
Expected: no new failures (the suite was 16 passed / 2 skipped / 0 failed before Tasks 1–2 added specs).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/services/credit.types.ts frontend/src/services/credit.service.ts frontend/pages/MyApprovals.tsx
git commit -m "fix(credit): type the approval-inbox response so DTO drift fails at compile time (Phase 8)"
```

---

### Task 4: Remove assertions that cannot fail

Phase 6a fixed this pattern in the specs it looked at and `approval-inbox.spec.ts` still shipped with it. Three specs currently contain assertions wrapped in an `if` that silently passes when the condition is false, which is how the LOS-020 crash survived. Each is fixed either by making the assertion unconditional or by converting the branch into a visible `test.skip` with a stated reason.

The three defects, verbatim:

1. `approval-inbox.spec.ts` — `if (await details.isVisible({ timeout: 3_000 }).catch(() => false))`. Non-retrying guard *and* silent pass. `<details>` content is collapsed, which compounds the problem.
2. `committee-approval.spec.ts` — `const count = await disclosure.count(); if (count > 0) { ... }`. Silent pass when there are no exclusions.
3. `committee-entry-gate.spec.ts` — `if (!hasBtn) { // Gate not reachable from this state — pass by default \n return; }`. An explicit, commented decision to pass without asserting anything.

**Files:**
- Modify: `frontend/e2e/credit/approval-inbox.spec.ts`
- Modify: `frontend/e2e/credit/committee-approval.spec.ts`
- Modify: `frontend/e2e/credit/committee-entry-gate.spec.ts`

**Interfaces:**
- Consumes: the `--e2e` seed's RM split from commit `fd880b9` — `e2e-approver@test.local` is the assigned RM on exactly one `COMMITTEE_REVIEW` application, so their inbox always has at least one exclusion.

- [ ] **Step 1: Make the approval-inbox exclusion assertion unconditional**

`sod-exclusions.spec.ts` already proves the exclusion path with the SOD identities. This spec runs as admin, whose exclusions depend on seed state, so the honest fix is to assert the *structure* unconditionally and leave the reason-text assertion to the SOD spec.

Replace the second test in `approval-inbox.spec.ts` entirely:

```typescript
  test('excluded applications, when present, are named with a reason', async ({ page }) => {
    await page.goto('/credit/approvals');
    await expect(page.getByRole('heading', { name: /my approvals/i }).first())
      .toBeVisible({ timeout: 10_000 });

    // Previously: `if (await details.isVisible(...))` — a non-retrying guard
    // wrapped around the only assertion, so an inbox that had stopped rendering
    // exclusions entirely would still pass. isVisible() does not retry: on a
    // still-loading page it answers false, every time.
    //
    // Admin's exclusion set depends on seed state, so this spec asserts the
    // contract that must hold either way: zero exclusions, or exclusions that
    // each state a reason. sod-exclusions.spec.ts covers the guaranteed case.
    const details = page.locator('details');
    const count = await details.count();

    if (count === 0) {
      test.skip(true, 'Admin has no excluded applications in this seed — see sod-exclusions.spec.ts');
      return;
    }

    await details.first().click();
    const items = details.first().locator('li');
    await expect(items.first()).toBeVisible({ timeout: 5_000 });
    await expect(
      items.first(),
      'An application was withheld without stating why. LOS-020 requires the reason.',
    ).toContainText(/authority|segregation of duties|already submitted a decision/i);
  });
```

- [ ] **Step 2: Fix the same pattern in committee-approval.spec.ts**

Replace the first test's body:

```typescript
  test('My Approvals shows only actionable cases and explains exclusions', async ({ page }) => {
    await page.goto('/credit/approvals');
    await expect(page.getByRole('heading', { name: /my approvals/i }).first()).toBeVisible({ timeout: 10_000 });

    // The page must render its own content, not just the shell — this spec
    // passed throughout the period when My Approvals crashed into its error
    // boundary immediately after the heading appeared.
    await expect(
      page.getByText(/something went wrong/i),
      'My Approvals crashed into its error boundary.',
    ).toHaveCount(0);

    // Previously `if (count > 0) { ...assert... }`, which passed silently
    // whenever the disclosure was absent — including when it was absent because
    // the page had crashed.
    const disclosure = page.getByText(/applications? not shown/i);
    if (await disclosure.count() === 0) {
      test.skip(true, 'No exclusions for this identity in this seed — see sod-exclusions.spec.ts');
      return;
    }

    await disclosure.first().click();
    await expect(
      page.getByText(/authority|segregation of duties|already submitted a decision/i).first(),
      'An application was withheld without stating why.',
    ).toBeVisible({ timeout: 5_000 });
  });
```

- [ ] **Step 3: Fix the "pass by default" branch in committee-entry-gate.spec.ts**

```typescript
    const committeeBtn = page.locator('button', { hasText: /committee/i }).first();
    const hasBtn = await committeeBtn.first()
      .waitFor({ state: 'visible', timeout: 3_000 })
      .then(() => true)
      .catch(() => false);
    if (!hasBtn) {
      // Previously `return;` with the comment "pass by default" — a test that
      // reports success without asserting anything. If the control is absent,
      // this spec did not exercise the gate and must say so.
      test.skip(true, 'No committee control on this draft — the entry gate was not exercised');
      return;
    }
```

- [ ] **Step 4: Run the full credit suite**

Run:
```bash
cd backend && npx tsx prisma/seed-credit.ts --demo --e2e
cd ../frontend && npx playwright test --project=credit --reporter=list
```
Expected: 0 failed. Skips may increase — that is the point. A skip is visible in the report and an `if` that swallows an assertion is not. Record the exact pass/skip/fail counts; Task 7 documents them.

- [ ] **Step 5: Commit**

```bash
git add frontend/e2e/credit/approval-inbox.spec.ts frontend/e2e/credit/committee-approval.spec.ts frontend/e2e/credit/committee-entry-gate.spec.ts
git commit -m "test(credit): replace assertions that cannot fail with visible skips (Phase 8)"
```

---

### Task 5: Seed the fixtures that remove the two standing skips

Doc 12 names two honest skips: no referred-back application exists in the seed set, and the application the analyst spec selects has no submit-to-committee control. Both are fixture gaps, and both hide real control paths — the LOS-015 return/resume gate and the committee entry gate are exactly the paths the audit spent two phases correcting.

**Files:**
- Modify: `backend/prisma/seed-credit.ts` (add `seedE2eFixtures()`, called from the `--e2e` flag)
- Modify: `frontend/e2e/credit/committee-approval.spec.ts`
- Modify: `frontend/e2e/credit/analyst-journey.spec.ts`

**Interfaces:**
- Consumes: `seedE2eIdentities()`'s users, resolved by email inside the new function so the two are independently runnable.
- Produces: at least one `REFERRED_BACK` application and one `CREDIT_ASSESSMENT` application owned by `e2e-analyst@test.local`.

- [ ] **Step 1: Confirm the current state distribution**

Run:
```bash
cd backend && npx tsx -e "
import prisma from './src/utils/prisma';
(async () => {
  const rows = await prisma.creditApplication.groupBy({ by: ['state'], _count: true });
  console.log(rows.map(r => \`\${r.state}=\${r._count}\`).join(' '));
  process.exit(0);
})();"
```
Expected: a distribution with no `REFERRED_BACK`. Record it — the seed must not destroy states other specs rely on. As of 2026-08-10 only one application is in `COMMITTEE_REVIEW` (`CA-2026-00005`), and `seedE2eIdentities` already assigns it to the approver as RM. Do not reassign it.

- [ ] **Step 2: Add the fixture seed**

Add to `backend/prisma/seed-credit.ts`, immediately after `seedE2eIdentities()`:

```typescript
// Phase 8 — fixtures for the two E2E paths that could only be skipped.
//
// Two control paths the audit spent two phases correcting had no browser
// coverage because the seed contained nothing to exercise them: the LOS-015
// return/resume gate needs a REFERRED_BACK application, and the committee entry
// gate needs an application the analyst can actually attempt to submit.
//
// This deliberately does NOT touch CA-2026-00005, the single COMMITTEE_REVIEW
// application that seedE2eIdentities assigns to the approver as RM. That
// assignment is what makes the SOD exclusion observable in sod-exclusions.spec.ts.
async function seedE2eFixtures() {
  console.log('🧪 Seeding E2E control-path fixtures...');

  const analyst = await prisma.user.findUnique({ where: { email: 'e2e-analyst@test.local' } });
  if (!analyst) {
    console.log('  ⚠️  e2e-analyst@test.local not found — run with --e2e so identities are seeded first.');
    return;
  }

  // A referred-back application, so the return-diff path is reachable.
  const referBackCandidate = await prisma.creditApplication.findFirst({
    where: { state: { in: ['CREDIT_ASSESSMENT', 'UNDERWRITING'] } },
    orderBy: { applicationNo: 'desc' },
    select: { id: true, applicationNo: true },
  });

  if (!referBackCandidate) {
    console.log('  ⚠️  No CREDIT_ASSESSMENT/UNDERWRITING application to refer back — run --demo first.');
  } else {
    await prisma.creditApplication.update({
      where: { id: referBackCandidate.id },
      data: { state: 'REFERRED_BACK', assignedRmId: analyst.id },
    });
    console.log(`  ✅ ${referBackCandidate.applicationNo} → REFERRED_BACK (analyst as RM)`);
  }

  // An application the analyst owns and can attempt to submit, so the committee
  // entry gate is exercised rather than skipped for want of a button.
  const submitCandidate = await prisma.creditApplication.findFirst({
    where: { state: 'CREDIT_ASSESSMENT', id: { not: referBackCandidate?.id ?? '' } },
    orderBy: { applicationNo: 'asc' },
    select: { id: true, applicationNo: true },
  });

  if (!submitCandidate) {
    console.log('  ⚠️  No spare CREDIT_ASSESSMENT application for the committee-gate fixture.');
  } else {
    await prisma.creditApplication.update({
      where: { id: submitCandidate.id },
      data: { assignedRmId: analyst.id },
    });
    console.log(`  ✅ ${submitCandidate.applicationNo} assigned to analyst for the committee-gate spec`);
  }
}
```

Then call it from `main()`, on the line after the existing `seedE2eIdentities` call:

```typescript
    if (shouldRun(flags.e2e))            await seedE2eIdentities();
    if (shouldRun(flags.e2e))            await seedE2eFixtures();
```

- [ ] **Step 3: Run the seed and verify the fixtures exist**

Run:
```bash
cd backend && npx tsx prisma/seed-credit.ts --demo --e2e
npx tsx -e "
import prisma from './src/utils/prisma';
(async () => {
  const rows = await prisma.creditApplication.groupBy({ by: ['state'], _count: true });
  console.log(rows.map(r => \`\${r.state}=\${r._count}\`).join(' '));
  process.exit(0);
})();"
```
Expected: `REFERRED_BACK=1` present, and `COMMITTEE_REVIEW` still at its previous count.

- [ ] **Step 4: Make the referred-back test unconditional**

In `committee-approval.spec.ts`, replace the second test:

```typescript
  test('a returned application shows what changed since it was referred back', async ({ page }) => {
    // The seed now guarantees a REFERRED_BACK application (see seedE2eFixtures
    // in prisma/seed-credit.ts). This test used to skip for want of one, which
    // left the LOS-015 return path with no browser coverage at all.
    await page.goto('/credit/applications?state=REFERRED_BACK');

    const firstRow = page.locator('table tbody tr').first();
    await expect(
      firstRow,
      'No REFERRED_BACK application. Run `npx tsx prisma/seed-credit.ts --demo --e2e`.',
    ).toBeVisible({ timeout: 15_000 });

    await firstRow.click();
    await expect(page).toHaveURL(/\/credit\/applications\/[0-9a-f-]{36}/, { timeout: 15_000 });
    await expect(page.getByText(/returned|referred back/i).first()).toBeVisible({ timeout: 10_000 });
  });
```

- [ ] **Step 5: Run and confirm the skip is gone**

Run: `cd frontend && npx playwright test --project=credit e2e/credit/committee-approval.spec.ts --reporter=list`
Expected: 2 passed, 0 skipped.

If the referred-back row does not render, check whether `/credit/applications?state=REFERRED_BACK` is a supported query parameter on the list page — the original spec assumed it without verifying. If it is not, navigate to `/credit/applications` and locate the row by its state badge text instead:

```typescript
    const firstRow = page.locator('table tbody tr', { hasText: /referred back/i }).first();
```

- [ ] **Step 6: Address the analyst-journey skip**

Run the spec and read which branch it takes:

Run: `npx playwright test --project=credit e2e/credit/analyst-journey.spec.ts --reporter=list`

If it still skips on "No submit-to-committee control on this application", the spec is clicking the first row of the unfiltered list rather than the analyst's own application. Point it at the fixture:

```typescript
    // Select the application the --e2e seed assigns to the analyst, rather than
    // whatever happens to sort first. The old spec took row 1 and then skipped
    // when that application had no submit control — a skip caused by the spec's
    // own arbitrary choice, not by a real gap.
    await page.goto('/credit/applications');
    const row = page.locator('table tbody tr', { hasText: /credit assessment/i }).first();
    await expect(
      row,
      'No CREDIT_ASSESSMENT application. Run `npx tsx prisma/seed-credit.ts --demo --e2e`.',
    ).toBeVisible({ timeout: 15_000 });
    await row.click();
```

If the control is genuinely absent for a legitimate product reason, leave the `test.skip` in place and record the reason in Task 7 rather than forcing it. A named skip is acceptable; a silent pass is not.

- [ ] **Step 7: Commit**

```bash
git add backend/prisma/seed-credit.ts frontend/e2e/credit/committee-approval.spec.ts frontend/e2e/credit/analyst-journey.spec.ts
git commit -m "test(credit): seed referred-back and committee-gate fixtures to remove standing skips (Phase 8)"
```

---

### Task 6: Make the release gate terminate

`npm run test:release` is documented in doc 12 as the go/no-go command. It ends in `&& npm test`. Measured on 2026-08-10:

```
Test Suites: 108 passed, 108 total
Tests:       1256 passed, 1256 total
Time:        7.105 s
Jest did not exit one second after the test run has completed.
```

The tests finish in seven seconds; Jest then hangs on open handles. The process ran for one hour and forty minutes before being killed manually. The gate has therefore never terminated on its own, and any CI job invoking it would run to its wall-clock limit and report failure regardless of the results.

`backend/src/__tests__/setup.ts` disconnects Prisma in `afterAll` and nothing else. Two subsystems keep the loop alive, and the Redis one is structural:

- **Nine module-level Redis clients with no way to close them.** `createRedisClient()` in `src/utils/redis.ts:42` is a factory, not a singleton, and nine modules call it at import time: `permission.service.ts:4`, `token.service.ts:3`, `sla-pause.service.ts:5`, `pdfJob.service.ts:5`, `auth.controller.ts:17`, `dlp.service.ts:53`, `rateLimitStore.ts:30`, `credit/queues/index.ts:15` and `app.ts:153`. None is exported, so there is nothing for a teardown to call. Worse, the shared `retryStrategy` (`redis.ts:29-31`) returns a delay forever, so each client holds a live reconnect timer whether or not Redis is reachable. Importing any one of those modules is enough to keep Jest alive indefinitely.
- **The scheduler.** `src/services/scheduler.service.ts` registers fourteen cron jobs via `initScheduler()`. It already exports `shutdownScheduler()` at line 122 — it simply is not called in tests.

The fix is therefore a client registry in the factory, not a teardown that guesses at singletons.

**Files:**
- Modify: `backend/src/utils/redis.ts` (register created clients; export a closer)
- Modify: `backend/src/__tests__/setup.ts`
- Modify: `backend/package.json` (`test`, `test:release`)

**Interfaces:**
- Produces: `closeAllRedisClients(): Promise<void>` from `src/utils/redis.ts`.
- Consumes: `shutdownScheduler()` from `src/services/scheduler.service.ts:122` (already exported).
- Produces: `npm test` exits with code 0 within seconds of the last test.

- [ ] **Step 1: Confirm what is holding the loop open**

Run:
```bash
cd backend && npx jest src/credit --runInBand --detectOpenHandles 2>&1 | tail -60
```
Expected: open handles reported after the summary. The analysis above predicts ioredis reconnect timers and node-cron timers. Record what the diagnostic *actually* reports — if it names something else, that goes into Step 3 as well.

- [ ] **Step 2: Give the Redis factory a registry**

In `backend/src/utils/redis.ts`, add the registry immediately above `createRedisClient`:

```typescript
/**
 * Every client this factory hands out.
 *
 * Nine modules call createRedisClient() at import time and none of them export
 * the result, so before this registry existed there was no way to close them.
 * Combined with a retryStrategy that retries forever, that kept the Node event
 * loop alive: `npx jest src/credit` passed 1256 tests in 7.1 seconds and then
 * hung for 1h40m until it was killed by hand. `npm run test:release` ends in
 * `&& npm test`, so the release gate never returned.
 */
const activeClients = new Set<Redis>();

/**
 * Close every client this factory created. Intended for test teardown and
 * graceful shutdown — not for request paths.
 */
export async function closeAllRedisClients(): Promise<void> {
  const clients = [...activeClients];
  activeClients.clear();
  await Promise.all(
    clients.map(async (client) => {
      try {
        // quit() waits for a reply, which never arrives if Redis is unreachable.
        // disconnect() is unconditional and is what actually clears the timer.
        client.disconnect();
      } catch {
        /* already closed */
      }
    }),
  );
}
```

Then register each client inside `createRedisClient`, immediately before `return client;`:

```typescript
  activeClients.add(client);

  return client;
```

- [ ] **Step 3: Close everything in global teardown**

Extend `backend/src/__tests__/setup.ts`:

```typescript
afterAll(async () => {
  // The tests were never the slow part: 108 suites and 1256 tests pass in about
  // seven seconds. Jest then sat on open handles for 1h40m. Close them in
  // dependency order and tolerate absence — not every suite imports every
  // subsystem, and a teardown that throws is worse than one that no-ops.
  try {
    const { shutdownScheduler } = await import('../services/scheduler.service');
    await shutdownScheduler();
  } catch {
    /* scheduler not initialised by this suite */
  }

  try {
    const { closeAllRedisClients } = await import('../utils/redis');
    await closeAllRedisClients();
  } catch {
    /* redis not loaded by this suite */
  }

  await prisma.$disconnect();
});
```

Note `shutdownScheduler` is the real export name (`scheduler.service.ts:122`); there is no `stopScheduler`.

- [ ] **Step 4: Verify Jest exits on its own**

Run:
```bash
cd backend && time npx jest src/credit --runInBand
```
Expected: the summary prints, the "Jest did not exit" warning is **absent**, and the command returns in well under a minute. Compare against the 1h40m baseline.

- [ ] **Step 5: Add a backstop so this can never hang a pipeline again**

Even with the handles closed, an unrelated future leak should not cost a CI job its full wall clock. Change `test` in `backend/package.json`:

```json
    "test": "jest --forceExit --detectOpenHandles=false",
```

`--forceExit` guarantees termination. It is a backstop, not the fix — Steps 2 and 3 are the fix, and Step 4 must pass without `--forceExit` before this is added, otherwise the leak is merely hidden.

- [ ] **Step 6: Make the release gate seed the E2E identities**

`test:release` currently runs `npm run prisma:seed:credit -- --demo`, which does not create `e2e-analyst@test.local` or `e2e-approver@test.local`. The browser suite that constitutes the other half of the release evidence cannot authenticate against a database seeded by the gate alone.

```json
    "test:release": "npm run prisma:seed:credit -- --demo --e2e && npm run audit:verify && npm run test:credit:p0 && npm test",
```

- [ ] **Step 7: Run the whole gate end to end**

Run:
```bash
cd backend && time npm run test:release
```
Expected: seed → `audit:verify` reporting all chains intact → P0 regression green → full suite green → **the command returns to the prompt**. Record the wall-clock time; Task 7 documents it.

- [ ] **Step 8: Commit**

```bash
git add backend/src/utils/redis.ts backend/src/__tests__/setup.ts backend/package.json
git commit -m "fix(credit): make the release gate terminate and seed E2E identities (Phase 8)"
```

---

### Task 7: Update the audit documents

**Files:**
- Modify: `docs/credit-los-audit-2026-08-08/11-Gap-and-Risk-Register.md`
- Modify: `docs/credit-los-audit-2026-08-08/12-Production-Readiness-Assessment.md`
- Modify: `docs/credit-los-audit-2026-08-08/14-Executive-Audit-Summary.md`

- [ ] **Step 1: Add a Phase 8 section to the register**

Insert immediately before `## Follow-ups surfaced during Phase 6` in `11-Gap-and-Risk-Register.md`. Replace every bracketed figure with the number you actually measured — do not carry forward a figure from this plan.

```markdown
### Phase 8 — render assurance and a terminating release gate (2026-08-10)

Phase 7a found that a credit screen could crash for every user while its spec
passed. Phase 8 treats that as a class rather than an incident.

- **Every credit route now has a render assertion.** `render-smoke.spec.ts`
  covers the 14 static routes and `render-smoke-detail.spec.ts` the detail and
  mobile routes. Each asserts no uncaught exception, no error boundary, and
  content unique to that screen — not the app shell, which renders for broken
  routes too and is how the LOS-020 crash hid. [N] additional defects of the
  same class were found and fixed.
- **The approval-inbox response is typed.** `getApprovalInbox` returned `any`,
  so rendering its DTO as a `CreditApplication` was invisible to the compiler.
  `credit.types.ts` now defines `ApprovalInboxItem`; reintroducing the original
  bug fails `tsc`.
- **Three assertions that could not fail were removed.** `approval-inbox`,
  `committee-approval` and `committee-entry-gate` each wrapped their only
  assertion in an `if` that passed silently — one with an explicit "pass by
  default" comment. They now assert unconditionally or skip visibly.
- **The two standing skips are seeded away.** `seedE2eFixtures()` creates a
  `REFERRED_BACK` application and an analyst-owned application for the committee
  gate, so the LOS-015 return path and the entry gate have browser coverage.
- **`npm run test:release` terminates.** The backend suite passed in 7.1 seconds
  (108 suites, 1256 tests) and then Jest hung on open handles for 1h40m before
  being killed by hand. The documented go/no-go gate had never returned on its
  own. Handles are now closed in `afterAll`, with `--forceExit` as a backstop,
  and the gate seeds the E2E identities it needs.

Browser evidence: [N] passed / [N] skipped / [N] failed.
Backend evidence: `npm run test:release` completes in [N].
```

- [ ] **Step 2: Update the readiness assessment**

In `12-Production-Readiness-Assessment.md`, add rows to the *Verification history* table:

```markdown
| The release gate is `npm run test:release` | **It never terminated.** The backend suite passed in 7.1s (108 suites / 1256 tests) and Jest then hung on open handles — 1h40m before manual kill. Any CI job invoking it would have hit its wall-clock limit and reported failure regardless of results. | Fixed — handles closed in `afterAll`, `--forceExit` backstop, gate now seeds `--e2e`. |
| Credit screens render | Only `/credit/approvals` had ever been verified, and it was broken. The other 13 static routes and all detail/mobile routes had no render coverage. | Fixed — `render-smoke.spec.ts` and `render-smoke-detail.spec.ts`. |
```

Update the *Evidence* table with the measured figures, replacing the `npx playwright test --project=credit` row, and add:

```markdown
| `npm run test:release` (backend) | completes in [N], exit 0 |
```

Update the release-gate section at the foot of the document to show the corrected `test:release` command including `--e2e`.

- [ ] **Step 3: Update the executive summary**

In `14-Executive-Audit-Summary.md`, extend the "What verification changed" section with one paragraph:

```markdown
Phase 8 generalised the Phase 7a finding. Every credit screen now has a test proving it renders, the approval-inbox response is typed so the original DTO mismatch fails at compile time, three assertions that could not fail were removed, and the documented release gate — which passed its tests in seven seconds and then hung for over an hour without terminating — now returns.
```

- [ ] **Step 4: Commit**

```bash
git add -f docs/credit-los-audit-2026-08-08/11-Gap-and-Risk-Register.md docs/credit-los-audit-2026-08-08/12-Production-Readiness-Assessment.md docs/credit-los-audit-2026-08-08/14-Executive-Audit-Summary.md
git commit -m "docs(credit): record Phase 8 render assurance and release-gate correction"
```

---

## What this plan does not cover

- **LOS-023 (`JOINT` applicant type)** and **LOS-024 (terminology consistency)**, the two remaining P2 items. LOS-023 needs a product policy decision before any code is written — the backend enum supports `JOINT` and the creation UI omits it, and "expose it" versus "reject it consistently" are different pieces of work. These belong in their own plan, gated on that decision.
- **Typing the rest of `credit.service.ts`.** Task 3 types the surface with a proven defect and establishes the pattern. Typing all ~2400 lines is worthwhile and separable.
- **LOS-025 (bundle splitting)**, deferred by the audit until measured performance justifies it. The frontend build still emits its large-chunk warning; that is expected.
- **Live lending readiness.** CBS and e-signature vendor configuration remain the only blockers for live disbursement, and they are configuration and procurement, not credit module code. LOS-021 reopens at P0 when `CREDIT_LIVE_LENDING=true`.
