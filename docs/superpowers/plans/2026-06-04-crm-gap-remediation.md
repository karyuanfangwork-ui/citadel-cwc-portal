# CRM Gap Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close every gap identified in `docs/2026-06-04-crm-production-readiness-audit.md` so the CRM is enterprise-ready: team-scoped RBAC, controlled stage transitions, account hierarchy, richer forecasting, rule-based lead scoring, and the remaining P2/P3 items.

**Architecture:** Backend is Express + Prisma (PostgreSQL). Changes are additive — new permission tier, new nullable columns, new service helpers — to avoid breaking the 123 existing endpoints. RBAC scoping is centralized in one reusable helper so every list endpoint shares one code path. Tests are Jest + ts-jest (`backend/src/__tests__/`), run with `npm test`.

**Tech Stack:** Node/Express/TypeScript, Prisma, Jest (ts-jest), React 19 + Vite frontend.

---

## Scope & Phasing

This plan covers multiple independent subsystems. Execute **phase by phase**; each phase produces working, shippable software and maps to an audit finding:

| Phase | Audit item | Priority | Ship gate |
|---|---|---|---|
| 1 | C1 — Team-scoped RBAC | P1 | Enterprise blocker |
| 2 | C2 — Stage-transition control | P1 | Enterprise blocker |
| 3 | H1 — Account parent-child hierarchy | P2 | 60-day |
| 4 | H2 — Forecast categories + accuracy | P2 | 60-day |
| 5 | H3 — Rule-based lead scoring | P2 | 60-day |
| 6 | H5 — Per-report CSV export | P2 | 60-day |
| 7 | H6 — Auto-assignment rules | P2 | 60-day |
| 8 | H4 + P3 — Multi-account contacts, tags, FX, field history, dup-block | P3 | 90-day |

**Recommendation:** treat Phases 3–8 as candidates for their own focused plans when you reach them. Phases 1–2 are fully detailed below (TDD, bite-sized). Phases 3–8 are specified as concrete task lists; expand a phase to full TDD steps immediately before executing it.

---

## Codebase facts this plan relies on (verified)

- Permissions seeded in `backend/prisma/seed.ts:250-253` (`crm:read`, `crm:write`, `crm:delete`, `crm:admin`). Role→permission map at `seed.ts:371-372` (`SALES_MANAGER` currently gets `crm:admin`; `SALES_REP` gets `crm:read`/`crm:write`).
- `requirePermission()` from `backend/src/middleware/auth.middleware.ts`; `req.user` carries `{ id, roles[], permissions[] }`.
- Ownership scoping today is inline in `backend/src/controllers/crm.controller.ts` (e.g. lines 57-63, 143-147, 245-251): `isAdmin ? all : where.ownerId = me`.
- `User.managerId` self-relation (`UserManager`) exists — `schema.prisma:63,89`. `CrmTerritoryMember` links users↔territories.
- Tests live in `backend/src/__tests__/`, Jest preset ts-jest, `setupFilesAfterEach` disconnects Prisma. Run a single file: `npm test -- crm-scope`.

---

# PHASE 1 — Team-Scoped RBAC (C1, P1)

**Outcome:** a new `crm:read:team` permission. Users holding it see records owned by **themselves + their direct/indirect reports + their territory members**, instead of only their own. `crm:admin` still sees all. `SALES_MANAGER` is switched from `crm:admin` to `crm:read:team`.

**Files:**
- Create: `backend/src/services/crm-scope.service.ts` — single source of truth for "which owner IDs may this user see".
- Create: `backend/src/__tests__/crm-scope.service.test.ts`
- Modify: `backend/src/controllers/crm.controller.ts` — replace each inline `isAdmin` block with the helper.
- Modify: `backend/prisma/seed.ts:250-253,371-372` — add permission, re-map `SALES_MANAGER`.

### Task 1.1: Visible-owner-IDs helper

