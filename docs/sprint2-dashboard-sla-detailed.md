# Sprint 2 — Dashboard My-Work & SLA: Detailed Implementation Plan

**Parent:** 2026-06-09-credit-audit-implementation-plan.md
**Sprint:** 2 of 8
**Estimate:** 8 dev-days (4 BE + 4 FE)
**Prerequisite:** Sprint 1 complete (REFERRED_BACK state, DisbursementTab state-gating)

---

## 2.1 Dashboard "My Work" Tab (CRITICAL — Finding #3)

### Problem

Dashboard shows organization-wide pipeline only. Users must mentally filter to find their own work. No "My Work" view showing pending approvals, assigned cases, and SLA breaches relevant to the current user.

### Current State

- **CreditDashboard.tsx (line 129):** 4 tabs — `pipeline`, `approval`, `exposure`, `calendar`. Default is `pipeline`.
- **Dashboard API:** `dashboardApi.getPipelineDashboard()` returns aggregate state counts across ALL applications with `slaBreachCount`.
- **Approval inbox** already filters by current user via `req.user.id`.
- **Pipeline endpoint** has NO user filter — returns org-wide stats.
- **Application model** has `assignedRmId` and `assignedAnalystId` (both indexed).

### Implementation Steps

#### BE Step 1: Add `assignedToMe` filter to pipeline endpoint

**File:** `backend/src/credit/services/dashboard.service.ts`

Add optional `assignedToMe?: string` parameter to `getPipelineDashboard()`. When provided, add Prisma `where` clause:

```ts
// In getPipelineDashboard(query) — add to existing where clause
if (query.assignedToMe) {
  whereCondition.OR = [
    { assignedRmId: query.assignedToMe },
    { assignedAnalystId: query.assignedToMe },
  ];
}
```

This filters ALL application counts (by-state, SLA breach, total) to only those where the user is RM or analyst.

**File:** `backend/src/credit/controllers/dashboard.controller.ts`

Pass `req.user.id` as `assignedToMe` when a query param `?assignedToMe=true` is present:

```ts
const assignedToMe = req.query.assignedToMe === 'true' ? req.user!.id : undefined;
const result = await dashboardService.getPipelineDashboard({ ...query, assignedToMe });
```

**File:** `backend/src/credit/validators/dashboard.validator.ts`

Add `assignedToMe: z.optional(z.enum(['true', 'false']))` to the pipeline query schema.

#### BE Step 2: Add My Work summary endpoint

**File:** `backend/src/credit/services/dashboard.service.ts`

New method `getMyWorkDashboard(userId: string, branchId?: string)`:

```ts
async getMyWorkDashboard(userId: string, branchId?: string) {
  const [myApprovals, myAssigned, myBreaches] = await Promise.all([
    // Pending approvals where user is in the approval chain
    this.prisma.approvalAction.findMany({
      where: { action: null, application: { state: 'COMMITTEE_REVIEW' } },
      // Filter: applications where user's tier hasn't decided yet
    }),
    // My assigned cases (RM or Analyst)
    this.prisma.creditApplication.findMany({
      where: {
        deletedAt: null,
        OR: [{ assignedRmId: userId }, { assignedAnalystId: userId }],
        state: { notIn: ['CLOSED', 'WITHDRAWN'] },
        ...(branchId ? { branchId } : {}),
      },
      select: { id: true, applicationNo: true, state: true, borrowerProfile: { select: { name: true, account: { select: { name: true } }, contact: { select: { firstName: true, lastName: true } } } }, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    }),
    // My SLA breaches (reuses existing credit SLA service)
    this.prisma.creditSlaBreach.findMany({
      where: { resolvedAt: null, application: { OR: [{ assignedRmId: userId }, { assignedAnalystId: userId }] } },
      include: { application: { select: { id: true, applicationNo: true, state: true } }, policy: { select: { name: true } } },
    }),
  ]);

  return {
    myApprovalCount: myApprovals.length,
    myAssignedCount: myAssigned.length,
    mySlaBreaches: myBreaches.length,
    recentAssigned: myAssigned,
    recentApprovals: myApprovals,
    recentBreaches: myBreaches,
  };
}
```

