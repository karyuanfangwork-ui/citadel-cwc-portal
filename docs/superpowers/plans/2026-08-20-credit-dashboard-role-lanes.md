# Credit Dashboard Role Lanes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the one-size-fits-all credit dashboard with three role lanes — RM, Approver, Manager — served from a single `/credit` route, and repair the three data defects that make the work queue untriageable.

**Architecture:** `CreditDashboard.tsx` keeps a shared shell (header, branch filter, `AttentionStrip`) and swaps its main column by lane. Lane comes from a `useCreditLane` hook: explicit `localStorage` choice first, then permission inference. The RM lane merges the duplicated `PriorityWorkQueue` and `NextActionsPanel` into one action-first list driven by a new backend `blocker` field. The Approver lane absorbs the `MyApprovals` inbox and decides inline, reusing the decision body extracted from `ApprovalQuickView`. Three scoped changes land in `dashboard.service.ts`: borrower-name fallback, batched SLA countdown, and the `blocker` field.

**Tech Stack:** Backend — Node/Express/TypeScript, Prisma, Jest with mocked Prisma. Frontend — React 19, TypeScript, Vite, Vitest + React Testing Library, React Router v7, Playwright for E2E.

**Spec:** `docs/superpowers/specs/2026-08-20-credit-dashboard-role-lanes-design.md`

## Global Constraints

- No Prisma schema changes. No migrations.
- SLA clock start remains `application.createdAt`, mirroring `creditSla.service.ts:186`. Do not change SLA semantics in this plan.
- No batch approval.
- Borrower display name must resolve identically on backend and frontend. The canonical order is the existing frontend helper `getBorrowerDisplayName` (`frontend/src/components/credit/BorrowerSummaryCard.tsx`): `account.name` -> `contact.firstName + lastName` -> `name` -> fallback. The spec §6.1 lists `name` first; the frontend order wins so the two surfaces cannot render different strings for the same borrower. Backend fallback string is `Borrower {applicationNo}`, not `Unknown`.
- SLA computation must not introduce per-row queries. Policies and branch overrides are loaded once per request.
- Backend tests: `cd backend && npx jest <path>`. Frontend tests: `cd frontend && npx vitest run <path>`.
- Existing exported names that must not be renamed: `dashboardService`, `getOperationalGuidance`, `derivePriority`, `MyWorkItem`, `ApprovalInboxItem`, `getBorrowerDisplayName`.
- Commit after every task. Do not squash tasks into one commit.

## File Structure

**Backend — modify:**
- `backend/src/credit/services/dashboard.service.ts` — add `resolveBorrowerName`, `buildSlaCalculator`, `resolveBlocker`; extend `selectFields`; extend `MyWorkItem`.

**Backend — create (tests):**
- `backend/src/credit/services/__tests__/dashboard.borrowerName.test.ts`
- `backend/src/credit/services/__tests__/dashboard.slaCountdown.test.ts`
- `backend/src/credit/services/__tests__/dashboard.blocker.test.ts`

**Frontend — create:**
- `frontend/src/components/credit/dashboard/useCreditLane.ts` — lane resolution + persistence
- `frontend/src/components/credit/dashboard/LaneSwitcher.tsx`
- `frontend/src/components/credit/dashboard/RmLane.tsx` — "Needs you" + "In flight" + drafts strip
- `frontend/src/components/credit/dashboard/ApproverLane.tsx` — decision inbox
- `frontend/src/components/credit/dashboard/DecisionCard.tsx` — expanded row body, lazy-fetched detail
- `frontend/src/components/credit/dashboard/ManagerLane.tsx` — relocated analytics widgets

**Frontend — modify:**
- `frontend/pages/credit/CreditDashboard.tsx` — shell + lane swap; drop the duplicated `PriorityWorkQueue`/`NextActionsPanel` pair
- `frontend/src/components/credit/ApprovalQuickView.tsx` — extract decision body
- `frontend/src/services/credit.service.ts` — extend `MyWorkItem`

**Frontend — create (tests):** one `__tests__` file per created component, plus `frontend/e2e/credit/dashboard-lanes.spec.ts`.

---

### Task 1: Borrower name fallback

Removes the literal `'Unknown'` from both work-item mappers and loads the fields the fallback needs.

**Files:**
- Modify: `backend/src/credit/services/dashboard.service.ts` (`selectFields` ~line 470; `toMyWorkItem` line 530; `mySlaBreachItems` line 573)
- Test: `backend/src/credit/services/__tests__/dashboard.borrowerName.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `export function resolveBorrowerName(bp: BorrowerProfileNameFields | null | undefined, applicationNo: string): string` and `export interface BorrowerProfileNameFields { name?: string | null; account?: { name?: string | null } | null; contact?: { firstName?: string | null; lastName?: string | null } | null }`. Tasks 2 and 3 rely on `selectFields` having been widened here.

- [ ] **Step 1: Write the failing test**

Create `backend/src/credit/services/__tests__/dashboard.borrowerName.test.ts`:

```typescript
import { resolveBorrowerName } from '../dashboard.service';