**Files:**
- Create: `backend/src/services/crm-scope.service.ts`
- Test: `backend/src/__tests__/crm-scope.service.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// backend/src/__tests__/crm-scope.service.test.ts
import { resolveVisibleOwnerIds } from '../services/crm-scope.service';

const baseUser = (over: Partial<any> = {}) => ({
  id: 'u-me', roles: [], permissions: ['crm:read'], ...over,
});

describe('resolveVisibleOwnerIds', () => {
  it('returns null (no restriction) for crm:admin', async () => {
    const ids = await resolveVisibleOwnerIds(baseUser({ permissions: ['crm:admin'] }));
    expect(ids).toBeNull();
  });

  it('returns null for ADMIN role', async () => {
    const ids = await resolveVisibleOwnerIds(baseUser({ roles: ['ADMIN'] }));
    expect(ids).toBeNull();
  });

  it('returns only self for a plain crm:read user', async () => {
    const ids = await resolveVisibleOwnerIds(baseUser());
    expect(ids).toEqual(['u-me']);
  });

  it('returns self + reports + territory members for crm:read:team', async () => {
    const deps = {
      getReportIds: jest.fn().mockResolvedValue(['u-rep1', 'u-rep2']),
      getTerritoryPeerIds: jest.fn().mockResolvedValue(['u-rep2', 'u-terr3']),
    };
    const ids = await resolveVisibleOwnerIds(
      baseUser({ permissions: ['crm:read', 'crm:read:team'] }), deps,
    );
    expect(new Set(ids)).toEqual(new Set(['u-me', 'u-rep1', 'u-rep2', 'u-terr3']));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- crm-scope`
Expected: FAIL — `Cannot find module '../services/crm-scope.service'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// backend/src/services/crm-scope.service.ts
import prisma from '../utils/prisma';

export interface ScopeUser { id: string; roles: string[]; permissions: string[]; }

export interface ScopeDeps {
  getReportIds: (rootId: string) => Promise<string[]>;
  getTerritoryPeerIds: (userId: string) => Promise<string[]>;
}

// Recursively collect all reports under a manager (direct + indirect).
async function defaultGetReportIds(rootId: string): Promise<string[]> {
  const collected = new Set<string>();
  let frontier = [rootId];
  while (frontier.length) {
    const reports = await prisma.user.findMany({
      where: { managerId: { in: frontier } }, select: { id: true },
    });
    const next = reports.map((r) => r.id).filter((id) => !collected.has(id));
    next.forEach((id) => collected.add(id));
    frontier = next;
  }
  return [...collected];
}

async function defaultGetTerritoryPeerIds(userId: string): Promise<string[]> {
  const myTerritories = await prisma.crmTerritoryMember.findMany({
    where: { userId }, select: { territoryId: true },
  });
  if (!myTerritories.length) return [];
  const peers = await prisma.crmTerritoryMember.findMany({
    where: { territoryId: { in: myTerritories.map((t) => t.territoryId) } },
    select: { userId: true },
  });
  return peers.map((p) => p.userId);
}

/**
 * Returns the list of owner IDs a user may see, or `null` for unrestricted (admin).
 */
export async function resolveVisibleOwnerIds(
  user: ScopeUser,
  deps: ScopeDeps = {
    getReportIds: defaultGetReportIds,
    getTerritoryPeerIds: defaultGetTerritoryPeerIds,
  },
): Promise<string[] | null> {
  if (user.roles.includes('ADMIN') || user.permissions.includes('crm:admin')) {
    return null;
  }
  const ids = new Set<string>([user.id]);
  if (user.permissions.includes('crm:read:team')) {
    (await deps.getReportIds(user.id)).forEach((id) => ids.add(id));
    (await deps.getTerritoryPeerIds(user.id)).forEach((id) => ids.add(id));
  }
  return [...ids];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- crm-scope`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/crm-scope.service.ts backend/src/__tests__/crm-scope.service.test.ts
git commit -m "feat(crm): add resolveVisibleOwnerIds team-scope helper"
```

### Task 1.2: Apply helper to a `where` builder

**Files:**
- Modify: `backend/src/services/crm-scope.service.ts`
- Test: `backend/src/__tests__/crm-scope.service.test.ts`

- [ ] **Step 1: Add failing test for the where-clause builder**

```ts
// append to crm-scope.service.test.ts
import { applyOwnerScope } from '../services/crm-scope.service';