**File:** `backend/src/credit/routes/dashboard.routes.ts`

Add: `router.get('/my-work', authenticate, requirePermission('credit:read'), dashboardController.getMyWork);`

#### FE Step 3: Add "My Work" tab as default

**File:** `frontend/pages/credit/CreditDashboard.tsx`

1. Add `myWork` to `TabKey` type as first tab
2. Change `useState<TabKey>('pipeline')` → `useState<TabKey>('myWork')`
3. Add `dashboardApi.getMyWorkDashboard()` method to `credit.service.ts`
4. Add My Work tab UI:

```tsx
// My Work tab content
{activeTab === 'myWork' && (
  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
    <MyWorkCard icon="approval" label="Pending Approvals" count={myWorkData.myApprovalCount} color="amber" />
    <MyWorkCard icon="assignment_ind" label="My Cases" count={myWorkData.myAssignedCount} color="blue" />
    <MyWorkCard icon="schedule" label="SLA Breaches" count={myWorkData.mySlaBreaches} color="red" />
  </div>
  // Recent assigned cases list
  <div className="...">
    {myWorkData.recentAssigned.map(app => <MyWorkRow key={app.id} app={app} />)}
  </div>
)}
```

5. Tab bar: `[My Work] [Pipeline] [Approval Inbox] [Exposure] [Committee]`

### Pitfalls

- `myApprovalCount` must check the user's tier in the approval chain, not just `COMMITTEE_REVIEW` state. Use the existing `approvalAction` query pattern from `getApprovalInbox()`.
- My Work tab data must auto-refresh on tab switch (use `useEffect` keyed on `activeTab`).
- When `assignedRmId`/`assignedAnalystId` are null, those applications won't appear in anyone's My Work — only in Pipeline. This is by design.

### Verification

1. Login as RM user → My Work tab should show their assigned cases
2. Login as admin → My Work tab should show pending approvals + assigned cases
3. Switch to Pipeline tab → org-wide stats should still load normally

---

## 2.2 SLA Breach Itemized Widget (HIGH — Finding #9)

### Problem

`slaBreachCount` is a flat number. No way to see which specific applications are in breach, their details, or drill down.

### Current State

- **Dashboard:** Renders `slaBreachCount` as red/green number (lines 268–273 of CreditDashboard.tsx)
- **Dashboard service:** Computes breach count from hardcoded `SLA_DAYS_BY_STATE` dict vs `updatedAt` — **NOT from `CreditSlaBreach` table**
- **Credit SLA service** (`creditSla.service.ts`): Has `getAllActiveBreaches()` returning rich `CreditSlaBreach[]` data
- **SLA API endpoints:**
  - `GET /credit/sla/breaches` — all active breaches (unresolved)
  - `GET /credit/sla/breaches/:applicationId` — per-app breaches
  - No per-application "time remaining" endpoint

### Implementation Steps

#### BE Step 1: Add SLA breach list to pipeline dashboard response

**File:** `backend/src/credit/services/dashboard.service.ts`

In `getPipelineDashboard()`, add a `slaBreaches` array alongside `slaBreachCount`:

```ts
// After existing aggregation logic, add:
const activeBreaches = await this.prisma.creditSlaBreach.findMany({
  where: { resolvedAt: null },
  include: {
    application: {
      select: { id: true, applicationNo: true, state: true,
        borrowerProfile: { select: { name: true, account: { select: { name: true } }, contact: { select: { firstName: true, lastName: true } } } }
      }
    },
    policy: { select: { name: true, targetState: true } },
  },
  orderBy: { breachedAt: 'asc' },
});

return {
  states: /* existing */,
  totalApplications: /* existing */,
  slaBreachCount: /* existing */,
  slaBreaches: activeBreaches.map(b => ({
    id: b.id,
    applicationId: b.application.id,
    applicationNo: b.application.applicationNo,
    borrowerName: b.application.borrowerProfile?.account?.name
      || b.application.borrowerProfile?.contact
        ? `${b.application.borrowerProfile.contact!.firstName} ${b.application.borrowerProfile.contact!.lastName}`
      : b.application.borrowerProfile?.name || 'Unknown',
    currentState: b.application.state,
    breachedAt: b.breachedAt,
    daysOverdue: Math.floor((Date.now() - new Date(b.breachedAt).getTime()) / 86400000),
    policyName: b.policy.name,
  })),
};
```