describe('resolveBorrowerName', () => {
  it('prefers the linked account name', () => {
    expect(resolveBorrowerName(
      { name: 'Legacy Name', account: { name: 'Lyra Manufacturing Sdn Bhd' }, contact: null },
      'CA-2026-00016',
    )).toBe('Lyra Manufacturing Sdn Bhd');
  });

  it('falls back to the contact full name for individuals', () => {
    expect(resolveBorrowerName(
      { name: null, account: null, contact: { firstName: 'Aisha', lastName: 'Rahman' } },
      'CA-2026-00017',
    )).toBe('Aisha Rahman');
  });

  it('falls back to the authoritative name when no account or contact is linked', () => {
    expect(resolveBorrowerName({ name: 'Sole Trader Co', account: null, contact: null }, 'CA-1'))
      .toBe('Sole Trader Co');
  });

  it('never returns "Unknown" when the profile is missing entirely', () => {
    expect(resolveBorrowerName(null, 'CA-2026-00015')).toBe('Borrower CA-2026-00015');
  });

  it('never returns "Unknown" when every name field is blank', () => {
    expect(resolveBorrowerName(
      { name: '', account: { name: '' }, contact: { firstName: '', lastName: '' } },
      'CA-2026-00014',
    )).toBe('Borrower CA-2026-00014');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest src/credit/services/__tests__/dashboard.borrowerName.test.ts`
Expected: FAIL — `resolveBorrowerName is not a function`.

- [ ] **Step 3: Add the helper**

In `dashboard.service.ts`, near `getOperationalGuidance`:

```typescript
export interface BorrowerProfileNameFields {
  name?: string | null;
  account?: { name?: string | null } | null;
  contact?: { firstName?: string | null; lastName?: string | null } | null;
}

/**
 * Mirrors the frontend `getBorrowerDisplayName` resolution order exactly so the
 * dashboard and the borrower pages can never render different names for the
 * same borrower. `BorrowerProfile.name` is nullable, which is why the old
 * `?? 'Unknown'` fallback appeared on every row of the demo data.
 */
export function resolveBorrowerName(
  bp: BorrowerProfileNameFields | null | undefined,
  applicationNo: string,
): string {
  if (!bp) return `Borrower ${applicationNo}`;
  const contactName = bp.contact
    ? `${bp.contact.firstName || ''} ${bp.contact.lastName || ''}`.trim()
    : '';
  return (bp.account?.name || '').trim()
    || contactName
    || (bp.name || '').trim()
    || `Borrower ${applicationNo}`;
}
```

- [ ] **Step 4: Widen `selectFields` so the fallback has data**

`account` and `contact` are not currently selected. In `selectFields`, replace the `borrowerProfile` block with:

```typescript
      borrowerProfile: {
        select: {
          id: true,
          name: true,
          borrowerType: true,
          creditRiskRating: true,
          industry: true,
          account: { select: { name: true } },
          contact: { select: { firstName: true, lastName: true } },
        },
      },
```

- [ ] **Step 5: Replace both `'Unknown'` fallbacks**

In `toMyWorkItem`, replace `const borrowerName = bp?.name ?? 'Unknown';` with:

```typescript
      const borrowerName = resolveBorrowerName(bp, app.applicationNo ?? '');
```

In the `mySlaBreachItems` mapper, replace `const borrowerName = bp?.name ?? 'Unknown';` with:

```typescript
      const borrowerName = resolveBorrowerName(bp, b.application.applicationNo);
```

Then widen the breach query's include so the same fields are present:

```typescript
        application: { select: { id: true, applicationNo: true, state: true, borrowerProfile: { select: { id: true, name: true, industry: true, account: { select: { name: true } }, contact: { select: { firstName: true, lastName: true } } } } } },
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd backend && npx jest src/credit/services/__tests__/dashboard.borrowerName.test.ts src/credit/services/__tests__/dashboard.myWork.test.ts`
Expected: PASS for both. `dashboard.myWork.test.ts` already mocks `account` and `contact` on its fixtures, so it must stay green.

- [ ] **Step 7: Commit**

```bash
git add backend/src/credit/services/dashboard.service.ts backend/src/credit/services/__tests__/dashboard.borrowerName.test.ts
git commit -m "fix(credit): resolve borrower display name instead of rendering Unknown"
```

---

### Task 2: Batched SLA countdown

Makes `slaRemainingHours` real and `slaStatus === 'WARNING'` reachable, without per-row queries.

**Files:**
- Modify: `backend/src/credit/services/dashboard.service.ts` (`selectFields`; `toMyWorkItem` lines 533-546; `getMyWork` query block)
- Test: `backend/src/credit/services/__tests__/dashboard.slaCountdown.test.ts`

**Interfaces:**
- Consumes: `selectFields` from Task 1.
- Produces: `export interface SlaCalculator { compute(app: { state: string; branchId: string | null; productType: string | null; createdAt: Date }, isBreached: boolean): { slaStatus: 'OK' | 'WARNING' | 'OVERDUE'; slaRemainingHours: number | null } }` and `export function buildSlaCalculator(policies: SlaPolicyRow[], overrides: SlaOverrideRow[], now: Date): SlaCalculator`, with `export interface SlaPolicyRow { id: string; targetState: string; slaHours: number; productType: string | null }` and `export interface SlaOverrideRow { policyId: string; branchId: string; slaHours: number }`. Task 3 consumes the returned `slaStatus`.

- [ ] **Step 1: Write the failing test**

Create `backend/src/credit/services/__tests__/dashboard.slaCountdown.test.ts`:

```typescript
import { buildSlaCalculator } from '../dashboard.service';

const NOW = new Date('2026-08-20T12:00:00Z');
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3600_000);

const policies = [
  { id: 'p-uw', targetState: 'UNDERWRITING', slaHours: 48, productType: null },
  { id: 'p-tl', targetState: 'SUBMITTED', slaHours: 24, productType: 'TERM_LOAN' },
];
const overrides = [{ policyId: 'p-uw', branchId: 'br-kl', slaHours: 12 }];

describe('buildSlaCalculator', () => {
  const calc = buildSlaCalculator(policies, overrides, NOW);

  it('returns remaining hours against the policy for the current state', () => {
    const r = calc.compute(
      { state: 'UNDERWRITING', branchId: null, productType: 'TERM_LOAN', createdAt: hoursAgo(8) },
      false,
    );
    expect(r.slaRemainingHours).toBe(40);
    expect(r.slaStatus).toBe('OK');
  });

  it('honours a branch override in place of the policy hours', () => {
    const r = calc.compute(
      { state: 'UNDERWRITING', branchId: 'br-kl', productType: 'TERM_LOAN', createdAt: hoursAgo(8) },
      false,
    );
    expect(r.slaRemainingHours).toBe(4);
  });

  it('returns WARNING inside the final 25% of the window', () => {
    const r = calc.compute(
      { state: 'UNDERWRITING', branchId: null, productType: 'TERM_LOAN', createdAt: hoursAgo(40) },
      false,
    );
    expect(r.slaStatus).toBe('WARNING');
    expect(r.slaRemainingHours).toBe(8);
  });

  it('ignores a product-specific policy when the product does not match', () => {
    const r = calc.compute(
      { state: 'SUBMITTED', branchId: null, productType: 'OVERDRAFT', createdAt: hoursAgo(100) },
      false,
    );
    expect(r.slaStatus).toBe('OK');
    expect(r.slaRemainingHours).toBeNull();
  });

  it('returns OK with null hours when no policy targets the state', () => {
    const r = calc.compute(
      { state: 'DRAFT', branchId: null, productType: 'TERM_LOAN', createdAt: hoursAgo(500) },
      false,
    );
    expect(r.slaStatus).toBe('OK');
    expect(r.slaRemainingHours).toBeNull();
  });

  it('reports OVERDUE with zero remaining when a breach record exists', () => {
    const r = calc.compute(
      { state: 'UNDERWRITING', branchId: null, productType: 'TERM_LOAN', createdAt: hoursAgo(1) },
      true,
    );
    expect(r.slaStatus).toBe('OVERDUE');
    expect(r.slaRemainingHours).toBe(0);
  });

  it('reports OVERDUE once the window has elapsed even before the breach job runs', () => {
    const r = calc.compute(
      { state: 'UNDERWRITING', branchId: null, productType: 'TERM_LOAN', createdAt: hoursAgo(60) },
      false,
    );
    expect(r.slaStatus).toBe('OVERDUE');
    expect(r.slaRemainingHours).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest src/credit/services/__tests__/dashboard.slaCountdown.test.ts`
Expected: FAIL — `buildSlaCalculator is not a function`.

- [ ] **Step 3: Implement the calculator**

Add to `dashboard.service.ts`:

```typescript
export interface SlaPolicyRow { id: string; targetState: string; slaHours: number; productType: string | null }
export interface SlaOverrideRow { policyId: string; branchId: string; slaHours: number }
export interface SlaComputation { slaStatus: 'OK' | 'WARNING' | 'OVERDUE'; slaRemainingHours: number | null }
export interface SlaCalculator {
  compute(
    app: { state: string; branchId: string | null; productType: string | null; createdAt: Date },
    isBreached: boolean,
  ): SlaComputation;
}

/** Fraction of the window remaining at which a row flips to WARNING. */
const SLA_WARNING_FRACTION = 0.25;

/**
 * Builds an in-memory SLA calculator from policies and branch overrides that
 * the caller has already loaded. This is what keeps the countdown off the
 * per-row query path: two queries per request regardless of row count.
 *
 * The clock starts at `createdAt`, matching creditSla.service.ts
 * checkAndRecordBreaches, so the dashboard and the breach job never disagree.
 */
export function buildSlaCalculator(
  policies: SlaPolicyRow[],
  overrides: SlaOverrideRow[],
  now: Date,
): SlaCalculator {
  const byState = new Map<string, SlaPolicyRow[]>();
  for (const p of policies) {
    const list = byState.get(p.targetState) ?? [];
    list.push(p);
    byState.set(p.targetState, list);
  }
  const overrideKey = (policyId: string, branchId: string) => `${policyId}::${branchId}`;
  const overrideHours = new Map(overrides.map(o => [overrideKey(o.policyId, o.branchId), o.slaHours]));

  return {
    compute(app, isBreached) {
      if (isBreached) return { slaStatus: 'OVERDUE', slaRemainingHours: 0 };

      const candidates = (byState.get(app.state) ?? [])
        .filter(p => p.productType == null || p.productType === app.productType);
      if (candidates.length === 0) return { slaStatus: 'OK', slaRemainingHours: null };

      // Tightest applicable window governs, matching the policy ordering the
      // SLA service uses (orderBy slaHours asc).
      let tightest: number | null = null;
      for (const p of candidates) {
        const hours = (app.branchId ? overrideHours.get(overrideKey(p.id, app.branchId)) : undefined) ?? p.slaHours;
        if (tightest === null || hours < tightest) tightest = hours;
      }
      const windowHours = tightest as number;

      const elapsedHours = (now.getTime() - app.createdAt.getTime()) / 3600_000;
      const remaining = windowHours - elapsedHours;
      if (remaining <= 0) return { slaStatus: 'OVERDUE', slaRemainingHours: 0 };

      const rounded = Math.round(remaining);
      const status = remaining <= windowHours * SLA_WARNING_FRACTION ? 'WARNING' : 'OK';
      return { slaStatus: status, slaRemainingHours: rounded };
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx jest src/credit/services/__tests__/dashboard.slaCountdown.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Wire the calculator into `getMyWork`**

Add `branchId: true` to `selectFields` — the branch override lookup needs it and it is not currently selected.

Immediately after the `myBreaches` query and the `breachedAppIds` set, add:

```typescript
    // Two queries, once per request — never per row. This is the batching the
    // old inline comment said was required to avoid an N+1.
    const [slaPolicies, slaOverrides] = await Promise.all([
      prisma.creditSlaPolicy.findMany({
        where: { isActive: true },
        select: { id: true, targetState: true, slaHours: true, productType: true },
      }),
      prisma.creditSlaPolicyBranchOverride.findMany({
        where: { isActive: true },
        select: { policyId: true, branchId: true, slaHours: true },
      }),
    ]);
    const slaCalculator = buildSlaCalculator(slaPolicies, slaOverrides, new Date());
```

Then in `toMyWorkItem`, delete the `slaStatus` ternary and the whole `slaRemainingHours` block including its stale comment, and replace with:

```typescript
      const { slaStatus, slaRemainingHours } = slaCalculator.compute(
        {
          state: app.state as string,
          branchId: app.branchId ?? null,
          productType: app.productType ?? null,
          createdAt: app.createdAt,
        },
        breachedAppIds.has(app.id),
      );
```

- [ ] **Step 6: Extend the existing myWork test mocks**

`dashboard.myWork.test.ts` mocks only `creditApplication` and `creditSlaBreach`. The two new queries will be undefined. Add to its `jest.mock` factory:

```typescript
    creditSlaPolicy: { findMany: jest.fn() },
    creditSlaPolicyBranchOverride: { findMany: jest.fn() },
```

and in its `beforeEach`:

```typescript
    (prisma.creditSlaPolicy.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.creditSlaPolicyBranchOverride.findMany as jest.Mock).mockResolvedValue([]);
```

Also add `branchId: null, createdAt: new Date(), requestedAmount: null, lane: 'CORPORATE'` to the `makeApp` fixture so the calculator receives the fields it reads.

- [ ] **Step 7: Run the full dashboard suite**

Run: `cd backend && npx jest src/credit/services/__tests__/`
Expected: PASS — all dashboard tests including `dashboard.myWork`, `dashboard.inbox`, `dashboard.turnaround`.

- [ ] **Step 8: Commit**

```bash
git add backend/src/credit/services/dashboard.service.ts backend/src/credit/services/__tests__/
git commit -m "fix(credit): compute real SLA countdown from batched policies"
```

---

### Task 3: The `blocker` field

Replaces the state-restating `currentTask` as the RM's primary signal.

**Files:**
- Modify: `backend/src/credit/services/dashboard.service.ts` (`MyWorkItem` interface line ~40; `toMyWorkItem`)
- Test: `backend/src/credit/services/__tests__/dashboard.blocker.test.ts`

**Interfaces:**
- Consumes: `SlaComputation` from Task 2, `getOperationalGuidance` (existing).
- Produces: `MyWorkItem` gains `blocker: string`. `export function resolveBlocker(input: BlockerInput): string` with `export interface BlockerInput { state: string; slaStatus: 'OK' | 'WARNING' | 'OVERDUE'; daysOverdue: number | null; breachPolicyName: string | null; openConditionCount: number | null; currentTask: string; flags: { expiredBureau: boolean; highDsr: boolean; amlReview: boolean } }`. Task 5 renders `blocker`.

- [ ] **Step 1: Write the failing test**

Create `backend/src/credit/services/__tests__/dashboard.blocker.test.ts`:

```typescript
import { resolveBlocker } from '../dashboard.service';

const base = {
  state: 'UNDERWRITING',
  slaStatus: 'OK' as const,
  daysOverdue: null,
  breachPolicyName: null,
  openConditionCount: null,
  currentTask: 'Complete underwriting',
  flags: { expiredBureau: false, highDsr: false, amlReview: false },
};

describe('resolveBlocker', () => {
  it('ranks an SLA breach above every other signal', () => {
    expect(resolveBlocker({
      ...base,
      state: 'REFERRED_BACK',
      slaStatus: 'OVERDUE',
      daysOverdue: 3,
      breachPolicyName: 'Underwriting 48h',
      openConditionCount: 2,
      flags: { expiredBureau: true, highDsr: false, amlReview: false },
    })).toBe('Overdue 3 days — Underwriting 48h');
  });

  it('names the outstanding condition count when returned', () => {
    expect(resolveBlocker({ ...base, state: 'REFERRED_BACK', openConditionCount: 2 }))
      .toBe('Returned by credit — 2 conditions outstanding');
  });

  it('singularises a lone outstanding condition', () => {
    expect(resolveBlocker({ ...base, state: 'KYC_REJECTED', openConditionCount: 1 }))
      .toBe('Returned by credit — 1 condition outstanding');
  });

  it('reports an information request on compliance hold', () => {
    expect(resolveBlocker({ ...base, state: 'COMPLIANCE_HOLD' }))
      .toBe('Information requested from customer');
  });

  it('surfaces an expired bureau report when nothing higher applies', () => {
    expect(resolveBlocker({ ...base, flags: { expiredBureau: true, highDsr: true, amlReview: false } }))
      .toBe('Bureau report expired');
  });

  it('surfaces high DSR below the bureau flag', () => {
    expect(resolveBlocker({ ...base, flags: { expiredBureau: false, highDsr: true, amlReview: false } }))
      .toBe('DSR above policy threshold');
  });

  it('surfaces AML review below DSR', () => {
    expect(resolveBlocker({ ...base, flags: { expiredBureau: false, highDsr: false, amlReview: true } }))
      .toBe('Pending AML review');
  });

  it('falls back to the state-derived task when nothing is blocking', () => {
    expect(resolveBlocker(base)).toBe('Complete underwriting');
  });

  it('falls back when returned but the condition count is unavailable', () => {
    expect(resolveBlocker({ ...base, state: 'REFERRED_BACK', openConditionCount: null, currentTask: 'Resolve returned items' }))
      .toBe('Returned by credit');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest src/credit/services/__tests__/dashboard.blocker.test.ts`
Expected: FAIL — `resolveBlocker is not a function`.

- [ ] **Step 3: Implement the ladder**

```typescript
export interface BlockerInput {
  state: string;
  slaStatus: 'OK' | 'WARNING' | 'OVERDUE';
  daysOverdue: number | null;
  breachPolicyName: string | null;
  openConditionCount: number | null;
  currentTask: string;
  flags: { expiredBureau: boolean; highDsr: boolean; amlReview: boolean };
}

const RETURNED_STATES = new Set(['REFERRED_BACK', 'KYC_REJECTED']);

/**
 * The RM asked "what is stuck and why". `currentTask` only restates the state,
 * so it is the last rung, not the first. Order is deliberate: the rung that
 * costs the RM the most time wins.
 */
export function resolveBlocker(input: BlockerInput): string {
  if (input.slaStatus === 'OVERDUE' && input.daysOverdue != null && input.breachPolicyName) {
    const unit = input.daysOverdue === 1 ? 'day' : 'days';
    return `Overdue ${input.daysOverdue} ${unit} — ${input.breachPolicyName}`;
  }
  if (RETURNED_STATES.has(input.state)) {
    if (input.openConditionCount == null) return 'Returned by credit';
    const unit = input.openConditionCount === 1 ? 'condition' : 'conditions';
    return `Returned by credit — ${input.openConditionCount} ${unit} outstanding`;
  }
  if (input.state === 'COMPLIANCE_HOLD') return 'Information requested from customer';
  if (input.flags.expiredBureau) return 'Bureau report expired';
  if (input.flags.highDsr) return 'DSR above policy threshold';
  if (input.flags.amlReview) return 'Pending AML review';
  return input.currentTask;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx jest src/credit/services/__tests__/dashboard.blocker.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Wire it into `toMyWorkItem`**

Add `blocker: string;` to the `MyWorkItem` interface.

Build a batched condition-count map once per request, beside the SLA queries. Before writing it, confirm the model name for returned conditions:

Run: `cd backend && grep -n "^model Credit.*Condition" prisma/schema.prisma`

If a conditions model with an `applicationId` and an open/satisfied flag exists, group it in one query:

```typescript
    const conditionRows = await prisma.creditApplicationCondition.groupBy({
      by: ['applicationId'],
      where: { applicationId: { in: candidateAppIds }, satisfiedAt: null },
      _count: { _all: true },
    });
    const openConditionsByApp = new Map(conditionRows.map(r => [r.applicationId, r._count._all]));
```

where `candidateAppIds` is `[...myAssigned, ...myApprovals].map(a => a.id)`.

**If no such model exists**, do not invent one and do not query per row. Set `const openConditionsByApp = new Map<string, number>();` with this comment, and the ladder degrades to `'Returned by credit'` exactly as the test `falls back when returned but the condition count is unavailable` asserts:

```typescript
    // No conditions model exists to count against. Spec §9.3 defines this
    // degradation: the blocker says "Returned by credit" without a count
    // rather than approximating one.
```

Record which branch you took in the commit message.

Then inside `toMyWorkItem`, after the guidance line:

```typescript
      const breach = myBreaches.find(b => b.application.id === app.id);
      const blocker = resolveBlocker({
        state: app.state as string,
        slaStatus,
        daysOverdue: breach ? Math.floor((Date.now() - breach.breachedAt.getTime()) / 86400000) : null,
        breachPolicyName: breach?.policy?.name ?? null,
        openConditionCount: openConditionsByApp.get(app.id) ?? null,
        currentTask: guidance.currentTask,
        flags: { expiredBureau: false, highDsr: false, amlReview: false },
      });
```

Add `blocker` to the returned object. The three flags are wired in Task 8; leaving them `false` here keeps this task independently shippable and the ladder falls through to `currentTask`, which is today's behaviour.

- [ ] **Step 6: Mirror the field on the frontend type**

In `frontend/src/services/credit.service.ts`, add to `MyWorkItem`:

```typescript
  blocker: string;
  slaRemainingHours: number | null;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  currentTask: string;
  nextAction: { label: string; route: string };
```

The last four are already returned by the API but missing from the frontend type, which is why the dashboard reads them as `any`.

- [ ] **Step 7: Run tests and typecheck**

Run: `cd backend && npx jest src/credit/services/__tests__/ && npx tsc --noEmit`
Run: `cd frontend && npx tsc --noEmit`
Expected: tests PASS, both typechecks clean.

- [ ] **Step 8: Commit**

```bash
git add backend/src/credit/services/ frontend/src/services/credit.service.ts
git commit -m "feat(credit): add blocker field naming why an application is stuck"
```

---

### Task 4: Lane resolution

**Files:**
- Create: `frontend/src/components/credit/dashboard/useCreditLane.ts`
- Create: `frontend/src/components/credit/dashboard/LaneSwitcher.tsx`
- Test: `frontend/src/components/credit/dashboard/__tests__/useCreditLane.test.tsx`

**Interfaces:**
- Consumes: `hasPermission(user, permission)` from `frontend/src/utils/permissions`.
- Produces: `export type CreditLane = 'rm' | 'approver' | 'manager'`; `export const CREDIT_LANE_STORAGE_KEY = 'credit.lane'`; `export function availableLanes(user: User | null): CreditLane[]`; `export function useCreditLane(user: User | null): { lane: CreditLane; lanes: CreditLane[]; setLane: (l: CreditLane) => void }`; and `LaneSwitcher` with props `{ lane: CreditLane; lanes: CreditLane[]; onChange: (l: CreditLane) => void }`. Task 7 mounts both.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/credit/dashboard/__tests__/useCreditLane.test.tsx`:

```typescript
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { CREDIT_LANE_STORAGE_KEY, availableLanes, useCreditLane } from '../useCreditLane';

const userWith = (permissions: string[]) => ({ id: 'u1', permissions } as any);

describe('useCreditLane', () => {
  beforeEach(() => localStorage.clear());

  it('defaults a plain credit user to the RM lane', () => {
    const { result } = renderHook(() => useCreditLane(userWith(['credit:read'])));
    expect(result.current.lane).toBe('rm');
    expect(result.current.lanes).toEqual(['rm']);
  });

  it('defaults an approver to the approver lane', () => {
    const { result } = renderHook(() => useCreditLane(userWith(['credit:read', 'credit:approve'])));
    expect(result.current.lane).toBe('approver');
  });

  it('defaults an administrator to the manager lane', () => {
    const { result } = renderHook(() => useCreditLane(userWith(['credit:read', 'credit:admin'])));
    expect(result.current.lane).toBe('manager');
  });

  it('offers every qualifying lane to a multi-hat user', () => {
    expect(availableLanes(userWith(['credit:read', 'credit:approve', 'credit:admin'])))
      .toEqual(['rm', 'approver', 'manager']);
  });

  it('prefers an explicit stored choice over permission inference', () => {
    localStorage.setItem(CREDIT_LANE_STORAGE_KEY, 'rm');
    const { result } = renderHook(() => useCreditLane(userWith(['credit:read', 'credit:approve'])));
    expect(result.current.lane).toBe('rm');
  });

  it('ignores a stored lane the user no longer qualifies for', () => {
    localStorage.setItem(CREDIT_LANE_STORAGE_KEY, 'manager');
    const { result } = renderHook(() => useCreditLane(userWith(['credit:read', 'credit:approve'])));
    expect(result.current.lane).toBe('approver');
  });

  it('persists a lane change', () => {
    const { result } = renderHook(() => useCreditLane(userWith(['credit:read', 'credit:approve'])));
    act(() => result.current.setLane('rm'));
    expect(result.current.lane).toBe('rm');
    expect(localStorage.getItem(CREDIT_LANE_STORAGE_KEY)).toBe('rm');
  });

  it('falls back to the RM lane for a user with no credit permissions', () => {
    const { result } = renderHook(() => useCreditLane(userWith([])));
    expect(result.current.lane).toBe('rm');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/credit/dashboard/__tests__/useCreditLane.test.tsx`
Expected: FAIL — cannot resolve `../useCreditLane`.

- [ ] **Step 3: Implement the hook**

Create `frontend/src/components/credit/dashboard/useCreditLane.ts`:

```typescript
import { useCallback, useState } from 'react';
import { hasPermission } from '../../../utils/permissions';
import type { User } from '../../../types/auth.types';

export type CreditLane = 'rm' | 'approver' | 'manager';

export const CREDIT_LANE_STORAGE_KEY = 'credit.lane';

export const LANE_LABELS: Record<CreditLane, string> = {
  rm: 'My deals',
  approver: 'Decisions',
  manager: 'Portfolio',
};

/** Every lane the user qualifies for, in display order. RM is always offered. */
export function availableLanes(user: User | null): CreditLane[] {
  const lanes: CreditLane[] = ['rm'];
  if (hasPermission(user, 'credit:approve')) lanes.push('approver');
  if (hasPermission(user, 'credit:admin')) lanes.push('manager');
  return lanes;
}

/** The lane a user lands on with no stored preference: most specific wins. */
function inferLane(lanes: CreditLane[]): CreditLane {
  if (lanes.includes('manager')) return 'manager';
  if (lanes.includes('approver')) return 'approver';
  return 'rm';
}

function readStoredLane(): CreditLane | null {
  try {
    const raw = localStorage.getItem(CREDIT_LANE_STORAGE_KEY);
    return raw === 'rm' || raw === 'approver' || raw === 'manager' ? raw : null;
  } catch {
    return null; // Private browsing or a blocked storage partition.
  }
}

export function useCreditLane(user: User | null) {
  const lanes = availableLanes(user);
  const [lane, setLaneState] = useState<CreditLane>(() => {
    const stored = readStoredLane();
    // A stored lane the user no longer qualifies for must not strand them on
    // an empty screen after a permission change.
    return stored && lanes.includes(stored) ? stored : inferLane(lanes);
  });

  const setLane = useCallback((next: CreditLane) => {
    setLaneState(next);
    try { localStorage.setItem(CREDIT_LANE_STORAGE_KEY, next); } catch { /* storage unavailable */ }
  }, []);

  return { lane, lanes, setLane };
}
```

If `frontend/src/types/auth.types` does not export `User`, import it from wherever `permissions.ts` imports it — check with `grep -n "import.*User" frontend/src/utils/permissions.ts` and match that path exactly.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/components/credit/dashboard/__tests__/useCreditLane.test.tsx`
Expected: PASS, 8 tests.

- [ ] **Step 5: Write the switcher test**

Append to the same test file:

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LaneSwitcher from '../LaneSwitcher';

describe('LaneSwitcher', () => {
  it('renders nothing when the user qualifies for only one lane', () => {
    const { container } = render(<LaneSwitcher lane="rm" lanes={['rm']} onChange={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('marks the active lane and reports a change', async () => {
    const onChange = vi.fn();
    render(<LaneSwitcher lane="approver" lanes={['rm', 'approver']} onChange={onChange} />);
    expect(screen.getByRole('tab', { name: 'Decisions' })).toHaveAttribute('aria-selected', 'true');
    await userEvent.click(screen.getByRole('tab', { name: 'My deals' }));
    expect(onChange).toHaveBeenCalledWith('rm');
  });
});
```

Add `vi` to the existing `vitest` import.

- [ ] **Step 6: Implement the switcher**

Create `frontend/src/components/credit/dashboard/LaneSwitcher.tsx`:

```tsx
import React from 'react';
import { CreditLane, LANE_LABELS } from './useCreditLane';

interface LaneSwitcherProps {
  lane: CreditLane;
  lanes: CreditLane[];
  onChange: (lane: CreditLane) => void;
}

/**
 * Multi-hat users (an RM who also approves) are the norm here, so the switcher
 * is a persistent first-class control rather than a fallback. It disappears
 * entirely when there is nothing to switch between.
 */
const LaneSwitcher: React.FC<LaneSwitcherProps> = ({ lane, lanes, onChange }) => {
  if (lanes.length < 2) return null;
  return (
    <div role="tablist" aria-label="Credit view" style={{ display: 'flex', gap: 4, background: 'var(--cr-surface-container-low)', padding: 3, borderRadius: 'var(--cr-radius)' }}>
      {lanes.map(l => (
        <button
          key={l}
          role="tab"
          aria-selected={l === lane}
          onClick={() => onChange(l)}
          style={{
            fontFamily: 'var(--cr-font-display)', fontSize: 13, fontWeight: 600,
            padding: '6px 14px', border: 'none', cursor: 'pointer',
            borderRadius: 'var(--cr-radius)',
            background: l === lane ? 'var(--cr-surface-container-lowest)' : 'transparent',
            color: l === lane ? 'var(--cr-on-surface)' : 'var(--cr-on-surface-variant)',
          }}
        >
          {LANE_LABELS[l]}
        </button>
      ))}
    </div>
  );
};

export default LaneSwitcher;
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/components/credit/dashboard/__tests__/useCreditLane.test.tsx`
Expected: PASS, 10 tests.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/credit/dashboard/useCreditLane.ts frontend/src/components/credit/dashboard/LaneSwitcher.tsx frontend/src/components/credit/dashboard/__tests__/useCreditLane.test.tsx
git commit -m "feat(credit): add credit dashboard lane resolution and switcher"
```

---

### Task 5: RM lane

**Files:**
- Create: `frontend/src/components/credit/dashboard/RmLane.tsx`
- Test: `frontend/src/components/credit/dashboard/__tests__/RmLane.test.tsx`

**Interfaces:**
- Consumes: `MyWorkItem` from `frontend/src/services/credit.service` as extended in Task 3 (`blocker`, `slaRemainingHours`, `priority`, `nextAction`).
- Produces: `RmLane` with props `{ items: MyWorkItem[]; formatAmount: (v: number | null) => string }`. Task 7 mounts it.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/credit/dashboard/__tests__/RmLane.test.tsx`:

```tsx
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import RmLane from '../RmLane';
import type { MyWorkItem } from '../../../../services/credit.service';

const item = (over: Partial<MyWorkItem>): MyWorkItem => ({
  id: 'app-1', applicationNo: 'CA-2026-00016', state: 'UNDERWRITING',
  borrowerName: 'Lyra Manufacturing Sdn Bhd', productType: 'TERM_LOAN',
  updatedAt: '2026-08-19T00:00:00Z', requestedAmount: 7000000, riskGrade: 'BB',
  slaStatus: 'OK', entityType: 'CORPORATE', slaRemainingHours: 40, priority: 'MEDIUM',
  blocker: 'Complete underwriting', currentTask: 'Complete underwriting',
  nextAction: { label: 'Continue underwriting', route: '/credit/applications/app-1' },
  ...over,
});

const renderLane = (items: MyWorkItem[]) => render(
  <MemoryRouter><RmLane items={items} formatAmount={v => `RM ${v?.toLocaleString() ?? '—'}`} /></MemoryRouter>,
);

describe('RmLane', () => {
  it('leads each needs-you row with the blocker, not the state name', () => {
    renderLane([item({ state: 'REFERRED_BACK', blocker: 'Returned by credit — 2 conditions outstanding', priority: 'HIGH' })]);
    const row = screen.getByRole('listitem', { name: /CA-2026-00016/ });
    expect(within(row).getByText('Returned by credit — 2 conditions outstanding')).toBeInTheDocument();
    expect(within(row).queryByText('REFERRED_BACK')).not.toBeInTheDocument();
  });

  it('gives every needs-you row exactly one primary action linking to the fix', () => {
    renderLane([item({ state: 'REFERRED_BACK', priority: 'HIGH', nextAction: { label: 'Review returned items', route: '/credit/applications/app-1' } })]);
    const row = screen.getByRole('listitem', { name: /CA-2026-00016/ });
    const links = within(row).getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAccessibleName('Review returned items');
    expect(links[0]).toHaveAttribute('href', '/credit/applications/app-1');
  });

  it('shows the SLA countdown when hours remain', () => {
    renderLane([item({ slaRemainingHours: 4, slaStatus: 'WARNING', priority: 'HIGH' })]);
    expect(screen.getByText('4h left')).toBeInTheDocument();
  });

  it('shows overdue instead of a countdown once breached', () => {
    renderLane([item({ slaStatus: 'OVERDUE', slaRemainingHours: 0, priority: 'HIGH' })]);
    expect(screen.getByText('Overdue')).toBeInTheDocument();
  });

  it('orders needs-you rows by priority', () => {
    renderLane([
      item({ id: 'a', applicationNo: 'CA-LOW', priority: 'LOW' }),
      item({ id: 'b', applicationNo: 'CA-HIGH', priority: 'HIGH' }),
      item({ id: 'c', applicationNo: 'CA-MED', priority: 'MEDIUM' }),
    ]);
    const rows = screen.getAllByRole('listitem');
    expect(rows[0]).toHaveAccessibleName(expect.stringContaining('CA-HIGH'));
    expect(rows[1]).toHaveAccessibleName(expect.stringContaining('CA-MED'));
    expect(rows[2]).toHaveAccessibleName(expect.stringContaining('CA-LOW'));
  });

  it('separates drafts into a resume strip rather than the needs-you list', () => {
    renderLane([item({ id: 'd', applicationNo: 'CA-DRAFT', state: 'DRAFT', blocker: 'Complete application', nextAction: { label: 'Continue application', route: '/credit/applications/d' } })]);
    const drafts = screen.getByRole('region', { name: 'Drafts' });
    expect(within(drafts).getByRole('link', { name: /CA-DRAFT/ })).toBeInTheDocument();
  });

  it('groups in-flight work by who is holding it, not by state name', () => {
    renderLane([
      item({ id: 'x', applicationNo: 'CA-X', state: 'KYC_REVIEW', priority: 'LOW', blocker: 'Complete KYC review' }),
      item({ id: 'y', applicationNo: 'CA-Y', state: 'COMPLIANCE_HOLD', priority: 'LOW', blocker: 'Information requested from customer' }),
      item({ id: 'z', applicationNo: 'CA-Z', state: 'COMMITTEE_REVIEW', priority: 'LOW', blocker: 'Complete approval review' }),
    ]);
    const inFlight = screen.getByRole('region', { name: 'In flight' });
    expect(within(inFlight).getByRole('heading', { name: 'With credit' })).toBeInTheDocument();
    expect(within(inFlight).getByRole('heading', { name: 'With customer' })).toBeInTheDocument();
    expect(within(inFlight).getByRole('heading', { name: 'With committee' })).toBeInTheDocument();
  });

  it('tells the RM when nothing needs them', () => {
    renderLane([]);
    expect(screen.getByText('Nothing is waiting on you.')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/credit/dashboard/__tests__/RmLane.test.tsx`
Expected: FAIL — cannot resolve `../RmLane`.

- [ ] **Step 3: Implement the lane**

Create `frontend/src/components/credit/dashboard/RmLane.tsx`:

```tsx
import React from 'react';
import { Link } from 'react-router-dom';
import type { MyWorkItem } from '../../../services/credit.service';

interface RmLaneProps {
  items: MyWorkItem[];
  formatAmount: (value: number | null) => string;
}

const PRIORITY_RANK: Record<MyWorkItem['priority'], number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

/**
 * Who is holding the application, which is what an RM actually reasons about.
 * Collapses ~10 state names into 3 groups.
 */
const HOLDER_GROUPS: { label: string; states: string[] }[] = [
  { label: 'With credit', states: ['SUBMITTED', 'KYC_REVIEW', 'KYC_APPROVED', 'UNDERWRITING', 'CREDIT_ASSESSMENT'] },
  { label: 'With customer', states: ['COMPLIANCE_HOLD', 'OFFER'] },
  { label: 'With committee', states: ['COMMITTEE_REVIEW'] },
];

/** A row belongs in "Needs you" when the RM is the one blocking it. */
const NEEDS_YOU_STATES = new Set(['REFERRED_BACK', 'KYC_REJECTED', 'COMPLIANCE_HOLD']);
const isNeedsYou = (i: MyWorkItem) =>
  i.slaStatus === 'OVERDUE' || i.slaStatus === 'WARNING' || NEEDS_YOU_STATES.has(i.state);

function slaLabel(item: MyWorkItem): { text: string; color: string } | null {
  if (item.slaStatus === 'OVERDUE') return { text: 'Overdue', color: '#b42318' };
  if (item.slaRemainingHours == null) return null;
  return { text: `${item.slaRemainingHours}h left`, color: item.slaStatus === 'WARNING' ? '#b54708' : 'var(--cr-on-surface-variant)' };
}

const NeedsYouRow: React.FC<{ item: MyWorkItem; formatAmount: RmLaneProps['formatAmount'] }> = ({ item, formatAmount }) => {
  const sla = slaLabel(item);
  return (
    <li aria-label={`${item.applicationNo} ${item.borrowerName}`} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '14px 20px', borderBottom: '1px solid var(--cr-outline-variant)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <span style={{ fontSize: 13, color: 'var(--cr-on-surface-variant)' }}>{item.applicationNo} · {item.borrowerName}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--cr-on-surface)', whiteSpace: 'nowrap' }}>{formatAmount(item.requestedAmount)}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--cr-on-surface)' }}>{item.blocker}</span>
        {sla && <span style={{ fontSize: 13, fontWeight: 600, color: sla.color, whiteSpace: 'nowrap' }}>{sla.text}</span>}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Link to={item.nextAction.route} style={{ fontSize: 13, fontWeight: 600, color: 'var(--cr-secondary)', textDecoration: 'none' }}>{item.nextAction.label}</Link>
      </div>
    </li>
  );
};

const RmLane: React.FC<RmLaneProps> = ({ items, formatAmount }) => {
  const drafts = items.filter(i => i.state === 'DRAFT');
  const rest = items.filter(i => i.state !== 'DRAFT');
  const needsYou = rest.filter(isNeedsYou).sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);
  const inFlight = rest.filter(i => !isNeedsYou(i));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {drafts.length > 0 && (
        <section aria-label="Drafts" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, padding: '12px 20px', background: 'var(--cr-surface-container-low)', border: '1px solid var(--cr-outline-variant)', borderRadius: 'var(--cr-radius-lg, 0.5rem)' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--cr-on-surface-variant)' }}>Resume draft</span>
          {drafts.map(d => (
            <Link key={d.id} to={d.nextAction.route} style={{ fontSize: 13, fontWeight: 600, color: 'var(--cr-secondary)', textDecoration: 'none' }}>
              {d.applicationNo} · {d.borrowerName}
            </Link>
          ))}
        </section>
      )}

      <section aria-labelledby="rm-needs-you-heading" style={{ background: 'var(--cr-surface-container-lowest)', border: '1px solid var(--cr-outline-variant)', borderRadius: 'var(--cr-radius-lg, 0.5rem)', overflow: 'hidden' }}>
        <h2 id="rm-needs-you-heading" style={{ fontFamily: 'var(--cr-font-display)', fontSize: 14, fontWeight: 600, padding: '16px 20px', borderBottom: '1px solid var(--cr-outline-variant)', color: 'var(--cr-on-surface)' }}>
          Needs you{needsYou.length > 0 ? ` · ${needsYou.length}` : ''}
        </h2>
        {needsYou.length === 0
          ? <p style={{ padding: 32, textAlign: 'center', color: 'var(--cr-on-surface-variant)', margin: 0 }}>Nothing is waiting on you.</p>
          : <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>{needsYou.map(i => <NeedsYouRow key={i.id} item={i} formatAmount={formatAmount} />)}</ul>}
      </section>

      {inFlight.length > 0 && (
        <section aria-label="In flight" style={{ background: 'var(--cr-surface-container-lowest)', border: '1px solid var(--cr-outline-variant)', borderRadius: 'var(--cr-radius-lg, 0.5rem)', padding: 20 }}>
          <h2 style={{ fontFamily: 'var(--cr-font-display)', fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--cr-on-surface)' }}>In flight</h2>
          {HOLDER_GROUPS.map(group => {
            const groupItems = inFlight.filter(i => group.states.includes(i.state));
            if (groupItems.length === 0) return null;
            return (
              <div key={group.label} style={{ marginBottom: 12 }}>
                <h3 style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', color: 'var(--cr-on-surface-variant)', marginBottom: 6 }}>{group.label}</h3>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {groupItems.map(i => (
                    <li key={i.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13 }}>
                      <Link to={`/credit/applications/${i.id}`} style={{ color: 'var(--cr-secondary)', fontWeight: 600, textDecoration: 'none' }}>{i.applicationNo}</Link>
                      <span style={{ color: 'var(--cr-on-surface-variant)' }}>{i.borrowerName}</span>
                      <span style={{ color: 'var(--cr-on-surface)', whiteSpace: 'nowrap' }}>{formatAmount(i.requestedAmount)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
};

export default RmLane;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/components/credit/dashboard/__tests__/RmLane.test.tsx`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/credit/dashboard/RmLane.tsx frontend/src/components/credit/dashboard/__tests__/RmLane.test.tsx
git commit -m "feat(credit): add RM lane leading with blockers and one action per row"
```

---

### Task 6: Shared decision body

Extracts the decision controls from `ApprovalQuickView` so the modal and the inline card cannot diverge. Behaviour-preserving; no visual change to the modal.

**Files:**
- Create: `frontend/src/components/credit/dashboard/DecisionActions.tsx`
- Modify: `frontend/src/components/credit/ApprovalQuickView.tsx`
- Test: `frontend/src/components/credit/dashboard/__tests__/DecisionActions.test.tsx`

**Interfaces:**
- Consumes: `ApprovalDecision` from `frontend/src/services/credit.service`.
- Produces: `DecisionActions` with props `{ applicationId: string; sodBlocked: boolean; sodReason?: string; submitting: boolean; onSubmit: (decision: ApprovalDecision) => void }`. Task 7 mounts it inside `DecisionCard`.

- [ ] **Step 1: Read the current decision block before moving it**

Run: `cd frontend && sed -n '1,140p' src/components/credit/ApprovalQuickView.tsx`

Identify the decision state (`showDecision`, `rejectionReasonCodes`), the guard at line 65 (`if (showDecision !== 'REJECT' || rejectionReasonCodes.length > 0) return;`) and the SOD message at line 288. All three move into `DecisionActions` unchanged in behaviour.

- [ ] **Step 2: Write the failing test**

Create `frontend/src/components/credit/dashboard/__tests__/DecisionActions.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import DecisionActions from '../DecisionActions';

describe('DecisionActions', () => {
  it('offers approve, return and decline', () => {
    render(<DecisionActions applicationId="a1" sodBlocked={false} submitting={false} onSubmit={() => {}} />);
    expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Return for information' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Decline' })).toBeInTheDocument();
  });

  it('submits an approval directly', async () => {
    const onSubmit = vi.fn();
    render(<DecisionActions applicationId="a1" sodBlocked={false} submitting={false} onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole('button', { name: 'Approve' }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ decision: 'APPROVE' }));
  });

  it('blocks a decline until a reason code is chosen', async () => {
    const onSubmit = vi.fn();
    render(<DecisionActions applicationId="a1" sodBlocked={false} submitting={false} onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole('button', { name: 'Decline' }));
    const confirm = screen.getByRole('button', { name: 'Confirm decline' });
    expect(confirm).toBeDisabled();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Affordability' }));
    expect(confirm).toBeEnabled();
    await userEvent.click(confirm);
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ decision: 'REJECT', rejectionReasonCodes: ['AFFORDABILITY'] }));
  });

  it('replaces the actions with the exclusion reason when SOD blocks the user', () => {
    render(<DecisionActions applicationId="a1" sodBlocked sodReason="You are the assigned Relationship Manager for this application." submitting={false} onSubmit={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
    expect(screen.getByText(/assigned Relationship Manager/)).toBeInTheDocument();
  });

  it('disables the actions while a decision is in flight', () => {
    render(<DecisionActions applicationId="a1" sodBlocked={false} submitting onSubmit={() => {}} />);
    expect(screen.getByRole('button', { name: 'Approve' })).toBeDisabled();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/credit/dashboard/__tests__/DecisionActions.test.tsx`
Expected: FAIL — cannot resolve `../DecisionActions`.

- [ ] **Step 4: Implement the component**

Create `frontend/src/components/credit/dashboard/DecisionActions.tsx`. Copy the reason-code list verbatim from `ApprovalQuickView` — do not invent codes. Read it first with `grep -n "rejectionReason\|REASON_CODES" src/components/credit/ApprovalQuickView.tsx` and reuse the same constant, exporting it from a shared module if it is currently local.

```tsx
import React, { useState } from 'react';
import type { ApprovalDecision } from '../../../services/credit.service';
import { REJECTION_REASON_CODES } from '../approvalDecision';

interface DecisionActionsProps {
  applicationId: string;
  sodBlocked: boolean;
  sodReason?: string;
  submitting: boolean;
  onSubmit: (decision: ApprovalDecision) => void;
}

/**
 * The single source of decision behaviour for both the ApprovalQuickView modal
 * and the inline decision card. Rejection reason codes are mandatory — that
 * rule lives here so the two surfaces cannot drift apart.
 */
const DecisionActions: React.FC<DecisionActionsProps> = ({ applicationId, sodBlocked, sodReason, submitting, onSubmit }) => {
  const [mode, setMode] = useState<'IDLE' | 'REJECT' | 'RETURN'>('IDLE');
  const [codes, setCodes] = useState<string[]>([]);
  const [comment, setComment] = useState('');

  if (sodBlocked) {
    return (
      <p role="note" style={{ fontSize: 13, color: 'var(--cr-on-surface-variant)', margin: 0, padding: '12px 0' }}>
        {sodReason ?? 'You are not permitted to decide this application.'}
      </p>
    );
  }

  const toggle = (code: string) =>
    setCodes(prev => (prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]));

  if (mode === 'IDLE') {
    return (
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button disabled={submitting} onClick={() => onSubmit({ applicationId, decision: 'APPROVE', comments: '' } as ApprovalDecision)}>Approve</button>
        <button disabled={submitting} onClick={() => setMode('RETURN')}>Return for information</button>
        <button disabled={submitting} onClick={() => setMode('REJECT')}>Decline</button>
      </div>
    );
  }

  const isReject = mode === 'REJECT';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {isReject && (
        <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
          <legend style={{ fontSize: 12, fontWeight: 600, color: 'var(--cr-on-surface-variant)' }}>Reason (required)</legend>
          {REJECTION_REASON_CODES.map(rc => (
            <label key={rc.code} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              <input type="checkbox" checked={codes.includes(rc.code)} onChange={() => toggle(rc.code)} />
              {rc.label}
            </label>
          ))}
        </fieldset>
      )}
      <textarea aria-label="Comments" value={comment} onChange={e => setComment(e.target.value)} rows={2} />
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          disabled={submitting || (isReject && codes.length === 0)}
          onClick={() => onSubmit({
            applicationId,
            decision: isReject ? 'REJECT' : 'RETURN',
            comments: comment,
            ...(isReject ? { rejectionReasonCodes: codes } : {}),
          } as ApprovalDecision)}
        >
          {isReject ? 'Confirm decline' : 'Confirm return'}
        </button>
        <button disabled={submitting} onClick={() => { setMode('IDLE'); setCodes([]); setComment(''); }}>Cancel</button>
      </div>
    </div>
  );
};

export default DecisionActions;
```

If `REJECTION_REASON_CODES` does not already exist in `approvalDecision.ts`, move the literal list out of `ApprovalQuickView.tsx` into that file and export it, keeping the codes and labels byte-identical. The test asserts the label `Affordability` maps to code `AFFORDABILITY`; if the real list differs, update the test to the real first code rather than changing the codes.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/components/credit/dashboard/__tests__/DecisionActions.test.tsx`
Expected: PASS, 5 tests.

- [ ] **Step 6: Repoint the modal at the shared component**

In `ApprovalQuickView.tsx`, replace the inline decision markup and its local `showDecision` / `rejectionReasonCodes` state with `<DecisionActions ... />`, passing the existing `onDecision` callback through `onSubmit` and the existing SOD condition through `sodBlocked` / `sodReason`.

- [ ] **Step 7: Verify no approval regression**

Run: `cd frontend && npx vitest run src/components/credit/ && npx tsc --noEmit`
Expected: PASS, typecheck clean. Any existing `ApprovalQuickView` test must stay green without being edited — if one fails, the extraction changed behaviour and must be corrected rather than the test relaxed.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/credit/
git commit -m "refactor(credit): extract shared decision actions from ApprovalQuickView"
```

---

### Task 7: Approver lane

**Files:**
- Create: `frontend/src/components/credit/dashboard/DecisionCard.tsx`
- Create: `frontend/src/components/credit/dashboard/ApproverLane.tsx`
- Test: `frontend/src/components/credit/dashboard/__tests__/ApproverLane.test.tsx`

**Interfaces:**
- Consumes: `ApprovalInbox` / `ApprovalInboxItem` from `frontend/src/services/credit.types`; `DecisionActions` from Task 6; `creditService.getApplication(id)`.
- Produces: `ApproverLane` with props `{ inbox: ApprovalInbox; onDecision: (applicationId: string, decision: ApprovalDecision) => void; formatAmount: (v: number | null) => string }`; `DecisionCard` with props `{ item: ApprovalInboxItem; onDecision: ApproverLaneProps['onDecision'] }`. Task 8 mounts `ApproverLane`.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/credit/dashboard/__tests__/ApproverLane.test.tsx`:

```tsx
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ApproverLane from '../ApproverLane';
import creditService from '../../../../services/credit.service';

vi.mock('../../../../services/credit.service', async (orig) => {
  const actual = await orig<typeof import('../../../../services/credit.service')>();
  return { ...actual, default: { ...actual.default, getApplication: vi.fn() } };
});

const mkItem = (over: Partial<any> = {}) => ({
  applicationId: 'app-1', applicationNo: 'CA-LEAN-003', borrowerName: 'Lyra Manufacturing Sdn Bhd',
  productType: 'TERM_LOAN', requestedAmount: 6000000, currency: 'MYR',
  currentState: 'COMMITTEE_REVIEW', urgency: 'HIGH', submittedAt: '2026-08-15T00:00:00Z',
  daysWaiting: 5, riskRating: 'BB', _slaBreached: false, ...over,
});

const inbox = (over: Partial<any> = {}) => ({
  high: [mkItem()], medium: [], low: [], totalPending: 1, excluded: [], ...over,
});

const renderLane = (inboxValue = inbox()) => render(
  <MemoryRouter>
    <ApproverLane inbox={inboxValue as any} onDecision={vi.fn()} formatAmount={v => `RM ${v?.toLocaleString() ?? '—'}`} />
  </MemoryRouter>,
);

describe('ApproverLane', () => {
  beforeEach(() => vi.clearAllMocks());

  it('states how many decisions wait and how many are overdue', () => {
    renderLane(inbox({ high: [mkItem({ _slaBreached: true }), mkItem({ applicationId: 'a2', applicationNo: 'CA-2', _slaBreached: true })], totalPending: 3, medium: [mkItem({ applicationId: 'a3', applicationNo: 'CA-3' })] }));
    expect(screen.getByRole('heading', { name: '3 decisions waiting · 2 overdue' })).toBeInTheDocument();
  });

  it('shows identity, amount, risk grade and days waiting on the collapsed row', () => {
    renderLane();
    const row = screen.getByRole('listitem', { name: /CA-LEAN-003/ });
    expect(within(row).getByText('Lyra Manufacturing Sdn Bhd')).toBeInTheDocument();
    expect(within(row).getByText('RM 6,000,000')).toBeInTheDocument();
    expect(within(row).getByText('BB')).toBeInTheDocument();
    expect(within(row).getByText('5 days waiting')).toBeInTheDocument();
  });

  it('does not fetch detail until a row is expanded', () => {
    renderLane();
    expect(creditService.getApplication).not.toHaveBeenCalled();
  });

  it('lazy-loads decision context for the expanded row only', async () => {
    (creditService.getApplication as any).mockResolvedValue({
      data: { data: { dsr: 42.5, groupExposure: 12000000, recommendation: 'Support subject to charge over plant.', policyExceptions: [{ code: 'DSR_BREACH', label: 'DSR above threshold' }] } },
    });
    renderLane();
    await userEvent.click(screen.getByRole('button', { name: /CA-LEAN-003/ }));
    await waitFor(() => expect(creditService.getApplication).toHaveBeenCalledWith('app-1'));
    expect(await screen.findByText('Support subject to charge over plant.')).toBeInTheDocument();
    expect(screen.getByText('DSR above threshold')).toBeInTheDocument();
  });

  it('decides inline without navigating away', async () => {
    (creditService.getApplication as any).mockResolvedValue({ data: { data: {} } });
    const onDecision = vi.fn();
    render(
      <MemoryRouter>
        <ApproverLane inbox={inbox() as any} onDecision={onDecision} formatAmount={v => `RM ${v}`} />
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole('button', { name: /CA-LEAN-003/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Approve' }));
    expect(onDecision).toHaveBeenCalledWith('app-1', expect.objectContaining({ decision: 'APPROVE' }));
  });

  it('keeps SOD-excluded items visible with their reason and no decision action', () => {
    renderLane(inbox({ high: [], totalPending: 0, excluded: [{ applicationId: 'app-9', applicationNo: 'CA-SOD-1', borrowerName: 'Own Deal Sdn Bhd', reason: 'You are the assigned Relationship Manager for this application.' }] }));
    const excluded = screen.getByRole('region', { name: 'Excluded from your queue' });
    expect(within(excluded).getByText('CA-SOD-1')).toBeInTheDocument();
    expect(within(excluded).getByText(/assigned Relationship Manager/)).toBeInTheDocument();
    expect(within(excluded).queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
  });

  it('tells the approver when the queue is clear', () => {
    renderLane(inbox({ high: [], totalPending: 0 }));
    expect(screen.getByText('No decisions are waiting on you.')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/credit/dashboard/__tests__/ApproverLane.test.tsx`
Expected: FAIL — cannot resolve `../ApproverLane`.

- [ ] **Step 3: Confirm the detail response shape before implementing**

Run: `cd frontend && sed -n '1300,1320p' src/services/credit.service.ts`

The test mocks `{ data: { data: { dsr, groupExposure, recommendation, policyExceptions } } }`. Confirm the real field names on the application detail response and use those exact names in `DecisionCard`. If a field genuinely is not on the detail payload, render nothing for it rather than a placeholder, and note the gap in the commit message — do not fabricate a value.

- [ ] **Step 4: Implement `DecisionCard`**

Create `frontend/src/components/credit/dashboard/DecisionCard.tsx`:

```tsx
import React, { useEffect, useState } from 'react';
import creditService, { ApprovalDecision } from '../../../services/credit.service';
import type { ApprovalInboxItem } from '../../../services/credit.types';
import DecisionActions from './DecisionActions';

interface DecisionContext {
  dsr?: number | null;
  groupExposure?: number | null;
  recommendation?: string | null;
  policyExceptions?: { code: string; label: string }[];
}

interface DecisionCardProps {
  item: ApprovalInboxItem;
  onDecision: (applicationId: string, decision: ApprovalDecision) => void;
}

/**
 * Expanded row body. Detail is fetched for this one row on expand — the inbox
 * DTO carries none of it, and fetching it for every row would be an N+1 across
 * the whole queue. Collapsed rows cost nothing.
 */
const DecisionCard: React.FC<DecisionCardProps> = ({ item, onDecision }) => {
  const [context, setContext] = useState<DecisionContext | null>(null);
  const [error, setError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    creditService.getApplication(item.applicationId)
      .then((res: any) => { if (!cancelled) setContext(res?.data?.data ?? {}); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [item.applicationId]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '12px 20px 16px', background: 'var(--cr-surface-container-low)' }}>
      {error && <p style={{ fontSize: 13, color: '#b42318', margin: 0 }}>Could not load decision context. Open the application to review it in full.</p>}

      {context?.policyExceptions && context.policyExceptions.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {context.policyExceptions.map(ex => (
            <span key={ex.code} style={{ fontSize: 12, fontWeight: 600, padding: '3px 8px', borderRadius: 999, background: '#fef3c7', color: '#92400e' }}>{ex.label}</span>
          ))}
        </div>
      )}

      <dl style={{ display: 'flex', flexWrap: 'wrap', gap: 24, margin: 0 }}>
        {context?.dsr != null && <div><dt style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--cr-on-surface-variant)' }}>DSR</dt><dd style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{context.dsr}%</dd></div>}
        {context?.groupExposure != null && <div><dt style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--cr-on-surface-variant)' }}>Group exposure</dt><dd style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{context.groupExposure.toLocaleString()}</dd></div>}
        {item.requestedTenor != null && <div><dt style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--cr-on-surface-variant)' }}>Tenor</dt><dd style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{item.requestedTenor} months</dd></div>}
      </dl>

      {context?.recommendation && (
        <div>
          <h4 style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--cr-on-surface-variant)', margin: '0 0 4px' }}>RM recommendation</h4>
          <p style={{ fontSize: 13, margin: 0, color: 'var(--cr-on-surface)' }}>{context.recommendation}</p>
        </div>
      )}

      <DecisionActions
        applicationId={item.applicationId}
        sodBlocked={false}
        submitting={submitting}
        onSubmit={(decision) => { setSubmitting(true); onDecision(item.applicationId, decision); }}
      />
    </div>
  );
};

export default DecisionCard;
```

- [ ] **Step 5: Implement `ApproverLane`**

Create `frontend/src/components/credit/dashboard/ApproverLane.tsx`:

```tsx
import React, { useState } from 'react';
import type { ApprovalDecision } from '../../../services/credit.service';
import type { ApprovalInbox, ApprovalInboxItem } from '../../../services/credit.types';
import DecisionCard from './DecisionCard';

interface ApproverLaneProps {
  inbox: ApprovalInbox;
  onDecision: (applicationId: string, decision: ApprovalDecision) => void;
  formatAmount: (value: number | null) => string;
}

const ApproverLane: React.FC<ApproverLaneProps> = ({ inbox, onDecision, formatAmount }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // The endpoint already ranks these; preserve its order rather than re-sorting.
  const items: ApprovalInboxItem[] = [...inbox.high, ...inbox.medium, ...inbox.low];
  const overdue = items.filter(i => i._slaBreached).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <section aria-labelledby="approver-inbox-heading" style={{ background: 'var(--cr-surface-container-lowest)', border: '1px solid var(--cr-outline-variant)', borderRadius: 'var(--cr-radius-lg, 0.5rem)', overflow: 'hidden' }}>
        <h2 id="approver-inbox-heading" style={{ fontFamily: 'var(--cr-font-display)', fontSize: 14, fontWeight: 600, padding: '16px 20px', borderBottom: '1px solid var(--cr-outline-variant)', color: 'var(--cr-on-surface)' }}>
          {inbox.totalPending} decisions waiting{overdue > 0 ? ` · ${overdue} overdue` : ''}
        </h2>
        {items.length === 0
          ? <p style={{ padding: 32, textAlign: 'center', color: 'var(--cr-on-surface-variant)', margin: 0 }}>No decisions are waiting on you.</p>
          : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {items.map(item => {
                const expanded = expandedId === item.applicationId;
                return (
                  <li key={item.applicationId} aria-label={`${item.applicationNo} ${item.borrowerName}`} style={{ borderBottom: '1px solid var(--cr-outline-variant)' }}>
                    <button
                      aria-expanded={expanded}
                      onClick={() => setExpandedId(expanded ? null : item.applicationId)}
                      style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 20px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                    >
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--cr-secondary)' }}>{item.applicationNo}</span>
                      <span style={{ fontSize: 13, color: 'var(--cr-on-surface-variant)', flex: 1 }}>{item.borrowerName}</span>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{formatAmount(item.requestedAmount)}</span>
                      {item.riskRating && <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: 'var(--cr-surface-container-low)' }}>{item.riskRating}</span>}
                      <span style={{ fontSize: 12, color: item._slaBreached ? '#b42318' : 'var(--cr-on-surface-variant)', whiteSpace: 'nowrap' }}>
                        {item.daysWaiting} {item.daysWaiting === 1 ? 'day' : 'days'} waiting
                      </span>
                    </button>
                    {expanded && <DecisionCard item={item} onDecision={onDecision} />}
                  </li>
                );
              })}
            </ul>
          )}
      </section>

      {inbox.excluded.length > 0 && (
        <section aria-label="Excluded from your queue" style={{ background: 'var(--cr-surface-container-lowest)', border: '1px solid var(--cr-outline-variant)', borderRadius: 'var(--cr-radius-lg, 0.5rem)', padding: 20 }}>
          <h2 style={{ fontFamily: 'var(--cr-font-display)', fontSize: 14, fontWeight: 600, marginBottom: 8, color: 'var(--cr-on-surface)' }}>Excluded from your queue</h2>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {inbox.excluded.map((ex: any) => (
              <li key={ex.applicationId} style={{ fontSize: 13 }}>
                <span style={{ fontWeight: 600, color: 'var(--cr-on-surface)' }}>{ex.applicationNo}</span>
                {ex.borrowerName && <span style={{ color: 'var(--cr-on-surface-variant)' }}> · {ex.borrowerName}</span>}
                <div style={{ color: 'var(--cr-on-surface-variant)' }}>{ex.reason}</div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};

export default ApproverLane;
```

Check `ApprovalInboxExclusion`'s real field names with `grep -n -A6 "ApprovalInboxExclusion" src/services/credit.types.ts` and replace the `any` cast plus the field names with the real ones.

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/components/credit/dashboard/__tests__/ApproverLane.test.tsx`
Expected: PASS, 7 tests.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/credit/dashboard/
git commit -m "feat(credit): add approver decision inbox with inline decisions"
```

---

### Task 8: Wire the shell, relocate analytics, connect the alert flags

**Files:**
- Create: `frontend/src/components/credit/dashboard/ManagerLane.tsx`
- Modify: `frontend/pages/credit/CreditDashboard.tsx`
- Modify: `backend/src/credit/services/dashboard.service.ts` (blocker flags)
- Test: `frontend/src/components/credit/dashboard/__tests__/CreditDashboardLanes.test.tsx`

**Interfaces:**
- Consumes: `useCreditLane`, `LaneSwitcher` (Task 4), `RmLane` (Task 5), `ApproverLane` (Task 7), `AttentionStrip` (existing).
- Produces: no new exports. `ManagerLane` takes the props the relocated widgets already take.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/credit/dashboard/__tests__/CreditDashboardLanes.test.tsx` asserting the shell renders the right lane. Mock `useCreditLane` so the test targets the swap, not the inference (Task 4 already covers inference):

```tsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

const laneMock = vi.fn();
vi.mock('../useCreditLane', async (orig) => {
  const actual = await orig<typeof import('../useCreditLane')>();
  return { ...actual, useCreditLane: () => laneMock() };
});

import CreditDashboard from '../../../../../pages/credit/CreditDashboard';

describe('CreditDashboard lane swap', () => {
  it('renders the RM lane for an RM', async () => {
    laneMock.mockReturnValue({ lane: 'rm', lanes: ['rm'], setLane: vi.fn() });
    render(<MemoryRouter><CreditDashboard /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: /Needs you/ })).toBeInTheDocument();
    expect(screen.queryByText('Application Pipeline')).not.toBeInTheDocument();
  });

  it('renders the decision inbox for an approver', async () => {
    laneMock.mockReturnValue({ lane: 'approver', lanes: ['rm', 'approver'], setLane: vi.fn() });
    render(<MemoryRouter><CreditDashboard /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: /decisions waiting/ })).toBeInTheDocument();
  });

  it('keeps the analytics widgets available in the manager lane', async () => {
    laneMock.mockReturnValue({ lane: 'manager', lanes: ['rm', 'manager'], setLane: vi.fn() });
    render(<MemoryRouter><CreditDashboard /></MemoryRouter>);
    expect(await screen.findByText('Application Pipeline')).toBeInTheDocument();
  });

  it('shows the attention strip in every lane', async () => {
    laneMock.mockReturnValue({ lane: 'rm', lanes: ['rm'], setLane: vi.fn() });
    render(<MemoryRouter><CreditDashboard /></MemoryRouter>);
    expect(await screen.findByRole('link', { name: /^Overdue:/ })).toBeInTheDocument();
  });
});
```

`CreditDashboard` calls `useAuth` and the `dashboardApi` endpoints. Mock both at the top of the file, following the mocking style already used in `frontend/src/components/credit/__tests__/`. Read one of those files first to match the established pattern rather than inventing one.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/credit/dashboard/__tests__/CreditDashboardLanes.test.tsx`
Expected: FAIL — the RM lane heading does not render; the pipeline still renders in every lane.

- [ ] **Step 3: Create `ManagerLane`**

Move the Application Pipeline, Team Performance, SLA breach widget, and Recent Activities JSX out of `CreditDashboard.tsx` into `ManagerLane.tsx` verbatim, taking the same values as props. This is a relocation: do not restyle or restructure the widgets.

- [ ] **Step 4: Rewire the shell**

In `CreditDashboard.tsx`:
- Import `useCreditLane`, `LaneSwitcher`, `RmLane`, `ApproverLane`, `ManagerLane`.
- Call `const { lane, lanes, setLane } = useCreditLane(user);` beside the existing `hasPermission` calls.
- Render `<LaneSwitcher lane={lane} lanes={lanes} onChange={setLane} />` in the header action row, before the New Application button.
- Keep the header, branch filter, and `AttentionStrip` outside the lane swap.
- Replace the `PriorityWorkQueue` + `NextActionsPanel` pair at lines 684-685 with the lane swap:

```tsx
{lane === 'rm' && <RmLane items={myAssigned} formatAmount={formatMYR} />}
{lane === 'approver' && approvalInbox && (
  <ApproverLane inbox={approvalInbox} onDecision={handleDecision} formatAmount={formatMYR} />
)}
{lane === 'manager' && <ManagerLane {...managerProps} />}
```

Fetch the approval inbox with `dashboardApi.getApprovalInbox()` only when `lane === 'approver'`, so RMs do not pay for a request they never see. Implement `handleDecision` by reusing the submit handler already in `MyApprovals.tsx` — read it with `grep -n "onDecision\|submitDecision" frontend/pages/MyApprovals.tsx` and lift the same service call, including its toast and refetch behaviour.

Delete the now-unused `PriorityWorkQueue` and `NextActionsPanel` imports. Leave the component files in place — `CreditOfficerDashboard.test.tsx` still covers them and deleting them is out of scope.

- [ ] **Step 5: Make the attention counts filter the lane instead of navigating away**

Spec §3 requires the four attention counts to filter the lane below rather than
navigate to a separate list page. `AttentionStrip` currently renders links to
`/credit/applications?quickFilter=...`.

Add an optional `onSelect` prop. When it is supplied, render buttons that call
it; when it is absent, keep today's links so `AttentionStrip.test.tsx` stays
green unedited:

```tsx
interface AttentionStripProps {
  attention: { overdue: number; dueSoon: number; informationRequired: number; returned: number };
  onSelect?: (key: 'overdue' | 'dueSoon' | 'informationRequired' | 'returned') => void;
  active?: string | null;
}
```

In `CreditDashboard.tsx`, hold `const [quickFilter, setQuickFilter] = useState<string | null>(null)`,
pass `onSelect={key => setQuickFilter(k => (k === key ? null : key))}` and
`active={quickFilter}`, and filter the items handed to `RmLane` before render:

```tsx
const FILTER_PREDICATES: Record<string, (i: MyWorkItem) => boolean> = {
  overdue: i => i.slaStatus === 'OVERDUE',
  dueSoon: i => i.slaStatus === 'WARNING',
  informationRequired: i => i.state === 'COMPLIANCE_HOLD',
  returned: i => i.state === 'KYC_REJECTED' || i.state === 'REFERRED_BACK',
};
const laneItems = quickFilter ? myAssigned.filter(FILTER_PREDICATES[quickFilter]) : myAssigned;
```

Add this test to `CreditDashboardLanes.test.tsx`:

```tsx
  it('filters the lane in place when an attention count is selected', async () => {
    laneMock.mockReturnValue({ lane: 'rm', lanes: ['rm'], setLane: vi.fn() });
    render(<MemoryRouter><CreditDashboard /></MemoryRouter>);
    await userEvent.click(await screen.findByRole('button', { name: /^Returned:/ }));
    expect(screen.getByRole('heading', { name: /Needs you/ })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/');
  });
```

Import `userEvent` from `@testing-library/user-event` at the top of that file.

- [ ] **Step 6: Connect the three blocker flags**

The `OperationalAlerts` data (`highDsr`, `expiredBureau`, `amlReview`) is computed per-branch as counts with filter URLs, not per application. In `dashboard.service.ts`, extend the existing alerts query to also return the matching application IDs, build three `Set<string>`s once per request, and replace the hardcoded flags in `toMyWorkItem`:

```typescript
        flags: {
          expiredBureau: expiredBureauAppIds.has(app.id),
          highDsr: highDsrAppIds.has(app.id),
          amlReview: amlReviewAppIds.has(app.id),
        },
```

If the alerts are computed by an aggregate that cannot cheaply return IDs, leave the flags `false`, keep rungs 4-6 of the ladder dormant, and say so explicitly in the commit message. Do not add a per-row query.

- [ ] **Step 7: Run the full frontend and backend suites**

Run: `cd frontend && npx vitest run src/components/credit/ && npx tsc --noEmit`
Run: `cd backend && npx jest src/credit/ && npx tsc --noEmit`
Expected: all PASS, both typechecks clean.

- [ ] **Step 8: Commit**

```bash
git add frontend/pages/credit/CreditDashboard.tsx frontend/src/components/credit/dashboard/ backend/src/credit/services/dashboard.service.ts
git commit -m "feat(credit): serve RM, approver and manager lanes from one dashboard"
```

---

### Task 9: End-to-end verification

**Files:**
- Create: `frontend/e2e/credit/dashboard-lanes.spec.ts`

**Interfaces:**
- Consumes: the storage states registered in the existing auth setup. Read `frontend/e2e/credit/sod-exclusions.spec.ts` first — it already resolves per-role identities including an RM who cannot approve their own deal, and this spec must reuse those identities rather than seeding new ones.

- [ ] **Step 1: Read the existing E2E identity setup**

Run: `cd frontend && sed -n '1,40p' e2e/credit/sod-exclusions.spec.ts`

Note the exact storage-state names and the `test.use` pattern. Reuse them verbatim below.

- [ ] **Step 2: Write the spec**

Create `frontend/e2e/credit/dashboard-lanes.spec.ts`, substituting the real storage-state identifiers found in Step 1:

```typescript
import { expect, test } from '@playwright/test';

test.describe('Credit dashboard lanes', () => {
  test('an RM sees blockers with a single action per row', async ({ page }) => {
    await page.goto('/credit');
    const needsYou = page.getByRole('heading', { name: /Needs you/ });
    await expect(needsYou).toBeVisible();
    await expect(page.getByText('Unknown')).toHaveCount(0);
    const firstRow = page.getByRole('listitem').first();
    await expect(firstRow.getByRole('link')).toHaveCount(1);
  });

  test('an approver decides inline without leaving the dashboard', async ({ page }) => {
    await page.goto('/credit');
    await expect(page.getByRole('heading', { name: /decisions waiting/ })).toBeVisible();
    const row = page.getByRole('button', { name: /CA-/ }).first();
    await row.click();
    await expect(page.getByRole('button', { name: 'Approve' })).toBeVisible();
    await expect(page).toHaveURL(/\/credit$/);
  });

  test('a SOD-excluded application shows its reason and offers no decision', async ({ page }) => {
    await page.goto('/credit');
    const excluded = page.getByRole('region', { name: 'Excluded from your queue' });
    await expect(excluded).toBeVisible();
    await expect(excluded.getByRole('button', { name: 'Approve' })).toHaveCount(0);
  });

  test('a multi-hat user can switch lanes and the choice survives a reload', async ({ page }) => {
    await page.goto('/credit');
    await page.getByRole('tab', { name: 'My deals' }).click();
    await expect(page.getByRole('heading', { name: /Needs you/ })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: /Needs you/ })).toBeVisible();
  });
});
```

Wrap each test in the `test.use({ storageState: ... })` block matching its role, using the identifiers from Step 1.

- [ ] **Step 3: Run the E2E spec**

Run: `cd frontend && npx playwright test e2e/credit/dashboard-lanes.spec.ts --project=credit`
Expected: 4 PASS. If the demo seed has no application in a returned or compliance-hold state, the first test's single-action assertion may find an empty list — seed one via `backend/prisma/creditDemoSeed.ts` rather than weakening the assertion.

- [ ] **Step 4: Run the full gate**

Run: `cd backend && npm test`
Run: `cd frontend && npx vitest run && npx tsc --noEmit && npm run build`
Expected: all green. Report the actual counts; do not claim completion without them.

- [ ] **Step 5: Commit**

```bash
git add frontend/e2e/credit/dashboard-lanes.spec.ts
git commit -m "test(credit): add E2E coverage for dashboard role lanes"
```

---

## Verification Checklist

- [ ] No row anywhere renders the string "Unknown" for a borrower.
- [ ] The SLA column shows a real countdown, and "Due soon" can be non-zero.
- [ ] An RM's first screen names blockers, not state words, one action per row.
- [ ] An approver can approve, return, and decline without leaving `/credit`.
- [ ] Rejection reason codes remain mandatory on both the modal and the inline card.
- [ ] SOD exclusions remain visible with their reason and offer no decision control.
- [ ] Analytics widgets still render, in the manager lane.
- [ ] A multi-hat user can switch lanes and the choice persists.
- [ ] `PriorityWorkQueue` and `NextActionsPanel` are no longer both fed the same array.
- [ ] Selecting an attention count filters the lane in place rather than navigating away.