describe('applyOwnerScope', () => {
  it('adds no ownerId filter when ids is null (admin)', () => {
    expect(applyOwnerScope({ deletedAt: null }, null)).toEqual({ deletedAt: null });
  });
  it('adds ownerId in-filter when ids provided', () => {
    expect(applyOwnerScope({ deletedAt: null }, ['a', 'b']))
      .toEqual({ deletedAt: null, ownerId: { in: ['a', 'b'] } });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- crm-scope`
Expected: FAIL — `applyOwnerScope is not a function`.

- [ ] **Step 3: Implement**

```ts
// append to crm-scope.service.ts
export function applyOwnerScope<T extends Record<string, any>>(
  where: T, visibleOwnerIds: string[] | null,
): T {
  if (visibleOwnerIds === null) return where;
  return { ...where, ownerId: { in: visibleOwnerIds } };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- crm-scope`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/crm-scope.service.ts backend/src/__tests__/crm-scope.service.test.ts
git commit -m "feat(crm): add applyOwnerScope where-clause builder"
```

### Task 1.3: Wire helper into list controllers

**Files:**
- Modify: `backend/src/controllers/crm.controller.ts` (accounts ~57-63, contacts ~143-147, leads ~245-251, opportunities ~406, plus dashboard/my-stats owner filters)

- [ ] **Step 1: Replace each inline scope block.** For owner-bearing entities (accounts, leads, opportunities), replace:

```ts
const isAdmin = req.user!.roles.includes('ADMIN') || req.user!.permissions.includes('crm:admin');
if (!isAdmin) { where.ownerId = req.user!.id; } else if (ownerId) { where.ownerId = ownerId; }
```

with:

```ts
const visibleOwnerIds = await resolveVisibleOwnerIds(req.user!);
Object.assign(where, applyOwnerScope({}, visibleOwnerIds));
if (visibleOwnerIds === null && ownerId) where.ownerId = ownerId; // admin may filter to one owner
```

For contacts (scoped via parent account ownership), set `where.account = { ownerId: { in: visibleOwnerIds } }` when `visibleOwnerIds !== null`.

Add import at top of file:
```ts
import { resolveVisibleOwnerIds, applyOwnerScope } from '../services/crm-scope.service';
```

- [ ] **Step 2: Type-check**

Run: `cd backend && npm run build`
Expected: no TS errors.

- [ ] **Step 3: Manual smoke (documented, not automated here)**

Run dev server, log in as a `SALES_REP` and a `SALES_MANAGER`; confirm the manager sees reports' records and the rep sees only their own. Record result in PR description.

- [ ] **Step 4: Commit**

```bash
git add backend/src/controllers/crm.controller.ts
git commit -m "feat(crm): scope list endpoints via resolveVisibleOwnerIds (team visibility)"
```

### Task 1.4: Seed the new permission and re-map SALES_MANAGER

**Files:**
- Modify: `backend/prisma/seed.ts:250-253` (add permission), `:371-372` (role map)

- [ ] **Step 1: Add the permission definition** after the `crm:admin` line (`seed.ts:253`):

```ts
{ name: 'crm:read:team', resource: 'crm', action: 'read:team', description: 'View CRM records owned by self, direct/indirect reports, and territory peers' },
```

- [ ] **Step 2: Re-map SALES_MANAGER** at `seed.ts:371` — drop `crm:admin`, add team read:

```ts
SALES_MANAGER: ['crm:read', 'crm:read:team', 'crm:write', 'crm:delete'],
```

Also append `'crm:read:team'` to the ADMIN permission list at `seed.ts:319`.

- [ ] **Step 3: Re-seed and verify**

Run: `cd backend && npm run prisma:seed`
Expected: completes; query confirms `crm:read:team` exists and `SALES_MANAGER` no longer holds `crm:admin`.

- [ ] **Step 4: Commit**

```bash
git add backend/prisma/seed.ts
git commit -m "feat(crm): seed crm:read:team and re-map SALES_MANAGER off global admin"
```

**Phase 1 done when:** managers see team data without global access; reps unchanged; admins unchanged; `npm test -- crm-scope` green.

---

# PHASE 2 — Controlled Stage Transitions (C2, P1)

**Outcome:** `move-stage` enforces (a) required fields per stage, (b) optional forward-only progression, (c) approval gate for opportunities above a value threshold moving into a won stage.

**Files:**
- Modify: `backend/prisma/schema.prisma` — add `requiredFields String[]`, `requiresApproval Boolean`, `approvalThreshold Decimal?` to `CrmPipelineStage`; add `pendingStageApproval` fields to `CrmOpportunity`.
- Create: `backend/src/services/crm-stage-gate.service.ts`
- Create: `backend/src/__tests__/crm-stage-gate.service.test.ts`
- Modify: `backend/src/controllers/crm.controller.ts` (`moveStage` handler)

### Task 2.1: Schema — stage gate config

- [ ] **Step 1:** add to `model CrmPipelineStage` (after `isLostStage`):

```prisma
  requiredFields    String[] @default([]) @map("required_fields")
  enforceForwardOnly Boolean @default(false) @map("enforce_forward_only")
  requiresApproval  Boolean  @default(false) @map("requires_approval")
  approvalThreshold Decimal? @map("approval_threshold") @db.Decimal(15, 2)
```

- [ ] **Step 2:** migrate

Run: `cd backend && npx prisma migrate dev --name crm_stage_gates`
Expected: migration applied, client regenerated.

- [ ] **Step 3: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations
git commit -m "feat(crm): add stage-gate config columns to CrmPipelineStage"
```

### Task 2.2: Stage-gate validator service

**Files:**
- Create: `backend/src/services/crm-stage-gate.service.ts`
- Test: `backend/src/__tests__/crm-stage-gate.service.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { validateStageTransition } from '../services/crm-stage-gate.service';

const stage = (o: Partial<any> = {}) => ({
  displayOrder: 2, requiredFields: [], enforceForwardOnly: false,
  requiresApproval: false, approvalThreshold: null, isWonStage: false, ...o,
});
const opp = (o: Partial<any> = {}) => ({ value: 1000, expectedCloseDate: new Date(), description: 'x', ...o });

describe('validateStageTransition', () => {
  it('passes a clean forward move', () => {
    expect(validateStageTransition(opp(), stage({ displayOrder: 1 }), stage({ displayOrder: 2 })))
      .toEqual({ ok: true });
  });
  it('blocks backward move when forward-only enforced', () => {
    const r = validateStageTransition(opp(), stage({ displayOrder: 3 }), stage({ displayOrder: 2, enforceForwardOnly: true }));
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/forward/i);
  });
  it('blocks when a required field is empty', () => {
    const r = validateStageTransition(opp({ expectedCloseDate: null }), stage({ displayOrder: 1 }), stage({ displayOrder: 2, requiredFields: ['expectedCloseDate'] }));
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/expectedCloseDate/);
  });
  it('requires approval above threshold into target stage', () => {
    const r = validateStageTransition(opp({ value: 500000 }), stage({ displayOrder: 1 }), stage({ displayOrder: 2, requiresApproval: true, approvalThreshold: 100000 }));
    expect(r).toEqual({ ok: false, needsApproval: true, reason: expect.any(String) });
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (`Cannot find module`). Run: `npm test -- crm-stage-gate`

- [ ] **Step 3: Implement**

```ts
// backend/src/services/crm-stage-gate.service.ts
export interface StageGate {
  displayOrder: number; requiredFields: string[]; enforceForwardOnly: boolean;
  requiresApproval: boolean; approvalThreshold: number | null; isWonStage: boolean;
}
export interface TransitionResult { ok: boolean; needsApproval?: boolean; reason?: string; }

export function validateStageTransition(
  opp: Record<string, any>, from: StageGate, to: StageGate,
): TransitionResult {
  if (to.enforceForwardOnly && to.displayOrder < from.displayOrder) {
    return { ok: false, reason: 'This stage only allows forward progression.' };
  }
  for (const field of to.requiredFields) {
    const v = opp[field];
    if (v === null || v === undefined || v === '') {
      return { ok: false, reason: `Field "${field}" is required to enter this stage.` };
    }
  }
  if (to.requiresApproval && to.approvalThreshold != null && Number(opp.value) >= Number(to.approvalThreshold)) {
    return { ok: false, needsApproval: true, reason: `Deals ≥ ${to.approvalThreshold} require approval to enter this stage.` };
  }
  return { ok: true };
}
```

- [ ] **Step 4: Run — expect PASS.** Run: `npm test -- crm-stage-gate`

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/crm-stage-gate.service.ts backend/src/__tests__/crm-stage-gate.service.test.ts
git commit -m "feat(crm): add validateStageTransition stage-gate service"
```

### Task 2.3: Enforce in moveStage controller

**Files:**
- Modify: `backend/src/controllers/crm.controller.ts` (`moveStage`)

- [ ] **Step 1:** In `moveStage`, after loading the opportunity and target stage, load the current stage and call the validator:

```ts
import { validateStageTransition } from '../services/crm-stage-gate.service';
// ...
const result = validateStageTransition(opp, fromStage, toStage);
if (!result.ok) {
  return res.status(result.needsApproval ? 403 : 422).json({ error: result.reason, needsApproval: !!result.needsApproval });
}
```

Keep the existing `CrmOpportunityStageHistory` write on success.

- [ ] **Step 2: Build.** Run: `cd backend && npm run build` — expect no errors.

- [ ] **Step 3: Commit**

```bash
git add backend/src/controllers/crm.controller.ts
git commit -m "feat(crm): enforce stage gates on opportunity move-stage"
```

### Task 2.4: Frontend — surface gate errors

**Files:**
- Modify: `frontend/src/components/crm/StageDropdown.tsx` and `frontend/pages/CrmPipeline.tsx` (drag handler) — on 422/403, revert optimistic move and toast `error`/prompt for approval.

- [ ] **Step 1:** In the move-stage call sites, catch the rejected response, read `error`/`needsApproval`, revert the optimistic update, and show the message. (Pattern already used for optimistic revert in `CrmPipeline.tsx`.)

- [ ] **Step 2: Build.** Run: `cd frontend && npm run build` — expect success.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/crm/StageDropdown.tsx frontend/pages/CrmPipeline.tsx
git commit -m "feat(crm): surface stage-gate rejections in pipeline UI"
```

**Phase 2 done when:** moving a deal into a gated stage without required fields is blocked; backward moves blocked where configured; large deals into won stage prompt approval; `npm test -- crm-stage-gate` green.

---

# PHASE 3 — Account Parent-Child Hierarchy (H1, P2)

**Files:** `schema.prisma` (`CrmAccount`), `crm.controller.ts`, `crm.validator.ts`, `frontend/pages/CrmAccountDetail.tsx`.

- [ ] Add to `CrmAccount`: `parentAccountId String? @map("parent_account_id") @db.Uuid` + self-relation `parent`/`children`; index it. Migrate: `npx prisma migrate dev --name crm_account_hierarchy`.
- [ ] Add `parentAccountId` to `createAccountSchema`/`updateAccountSchema` (`crm.validator.ts`), with a cycle guard (an account cannot be its own ancestor) — write a unit test `crm-account-hierarchy.test.ts` for the cycle guard first (TDD).
- [ ] `getAccount` controller: include `parent` (id, name) and `children` (id, name). 
- [ ] `CrmAccountDetail.tsx`: render parent breadcrumb + children list; add a "parent account" picker in the edit form.
- [ ] Roll-up: extend `getAccount` to optionally aggregate child-account opportunity value (`?includeRollup=true`).
- [ ] Commit per task.

---

# PHASE 4 — Forecast Categories + Accuracy (H2, P2)

**Files:** `schema.prisma` (`CrmOpportunity`), `crm-reports.service.ts`, new `frontend` widget.

- [ ] Add `forecastCategory String @default("PIPELINE")` to `CrmOpportunity` (enum-as-string: `PIPELINE | BEST_CASE | COMMIT | OMITTED`). Migrate.
- [ ] Extend `getPipelineForecastReport` to group weighted value by `forecastCategory` alongside the existing stage breakdown. TDD: add cases to a new `crm-forecast.test.ts` asserting category sums.
- [ ] Add `getForecastAccuracyReport(period)`: compare a past period's COMMIT total vs. actual `wonAt` revenue in that window; return `accuracyPct`. TDD first.
- [ ] New endpoint `GET /reports/forecast-accuracy` (wire in `crm.routes.ts`, `requirePermission('crm:read')`).
- [ ] Frontend: add "Forecast Accuracy" + "Forecast by Category" widgets to `WidgetPicker`/`WidgetRenderer`.
- [ ] Commit per task.

---

# PHASE 5 — Rule-Based Lead Scoring (H3, P2)

**Files:** `schema.prisma` (new `CrmLeadScoringRule`), new `crm-lead-scoring.service.ts`, `crm-checker.ts` job, admin UI.

- [ ] New model `CrmLeadScoringRule { id, field, operator, value, points, isActive }`. Migrate.
- [ ] `crm-lead-scoring.service.ts:computeRuleScore(lead, rules)` — pure function summing points where rules match. TDD `crm-lead-scoring.test.ts` first (operators: equals, contains, gt, lt).
- [ ] Store result in a new `ruleScore Int?` column on `CrmLead` (distinct from `aiScore`); recompute on create/update and via a nightly job in `crm-checker.ts`.
- [ ] CRUD endpoints `/lead-scoring-rules` (`requirePermission('crm:admin')`).
- [ ] Admin UI page `CrmLeadScoringAdmin.tsx` to manage rules; show `ruleScore` badge in `LeadsTable.tsx`.
- [ ] Commit per task.

---

# PHASE 6 — Per-Report CSV Export (H5, P2)

**Files:** new `backend/src/utils/csv.ts`, `crm-reports.service.ts`, `crm.routes.ts`, report pages.

- [ ] `utils/csv.ts:toCsv(rows, columns)` — RFC-4180 quoting. TDD `csv.test.ts` first (commas, quotes, newlines).
- [ ] Add `?format=csv` to each `/reports/*` endpoint: when set, stream `text/csv` with `Content-Disposition: attachment`.
- [ ] `CrmReports.tsx`: add an "Export CSV" button per report that hits the endpoint with `format=csv`.
- [ ] Commit per task.

---

# PHASE 7 — Auto-Assignment Rules (H6, P2)

**Files:** new `CrmAssignmentRule` model, `crm-automation.service.ts`, lead-create controller path.

- [ ] New model `CrmAssignmentRule { id, territoryId?, sourceMatch?, roundRobin Boolean, isActive, priority }`. Migrate.
- [ ] `assignLeadOwner(lead, rules, lastAssignedIndex)` pure function: pick owner by first matching rule; round-robin across that territory's members. TDD `crm-assignment.test.ts` first.
- [ ] In `createLead` controller, when `autoAssign` is true and no `ownerId` given, call the resolver instead of defaulting to the creator.
- [ ] Admin CRUD `/assignment-rules` (`crm:admin`).
- [ ] Commit per task.

---

# PHASE 8 — P3 Cluster (H4 + remaining)

Each is independently shippable; expand to TDD steps before executing.

- [ ] **Multi-account contacts (H4):** new join model `CrmContactAccountRole { contactId, accountId, role }`; keep `CrmContact.accountId` as the primary account for back-compat; surface "also associated with" in `CrmContactDetail.tsx`.
- [ ] **Tags/segments:** new `CrmTag` + polymorphic `CrmTagAssignment`; filter chips on list views.
- [ ] **Field-level history:** persist a `CrmFieldChange { entityType, entityId, field, oldValue, newValue, changedBy, at }` row per changed field in update controllers (derive diff from existing `oldValues`/`newValues`); render in `CrmAuditLog.tsx`.
- [ ] **FX normalization:** add a `fxRateToBase` snapshot on opportunities + a base-currency config; convert in report roll-ups. TDD the conversion helper.
- [ ] **Duplicate-block-on-create:** call `crm-duplicate.service` scoring in `createLead`/`createContact`; if score above a configurable threshold, return `409` with the candidate match unless `?force=true`.

---

## Cross-Cutting Done Criteria

- [ ] `npm test` green in `backend/`.
- [ ] `npm run build` green in both `backend/` and `frontend/`.
- [ ] `docs/2026-06-04-crm-production-readiness-audit.md` scorecard updated (Security/RBAC ≥ 8, Reporting ≥ 8) once Phases 1–6 land.
- [ ] No endpoint regressions: existing 123 routes still respond (spot-check list endpoints as each scoped controller changes).

## Self-Review Notes

- Spec coverage: C1→P1, C2→P2, H1→P3, H2→P4, H3→P5, H4→P8, H5→P6, H6→P7, P3-cluster→P8. All audit items mapped.
- Naming consistency: `resolveVisibleOwnerIds`/`applyOwnerScope` (P1), `validateStageTransition` (P2) used identically wherever referenced.
- Additive-only schema changes (new nullable columns / new models) — no destructive migrations, protecting the 123 live endpoints.