This replaces the stale hardcoded breach count with authoritative data from the `CreditSlaBreach` table.

#### FE Step 2: Add `SlaBreachWidget` component

**New file:** `frontend/src/components/credit/SlaBreachWidget.tsx`

```tsx
interface SlaBreachWidgetProps {
  breaches: SlaBreachItem[];
  totalCount: number;
  filterMode: 'all' | 'mine';
}

const SlaBreachWidget: React.FC<SlaBreachWidgetProps> = ({ breaches, totalCount, filterMode }) => {
  const [expanded, setExpanded] = useState(false);
  // Show count badge that expands on click
  // List: App No | Borrower | State | Days Overdue | SLA Policy
  // Each row links to /credit/applications/:id
  // Toggle: All / My breaches only
};
```

Key UI elements:
- Clickable count badge: red circle with count, expands on click
- Sortable table: applicationNo, borrowerName, currentState, daysOverdue, policyName
- Each row → `Link to={/credit/applications/${id}}`
- Filter toggle: "All breached" / "My cases only"
- Empty state: "No SLA breaches" with green check

#### FE Step 3: Replace flat `slaBreachCount` with `SlaBreachWidget`

**File:** `frontend/pages/credit/CreditDashboard.tsx`

Replace the existing SLA breach card (lines 268–273):

```tsx
// BEFORE:
<p className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">SLA Breaches</p>
<p className={`text-2xl font-black ${data.slaBreachCount > 0 ? 'text-red-600' : 'text-green-600'}`}>
  {data.slaBreachCount}
</p>

// AFTER:
<SlaBreachWidget
  breaches={data.slaBreaches}
  totalCount={data.slaBreachCount}
  filterMode={activeTab === 'myWork' ? 'mine' : 'all'}
/>
```

#### BE Step 4: Add `myBreaches` filter to SLA breaches endpoint

**File:** `backend/src/credit/controllers/creditSla.controller.ts`

Add `?assignedToMe=true` query param to `GET /credit/sla/breaches` that filters to breaches on applications where the user is RM or analyst.

### Pitfalls

- **Two SLA systems:** The dashboard computed `slaBreachCount` from `SLA_DAYS_BY_STATE` hardcoded dict, while `CreditSlaBreach` is policy-based. The plan replaces the hardcoded count with the authoritative `CreditSlaBreach` data. After this change, `slaBreachCount` should equal `slaBreaches.length`.
- **Stale data:** `CreditSlaBreach` records are created by a 15-min cron job. The count may be up to 15 minutes stale. Show a "Last checked" timestamp.
- **Performance:** With many applications, `findMany` on `CreditSlaBreach` with joins could be slow. Add a `take: 50` limit and pagination if needed.

### Verification

1. Navigate to dashboard → SLA breach count should be clickable
2. Click → expand to see list of breached applications with names, states, overdue days
3. Each row links to application detail
4. Switch to My Work tab → SLA breaches filter to user's own cases
5. Create a test breach (manually or via cron) → verify it appears

---

## 2.3 Duplicate Borrower Detection Enforcement (HIGH — Finding #15)

### Problem

`checkDuplicate()` is an advisory GET endpoint that frontend calls on-blur during creation. But there's **no server-side enforcement** — the `POST /credit/borrowers` endpoint doesn't check for duplicates at all. Race conditions or UI bypass can create duplicate borrowers.

### Current State

- **Backend:** `borrowerProfile.service.ts` `createBorrowerProfile()` — no duplicate check
- **Frontend:** `NewBorrowerWizard.tsx` — calls `checkDuplicate` on-blur, blocks Step 1 if duplicate found, but `handleSubmit` has no 409 handling
- **`checkDuplicate()`** — only checks CRM-linked entities (account `registrationNumber` / contact `nricPassport`), not bare-named borrowers

### Implementation Steps

#### BE Step 1: Add server-side duplicate check in `createBorrowerProfile()`

**File:** `backend/src/credit/services/borrowerProfile.service.ts`

Before the `prisma.borrowerProfile.create()` call, add:

```ts
// In createBorrowerProfile(), before the Prisma create call:
const duplicateCheck = await this.checkDuplicateEnhanced({
  ssm: data.ssmRegistrationNumber,
  nric: data.nricPassport,
  name: data.name,
  borrowerType: data.borrowerType,
});

if (duplicateCheck.duplicates.length > 0) {
  throw new AppError('Duplicate borrower detected', 409, { duplicates: duplicateCheck.duplicates });
}
```

#### BE Step 2: Create enhanced `checkDuplicateEnhanced()` method

**File:** `backend/src/credit/services/borrowerProfile.service.ts`

Add a new method that checks more than the existing `checkDuplicate()`:

```ts
async checkDuplicateEnhanced(params: { ssm?: string | null; nric?: string | null; name?: string; borrowerType?: string }) {
  const duplicates: Array<{ borrowerId: string; name: string; borrowerType: string; matchField: string }> = [];

  // 1. Check by SSM (corporate/sole proprietor)
  if (params.ssm) {
    const bySsm = await this.prisma.borrowerProfile.findMany({
      where: { ssmRegistrationNumber: params.ssm, deletedAt: null },
      select: { id: true, name: true, borrowerType: true },
    });
    for (const d of bySsm) {
      duplicates.push({ borrowerId: d.id, name: d.name || 'Unknown', borrowerType: d.borrowerType, matchField: 'SSM Registration Number' });
    }
  }

  // 2. Check by NRIC (individual)
  if (params.nric) {
    const byNric = await this.prisma.crmContact.findMany({
      where: { nricPassport: params.nric, borrowerProfile: { isNot: null } },
      select: { id: true, firstName: true, lastName: true, borrowerProfile: { select: { id: true, name: true, borrowerType: true } } },
    });
    for (const c of byNric) {
      if (c.borrowerProfile) {
        duplicates.push({ borrowerId: c.borrowerProfile.id, name: c.borrowerProfile.name || `${c.firstName} ${c.lastName}`, borrowerType: c.borrowerProfile.borrowerType, matchField: 'NRIC/Passport' });
      }
    }
  }

  // 3. Check by name + type (catches manual duplicates)
  if (params.name && params.borrowerType) {
    const byName = await this.prisma.borrowerProfile.findMany({
      where: { name: { equals: params.name, mode: 'insensitive' }, borrowerType: params.borrowerType, deletedAt: null },
      select: { id: true, name: true, borrowerType: true },
      take: 5,
    });
    for (const d of byName) {
      if (!duplicates.some dup => dup.borrowerId === d.id)) {
        duplicates.push({ borrowerId: d.id, name: d.name || 'Unknown', borrowerType: d.borrowerType, matchField: 'Name' });
      }
    }
  }

  // Deduplicate by borrowerId
  const seen = new Set<string>();
  const unique = duplicates.filter(d => {
    if (seen.has(d.borrowerId)) return false;
    seen.add(d.borrowerId);
    return true;
  });

  return { duplicates: unique };
}
```

#### BE Step 3: Add admin override parameter

**File:** `backend/src/credit/controllers/borrowerProfile.controller.ts`

In the `create` method, check for `req.body.overrideDuplicate`:

```ts
create = asyncHandler(async (req, res) => {
  try {
    const profile = await borrowerProfileService.createBorrowerProfile(req.body);
    res.status(201).json({ status: 'success', data: { profile } });
  } catch (err) {
    if (err instanceof AppError && err.statusCode === 409) {
      // Duplicate detected — return conflict with details
      res.status(409).json({ status: 'conflict', data: err.data });
      return;
    }
    throw err;
  }
});
```

Add `overrideDuplicate: z.optional(z.boolean())` to `createBorrowerProfileSchema` in the validator. When `overrideDuplicate === true` AND `req.user` has `credit:admin` permission, skip the duplicate check.

#### FE Step 4: Handle 409 in NewBorrowerWizard

**File:** `frontend/src/components/credit/NewBorrowerWizard.tsx`

In `handleSubmit`, add 409 handling:

```tsx
// In the catch block of handleSubmit:
} catch (err: any) {
  if (err.response?.status === 409) {
    setDuplicateConflict(err.response.data?.duplicates || []);
    setShowConflictModal(true);
    return;
  }
  // ... existing error handling
}
```

Add state and modal:

```tsx
const [duplicateConflict, setDuplicateConflict] = useState<DuplicateMatch[]>([]);
const [showConflictModal, setShowConflictModal] = useState(false);
const canOverride = hasPermission(user, 'credit:admin');
```

Conflict modal UI:
- Title: "Duplicate Borrower Detected"
- Table listing duplicates: Name, Type, Match Field
- Each row has "View" button → navigates to borrower detail
- Two action buttons:
  - "Cancel" → closes modal, stays on form
  - "Create Anyway (Admin Override)" → re-submits with `overrideDuplicate: true`, only enabled if `canOverride`

#### BE Step 5: Add audit logging for override

**File:** `backend/src/credit/services/borrowerProfile.service.ts`

When `overrideDuplicate === true`, log:

```ts
await this.prisma.auditLog.create({
  data: {
    action: 'BORROWER_DUPLICATE_OVERRIDE',
    userId: overrideUserId,
    entityType: 'BorrowerProfile',
    entityId: newProfile.id,
    details: { duplicateIds: duplicates.map(d => d.borrowerId), matchFields: duplicates.map(d => d.matchField) },
  },
});
```

### Pitfalls

- **Case sensitivity:** Name check uses `mode: 'insensitive'` to catch "John DOE" vs "john doe".
- **NRIC uniqueness is complicated by `NULL` values:** Don't add a Prisma `@@unique` constraint on `nricPassport` — there are likely existing `NULL` values. The application-level check is sufficient for now.
- **Race condition:** Two admins could both click "Create Anyway" simultaneously. Add a short DB-level advisory lock or accept the tiny risk — this is a rare edge case for admin override.
- **Performance:** `findMany` with `name` insentive search + joins could be slow at scale. Add a `take: 5` limit.

### Verification

1. Create a borrower with the same SSM as an existing one → client-side check shows warning → submit anyway → 409 returned → conflict modal shows duplicates
2. As admin, click "Create Anyway" → borrower created, audit log entry written
3. As non-admin, "Create Anyway" button is disabled
4. Create a borrower with no CRM link but same name+type → name-based duplicate detection catches it

---

## Execution Order

| Day | Task | Files |
|-----|------|-------|
| 1 | BE: Add `assignedToMe` filter to pipeline + My Work endpoint | dashboard.service.ts, dashboard.controller.ts, dashboard.validator.ts, dashboard.routes.ts |
| 2 | FE: My Work tab UI + API integration | CreditDashboard.tsx, credit.service.ts |
| 3 | BE: Add `slaBreaches` to pipeline response + My Breaches filter | dashboard.service.ts, creditSla.controller.ts |
| 4 | FE: SlaBreachWidget component + dashboard integration | SlaBreachWidget.tsx, CreditDashboard.tsx |
| 5 | BE: Enhanced duplicate check + 409 response + admin override | borrowerProfile.service.ts, borrowerProfile.controller.ts, borrowerProfile.validator.ts |
| 6 | FE: Conflict modal in NewBorrowerWizard | NewBorrowerWizard.tsx |
| 7 | BE: Audit logging for override + integration test | borrowerProfile.service.ts |
| 8 | QA: End-to-end testing of all three features | — |

---

## Dependencies

- Sprint 1 must be complete (REFERRED_BACK state, DisbursementTab state-gating)
- `prisma db push` must have been run after Sprint 1 schema changes
- Backend dev server needs restart after Prisma client regeneration

## Key Decisions

1. **My Work is default tab** — users see their own work first, Pipeline second
2. **SLA breach count replaced with itemized widget** — the hardcoded `SLA_DAYS_BY_STATE` dict in `dashboard.service.ts` is replaced by `CreditSlaBreach` table queries
3. **Duplicate check is application-level only** — no `@@unique` DB constraint due to nullable fields with existing NULL data
4. **Admin override requires `credit:admin`** — not just `credit:create`, preventing regular users from bypassing
5. **My Breaches filter uses `OR: [assignedRmId, assignedAnalystId]`** — same pattern as approval inbox