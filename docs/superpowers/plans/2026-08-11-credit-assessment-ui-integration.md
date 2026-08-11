# Credit Assessment UI Integration Implementation Plan

> **Execution note:** Follow this plan task-by-task with test-driven changes and a review checkpoint after each release slice. Do not replace the shared CWC shell or bypass existing Credit permissions.

**Goal:** Incorporate the approved Credit module shell, role-aware landing dashboard, Borrower List, and controlled Create Borrower journey into the existing CWC 2.0 React/Express/Prisma system as independently deployable vertical slices.

**Architecture:** Retain the existing `AppShell` as the portal-wide shell and `CreditLayout`/`CreditNav` as Credit's module-level navigation. Extend existing Credit services and pages rather than introducing a parallel application. Add the missing borrower operational data and a governed duplicate-exception lifecycle to PostgreSQL, expose additive `/api/v1/credit` contracts, and migrate the existing frontend behind permission-aware components.

**Stack:** React 19, TypeScript, React Router 7, Tailwind CSS 4, Axios, Express, Zod, Prisma, PostgreSQL, Jest, Vitest, Playwright.

**Approved design sources:**

- `docs/superpowers/specs/2026-08-11-credit-borrower-list-ui-design.md`
- `docs/design-assets/credit-assessment/credit-dashboard-credit-officer.png`
- `docs/design-assets/credit-assessment/borrower-list-shared-cwc-shell-v2.png`
- `docs/design-assets/credit-assessment/create-borrower-identity-check-exact-match.png`
- `docs/design-assets/credit-assessment/duplicate-override-justification-modal.png`
- `docs/design-assets/credit-assessment/create-borrower-step2-individual-details.png`

---

## 1. Scope, decisions, and non-goals

### In scope

1. Shared navigation alignment for ESM, CRM, and Credit.
2. `/credit` role-aware landing dashboard, beginning with Credit Officer.
3. Production Borrower List with search, filters, stable borrower number, owner, active application count, exposure, masking, and pagination.
4. Mandatory borrower identity check.
5. Governed exact-duplicate exception request and approval.
6. Six-stage borrower creation journey, reusing the existing form components and services.
7. Backend, frontend, RBAC, audit, migration, accessibility, and rollout tests.

### Explicit decisions

- The global left rail remains shared. Credit destinations do not get copied into the global rail.
- Clicking the global `Credit` item lands on `/credit`; the dashboard is the first Credit screen.
- `CreditNav` remains the internal horizontal module navigation.
- `Create Borrower` is rendered only when the user has `credit:create`.
- Credit Reviewers and Managers can search and view borrowers; their create controls remain hidden unless their actual permissions include `credit:create`.
- An exact NRIC/registration match cannot be self-overridden by a Credit Officer. The officer requests an exception; a Credit Manager/Approver with `credit:approve` approves or rejects it under segregation of duties. Existing `credit:admin` direct override remains available for controlled break-glass use.
- The existing `BorrowerType` is not relabelled destructively. Add a separate operational `BorrowerSegment` (`INDIVIDUAL`, `SME`, `CORPORATE`) because the existing enum represents party/legal structures (`INDIVIDUAL`, `CORPORATE`, `JOINT`, `SOLE_PROPRIETOR`).
- Existing post-create KYC, income, and document calls are retained, but the UI stages are consolidated: Borrower Type moves into Identity Check and Documents moves into KYC & Compliance.
- Full NRIC/passport values are never returned by the list API. Search accepts identity input, but results contain masked identifiers only.

### Non-goals for this plan

- Borrower 360 redesign.
- Application 360 redesign.
- New scoring, risk rating, approval matrix, or financial calculation engines.
- Replacing the global TopBar, notification system, or portal search.
- Changing existing application workflow states.

---

## 2. Release slices and gates

| Slice | Deliverable | Release gate |
|---|---|---|
| A | Shared module navigation and Credit landing semantics | Existing ESM/CRM/Credit routes remain reachable and permission-correct |
| B | Role-aware Credit Officer dashboard | Dashboard API and UI tests; no manager metrics exposed to officers |
| C | Borrower data foundation and Borrower List | Migration/backfill verified; query performance and PII masking tests pass |
| D | Identity Check and duplicate exception governance | Server-authoritative exception tests and immutable audit events pass |
| E | Six-stage Create Borrower journey | Individual, SME, and Corporate creation journeys pass end-to-end |
| F | Accessibility, observability, and staged rollout | Build, regression, Playwright, audit-chain, and operational checks pass |

Do not start Slice D frontend work until the duplicate governance API in Slice D is passing. Do not switch all users to the new Borrower List until the borrower number/segment backfill report has zero unresolved records.

---

## Task 1: Lock contracts and add shared Credit UI vocabulary

**Files:**

- Create: `frontend/src/types/credit-ui.types.ts`
- Create: `frontend/src/lib/credit/statusPresentation.ts`
- Create: `frontend/src/lib/credit/formatters.ts`
- Create: `frontend/src/lib/credit/__tests__/statusPresentation.test.ts`
- Create: `frontend/src/lib/credit/__tests__/formatters.test.ts`
- Modify: `frontend/src/services/credit.service.ts`

### Step 1: Write failing presentation tests

Test every required application status for a visible label and icon, and verify Malaysian formatting:

```ts
expect(getApplicationStatusPresentation('RETURNED_FOR_REVISION')).toMatchObject({
  label: 'Returned for Revision',
  icon: expect.any(String),
  tone: 'warning',
});
expect(formatMyr(1250000)).toBe('RM 1,250,000');
expect(formatRatio(1.58)).toBe('1.58x');
expect(formatPercent(42)).toBe('42%');
```

Run:

```bash
cd frontend && npm test -- src/lib/credit/__tests__/statusPresentation.test.ts src/lib/credit/__tests__/formatters.test.ts
```

Expected: FAIL because the modules do not exist.

### Step 2: Define API-facing UI contracts

Add explicit contracts; do not use `any` for new responses:

```ts
export type BorrowerSegment = 'INDIVIDUAL' | 'SME' | 'CORPORATE';
export type BorrowerLifecycleStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';

export interface BorrowerListItem {
  id: string;
  borrowerNumber: string;
  name: string;
  segment: BorrowerSegment;
  legalType: 'INDIVIDUAL' | 'CORPORATE' | 'JOINT' | 'SOLE_PROPRIETOR';
  maskedIdentifier: string | null;
  primaryContact: string | null;
  relationshipOwner: { id: string; name: string } | null;
  activeApplicationCount: number;
  totalExposure: number;
  status: BorrowerLifecycleStatus;
  updatedAt: string;
}
```

Also define `BorrowerListQuery`, `BorrowerListResponse`, `BorrowerStatsResponse`, `DuplicateIdentityResult`, `DuplicateExceptionRequest`, and dashboard view models in this file.

Define the origination display-status adapter explicitly. It does not overwrite `ApplicationState`:

| Stored state/readiness | Origination display status |
|---|---|
| `DRAFT`, incomplete | Draft |
| `DRAFT`, assessment prerequisites complete | Ready for Assessment |
| `DRAFT`, submission checklist complete | Ready for Submission |
| `SUBMITTED` | Submitted |
| `KYC_REVIEW` | Under Review |
| `COMPLIANCE_HOLD` | Information Required |
| `KYC_APPROVED` | Ready for Assessment |
| `KYC_REJECTED` or `REFERRED_BACK` | Returned for Revision |
| `UNDERWRITING` or `CREDIT_ASSESSMENT` | Under Assessment |
| `COMMITTEE_REVIEW` | Pending Approval |
| `APPROVED`, `CONDITION_FULFILMENT`, `OFFER`, `ACCEPTED`, `DISBURSED`, or `ACTIVE` | Approved, with the granular lifecycle state shown separately where operationally relevant |
| `REJECTED` | Declined |
| `WITHDRAWN` | Cancelled |
| `CLOSED` | Closed; servicing closure is not mislabelled as a credit decision |

`Information Required`, `Ready for Assessment`, and `Ready for Submission` may therefore be derived from readiness/blocker data while the application is still stored as `DRAFT`. Badges always include text and icon; downstream servicing pages retain their granular stored-state labels.

### Step 3: Implement the shared formatters and status presentation

Use `Intl.NumberFormat('en-MY')`, tabular-compatible output, explicit labels, icons, and semantic tones. The display map may translate current backend workflow states into the approved UI language, but it must not mutate stored `ApplicationState` values.

### Step 4: Update `credit.service.ts`

Add typed methods without removing existing ones:

```ts
listBorrowers(query: BorrowerListQuery): Promise<BorrowerListResponse>
getBorrowerOperationalStats(): Promise<BorrowerStatsResponse>
checkBorrowerIdentity(input: IdentityCheckInput): Promise<DuplicateIdentityResult>
requestDuplicateException(input: DuplicateExceptionInput): Promise<DuplicateExceptionRequest>
getDuplicateException(id: string): Promise<DuplicateExceptionRequest>
decideDuplicateException(id: string, input: DuplicateExceptionDecision): Promise<DuplicateExceptionRequest>
```

### Step 5: Run and commit

```bash
cd frontend && npm test -- src/lib/credit/__tests__/statusPresentation.test.ts src/lib/credit/__tests__/formatters.test.ts
cd frontend && npm run build
git add -- frontend/src/types/credit-ui.types.ts frontend/src/lib/credit frontend/src/services/credit.service.ts
git commit -m "feat(credit): add shared UI contracts and formatters"
```

---

## Task 2: Align the shared portal navigation

**Files:**

- Modify: `frontend/src/components/layout/navConfig.ts`
- Modify: `frontend/src/components/layout/LeftRail.tsx`
- Modify: `frontend/src/components/CreditNav.tsx`
- Modify: `frontend/App.tsx`
- Create: `frontend/src/components/layout/__tests__/navConfig.test.ts`
- Create: `frontend/src/components/__tests__/CreditNav.test.tsx`

### Step 1: Write permission matrix tests

Cover these cases:

```ts
it('shows ESM, CRM and Credit as shared destinations when authorised');
it('hides Credit without credit:read');
it('does not put Borrower List or Create Borrower in the global rail');
it('hides Credit administration from a normal officer');
it('shows My Approvals only with credit:approve');
it('marks Credit active for every /credit/* route');
```

### Step 2: Correct the shared destinations

Add `/esm` to the shared navigation, using the actual feature/permission rule for Executive Services. Keep `/crm` and `/credit` in the same global modules/tools tier. Do not add a second Credit-only sidebar.

Expected global information architecture:

```text
Shared portal rail
├── Main
├── Service Desks
├── Modules / Tools
│   ├── ESM (when authorised/enabled)
│   ├── CRM (crm:read)
│   └── Credit (credit:read)
└── Administration (permission-aware)
```

If Executive Services is a service-desk destination rather than a module in the business terminology, keep it in `service-desks`; the key acceptance criterion is that it is visible alongside the other shared portal destinations, not nested inside Credit.

### Step 3: Refine `CreditNav`

Keep the existing responsive overflow behavior. Use the following permission rules:

- Dashboard, Borrowers, Applications, Group Exposure, Analysis, Spreading, Collateral, Reports: `credit:read`
- My Approvals: `credit:approve`
- Scorecards and future configuration items: `credit:admin`

Add accessible `aria-current="page"` and keyboard-safe More-menu behavior.

### Step 4: Verify route landing

Assert that `/credit` still renders `CreditDashboard` as the index child of `CreditLayout`; `/credit/borrowers` and `/credit/borrowers/new` remain nested routes. No redirect to Borrower List is added.

### Step 5: Run and commit

```bash
cd frontend && npm test -- src/components/layout/__tests__/navConfig.test.ts src/components/__tests__/CreditNav.test.tsx
cd frontend && npm run build
git add -- frontend/src/components/layout/navConfig.ts frontend/src/components/layout/LeftRail.tsx frontend/src/components/CreditNav.tsx frontend/App.tsx frontend/src/components/layout/__tests__/navConfig.test.ts frontend/src/components/__tests__/CreditNav.test.tsx
git commit -m "feat(navigation): align shared ESM CRM and Credit modules"
```

---

## Task 3: Make `/credit` a role-aware operational dashboard

**Files:**

- Modify: `backend/src/credit/services/dashboard.service.ts`
- Modify: `backend/src/credit/controllers/dashboard.controller.ts`
- Modify: `backend/src/credit/routes/dashboard.routes.ts`
- Create: `backend/src/credit/__tests__/creditOfficerDashboard.test.ts`
- Modify: `frontend/pages/credit/CreditDashboard.tsx`
- Create: `frontend/src/components/credit/dashboard/AttentionStrip.tsx`
- Create: `frontend/src/components/credit/dashboard/PriorityWorkQueue.tsx`
- Create: `frontend/src/components/credit/dashboard/NextActionsPanel.tsx`
- Create: `frontend/src/components/credit/dashboard/OperationalAlerts.tsx`
- Create: `frontend/src/components/credit/dashboard/__tests__/CreditOfficerDashboard.test.tsx`

### Step 1: Write failing backend tests

Test the existing `getMyWorkDashboard` scope and the additive fields:

```ts
expect(result.recentAssigned[0]).toMatchObject({
  applicationNo: 'CA-2026-00001',
  currentTask: expect.any(String),
  nextAction: expect.objectContaining({ label: expect.any(String), route: expect.any(String) }),
});
expect(result.attention).toEqual(expect.objectContaining({
  overdue: expect.any(Number),
  dueSoon: expect.any(Number),
  informationRequired: expect.any(Number),
  returned: expect.any(Number),
}));
```

Also assert that applications outside the user's assignment/branch are absent.

### Step 2: Add deterministic workflow guidance

Create a pure mapping inside `dashboard.service.ts` from current `ApplicationState` to `currentTask`, `nextAction.label`, and `nextAction.route`. The server returns the guidance so all clients use the same operational meaning. Unknown states must return a safe `Open application` action.

Do not create a seventh dashboard API call. Extend the existing my-work response and continue using the current work-queue/alert endpoints.

### Step 3: Write failing frontend tests

For a user with `credit:create` but not `credit:approve` or `credit:admin`, assert:

- `New Application` is visible.
- Attention strip, priority work queue, next actions, alerts, and pipeline are visible.
- Team Performance and administrative widgets are absent.
- Clicking a next action navigates to the returned application route.
- Empty and error states preserve the page shell.

### Step 4: Refactor the page into role-aware sections

Keep the existing data-fetch cancellation/error handling. Replace the six equal-weight KPI cards with a compact attention strip. Render sections by capability, not hard-coded job-title strings:

```ts
const canCreate = hasPermission(user, 'credit:create');
const canApprove = hasPermission(user, 'credit:approve');
const canAdminister = hasPermission(user, 'credit:admin');
```

Credit Officer priority:

1. Attention requiring action.
2. Assigned applications ordered by overdue, due soon, priority, then update time.
3. Explicit next actions.
4. Operational alerts.
5. Pipeline summary.

Manager/reviewer additions are additive and permission-aware; they do not expose Team Performance to officers.

### Step 5: Run and commit

```bash
cd backend && npm test -- creditOfficerDashboard.test.ts
cd backend && npm run build
cd frontend && npm test -- src/components/credit/dashboard/__tests__/CreditOfficerDashboard.test.tsx
cd frontend && npm run build
git add -- backend/src/credit/services/dashboard.service.ts backend/src/credit/controllers/dashboard.controller.ts backend/src/credit/routes/dashboard.routes.ts backend/src/credit/__tests__/creditOfficerDashboard.test.ts frontend/pages/credit/CreditDashboard.tsx frontend/src/components/credit/dashboard
git commit -m "feat(credit): add role-aware operational dashboard"
```

---

## Task 4: Add borrower operational identity, segment, owner, and lifecycle data

**Files:**

- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/20260811090000_borrower_operational_fields/migration.sql`
- Create: `backend/prisma/backfill-borrower-operational-fields.ts`
- Modify: `backend/prisma/seed-credit.ts`
- Create: `backend/src/credit/__tests__/borrowerOperationalMigration.test.ts`

### Step 1: Write the migration contract test

The test must require:

- Unique, non-null `borrowerNumber` after backfill.
- A valid `segment` for every non-deleted borrower.
- Owner FK points to an active user when present.
- Lifecycle status is independent of technical `deletedAt`.

### Step 2: Extend the Prisma model

Add:

```prisma
enum BorrowerSegment {
  INDIVIDUAL
  SME
  CORPORATE
}

enum BorrowerLifecycleStatus {
  ACTIVE
  INACTIVE
  ARCHIVED
}

model BorrowerProfile {
  borrowerNumber      String                  @unique @map("borrower_number") @db.VarChar(20)
  segment             BorrowerSegment         @map("segment")
  lifecycleStatus     BorrowerLifecycleStatus @default(ACTIVE) @map("lifecycle_status")
  relationshipOwnerId String?                 @map("relationship_owner_id") @db.Uuid
  relationshipOwner   User?                   @relation("BorrowerRelationshipOwner", fields: [relationshipOwnerId], references: [id])

  @@index([segment])
  @@index([lifecycleStatus])
  @@index([relationshipOwnerId])
  @@index([segment, lifecycleStatus])
}
```

Add the inverse `borrowerRelationships BorrowerProfile[] @relation("BorrowerRelationshipOwner")` to `User`.

### Step 3: Use an expand/backfill/contract migration

The first SQL migration adds nullable columns and a PostgreSQL sequence. The backfill script:

1. Assigns deterministic borrower numbers ordered by `createdAt, id`.
2. Maps `INDIVIDUAL` and `JOINT` to segment `INDIVIDUAL`.
3. Maps `SOLE_PROPRIETOR` to `SME`.
4. Maps existing `CORPORATE` to `SME` only when an approved business rule can prove the segment; otherwise maps to `CORPORATE` and outputs a reclassification CSV/count for review.
5. Maps `isActive=true` to `ACTIVE`, `isActive=false` to `INACTIVE`; it does not repurpose `deletedAt`.
6. Uses the most recent non-terminal application's assigned RM as the initial relationship owner when unambiguous; otherwise leaves owner null and reports the record.

After verifying the report, a contract migration makes `borrowerNumber`, `segment`, and `lifecycleStatus` non-null.

Use PostgreSQL `nextval('borrower_number_seq')` inside the borrower creation transaction and format `BRW-${String(value).padStart(6, '0')}`. Never derive the displayed number from the UUID.

### Step 4: Seed representative Malaysian borrowers

Seed the approved examples plus inactive and owner-less examples. Do not use unmasked real NRIC data. Ensure generated seed application states exercise zero and multiple active application counts.

### Step 5: Run and commit

```bash
cd backend && npm run prisma:generate
cd backend && npm test -- borrowerOperationalMigration.test.ts
cd backend && npm run build
git add -- backend/prisma/schema.prisma backend/prisma/migrations backend/prisma/backfill-borrower-operational-fields.ts backend/prisma/seed-credit.ts backend/src/credit/__tests__/borrowerOperationalMigration.test.ts
git commit -m "feat(credit): add borrower operational data foundation"
```

Production migration gate:

```bash
cd backend && npm run prisma:migrate:prod
cd backend && npx tsx prisma/backfill-borrower-operational-fields.ts --dry-run
cd backend && npx tsx prisma/backfill-borrower-operational-fields.ts --write
```

The script must be idempotent and refuse `--write` if duplicate borrower numbers or invalid segment mappings are detected.

---

## Task 5: Implement the production Borrower List backend contract

**Files:**

- Modify: `backend/src/credit/services/borrowerProfile.service.ts`
- Modify: `backend/src/credit/controllers/borrowerProfile.controller.ts`
- Modify: `backend/src/credit/routes/borrowerProfile.routes.ts`
- Create: `backend/src/credit/validators/borrowerList.validator.ts`
- Create: `backend/src/credit/__tests__/borrowerList.integration.test.ts`
- Modify: `backend/src/credit/utils/maskNric.ts`

### Step 1: Write failing API tests

Cover:

- Search by borrower number, name, normalized NRIC, registration number, and phone.
- Segment, lifecycle status, owner, and active-application filters.
- Active applications exclude `REJECTED`, `CLOSED`, and `WITHDRAWN`.
- Sort allowlist prevents arbitrary Prisma field injection.
- Branch/tenant scope applies to both result rows and stats.
- Identity and phone are masked in every list response.
- Pagination metadata is stable and a request above the maximum limit is rejected or capped.
- Archived is a business lifecycle status; technically deleted rows remain excluded.

### Step 2: Validate query parameters with Zod

Use a single validated contract:

```ts
const borrowerListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(20).max(100).default(20),
  search: z.string().trim().max(120).optional(),
  segment: z.enum(['INDIVIDUAL', 'SME', 'CORPORATE']).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED']).optional(),
  relationshipOwnerId: z.string().uuid().optional(),
  hasActiveApplication: z.coerce.boolean().optional(),
  sortBy: z.enum(['name', 'segment', 'activeApplicationCount', 'totalExposure', 'status', 'updatedAt']).default('updatedAt'),
  sortDirection: z.enum(['asc', 'desc']).default('desc'),
});
```

### Step 3: Return a purpose-built projection

Do not return the whole Prisma profile. Select only the operational fields. Use relation counts or a grouped query for non-terminal applications and include relationship owner display name. Apply `maskNric`/contact masking before serialization.

Response shape:

```ts
{
  items: BorrowerListItem[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  appliedSort: { field: string; direction: 'asc' | 'desc' };
}
```

Update `/borrowers/stats` to return `total`, `active`, `individual`, `sme`, and `corporate`, scoped using the same access predicate as the list.

### Step 4: Index and measure

Add indexes for borrower number, normalized identities, segment/status, owner, and application borrower/state. Capture `EXPLAIN ANALYZE` for representative list/search/filter queries against seeded volume. Target p95 server processing below 500 ms for normal indexed filters; record the actual accepted baseline in the PR.

### Step 5: Run and commit

```bash
cd backend && npm test -- borrowerList.integration.test.ts
cd backend && npm run build
git add -- backend/src/credit/services/borrowerProfile.service.ts backend/src/credit/controllers/borrowerProfile.controller.ts backend/src/credit/routes/borrowerProfile.routes.ts backend/src/credit/validators/borrowerList.validator.ts backend/src/credit/utils/maskNric.ts backend/src/credit/__tests__/borrowerList.integration.test.ts
git commit -m "feat(credit): add operational borrower list API"
```

---

## Task 6: Build the Borrower List screen in the existing shell

**Files:**

- Modify: `frontend/pages/BorrowerProfileList.tsx`
- Modify: `frontend/src/components/credit/BorrowerKpiCards.tsx`
- Modify: `frontend/src/components/credit/BorrowerFilterBar.tsx`
- Modify: `frontend/src/components/credit/BorrowerDataTable.tsx`
- Modify: `frontend/src/components/credit/BorrowerQuickPreview.tsx`
- Create: `frontend/src/components/credit/BorrowerStatusBadge.tsx`
- Create: `frontend/src/components/credit/__tests__/BorrowerProfileList.test.tsx`
- Create: `frontend/e2e/credit/borrower-list.spec.ts`

### Step 1: Write component tests first

Assert:

- Heading, breadcrumb, subtitle, and compact summary are visible.
- `Create Borrower` is shown with `credit:create` and absent with read-only permission.
- Search and filters initialize from URL parameters.
- Debounced search updates the URL and resets page to 1.
- Clear Filters preserves search and clears only filters/sort page state.
- Every approved table column has a header.
- Borrower name opens `/credit/borrowers/:id`.
- Active count opens `/credit/applications?borrowerId=:id&status=active`.
- Menu actions are permission-aware.
- Loading uses skeleton rows; error offers retry; no results offers Create only when allowed.

### Step 2: Replace KPI cards with a compact summary strip

Reuse `BorrowerKpiCards.tsx` but change its presentation and semantics to the five approved metrics. Do not introduce five new visual cards.

### Step 3: Make URL state authoritative

Use React Router search params for `q`, `segment`, `status`, `owner`, `activeApplication`, `sort`, `direction`, `page`, and `limit`. Cancel stale Axios requests so slow searches cannot replace newer results.

### Step 4: Implement the operational table

Render exactly:

1. Borrower ID
2. Borrower
3. Type/segment
4. NRIC / Registration No.
5. Contact
6. Relationship Owner
7. Active Applications
8. Total Exposure
9. Status
10. Last Updated
11. Action

Use tabular numerals for counts/exposure, semantic badges with icon and label, accessible sorting, and one row overflow menu. Preserve the current quick preview only if row selection does not hijack link navigation; otherwise defer preview to Borrower 360 work.

### Step 5: Add Playwright journey

Test at 1440px:

1. Open Credit from shared rail.
2. Open Borrowers from `CreditNav`.
3. Search `850412-10`.
4. Confirm Ahmad appears with masked NRIC, two applications, and RM 45,000.
5. Open Borrower 360.
6. Return and filter SME with active application Yes.
7. Open row menu and verify role-aware actions.

### Step 6: Run and commit

```bash
cd frontend && npm test -- src/components/credit/__tests__/BorrowerProfileList.test.tsx
cd frontend && npx playwright test e2e/credit/borrower-list.spec.ts
cd frontend && npm run build
git add -- frontend/pages/BorrowerProfileList.tsx frontend/src/components/credit/BorrowerKpiCards.tsx frontend/src/components/credit/BorrowerFilterBar.tsx frontend/src/components/credit/BorrowerDataTable.tsx frontend/src/components/credit/BorrowerQuickPreview.tsx frontend/src/components/credit/BorrowerStatusBadge.tsx frontend/src/components/credit/__tests__/BorrowerProfileList.test.tsx frontend/e2e/credit/borrower-list.spec.ts
git commit -m "feat(credit): implement production borrower list"
```

---

## Task 7: Add governed duplicate-exception persistence and APIs

**Files:**

- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/20260811100000_borrower_duplicate_exception/migration.sql`
- Create: `backend/src/credit/services/borrowerDuplicateException.service.ts`
- Create: `backend/src/credit/controllers/borrowerDuplicateException.controller.ts`
- Create: `backend/src/credit/routes/borrowerDuplicateException.routes.ts`
- Create: `backend/src/credit/validators/borrowerDuplicateException.validator.ts`
- Modify: `backend/src/credit/routes/borrowerProfile.routes.ts`
- Modify: `backend/src/credit/routes/credit.routes.ts`
- Modify: `backend/src/credit/controllers/borrowerProfile.controller.ts`
- Modify: `backend/src/credit/services/borrowerProfile.service.ts`
- Modify: `backend/src/security/operation-control.registry.ts`
- Create: `backend/src/credit/__tests__/borrowerDuplicateException.integration.test.ts`
- Modify: `backend/src/credit/__tests__/borrowerDuplicateOverride.test.ts`

### Step 1: Write the governance tests first

Required cases:

```text
credit:create can request an exception but cannot approve it
credit:approve can approve or reject a pending request
requester cannot approve their own request even if they also have credit:approve
reason must be 20–2000 characters and category is required
approval is tied to requester, matched borrower, segment, and normalized identity hash
an approval is single-use and expires
rejected, expired, mismatched, or consumed approval cannot create a borrower
create + consume occurs in one database transaction
every request/decision/consumption writes a Credit audit event
raw NRIC/registration is not stored in the exception record
```

### Step 2: Add the model

```prisma
enum DuplicateExceptionStatus {
  PENDING
  APPROVED
  REJECTED
  CONSUMED
  EXPIRED
}

model BorrowerDuplicateException {
  id                  String                   @id @default(uuid()) @db.Uuid
  draftId             String                   @map("draft_id") @db.Uuid
  requestedById       String                   @map("requested_by_id") @db.Uuid
  decidedById         String?                  @map("decided_by_id") @db.Uuid
  matchedBorrowerId   String                   @map("matched_borrower_id") @db.Uuid
  segment             BorrowerSegment
  identityFingerprint String                   @map("identity_fingerprint") @db.VarChar(64)
  category            String                   @db.VarChar(80)
  justification       String                   @db.Text
  supportingReference String?                  @map("supporting_reference") @db.VarChar(255)
  status              DuplicateExceptionStatus @default(PENDING)
  decisionComment     String?                  @map("decision_comment") @db.Text
  expiresAt           DateTime?                @map("expires_at") @db.Timestamp(6)
  decidedAt           DateTime?                @map("decided_at") @db.Timestamp(6)
  consumedAt          DateTime?                @map("consumed_at") @db.Timestamp(6)
  createdAt           DateTime                 @default(now()) @map("created_at") @db.Timestamp(6)
  updatedAt           DateTime                 @updatedAt @map("updated_at") @db.Timestamp(6)
}
```

Add explicit relations and indexes for requester, decider, matched borrower, status, and expiry. Generate `identityFingerprint` with an HMAC server secret over canonical segment + normalized identity; do not use an unhashed identifier.

### Step 3: Add endpoints

```text
POST /api/v1/credit/borrowers/duplicate-exceptions
GET  /api/v1/credit/borrowers/duplicate-exceptions/:id
POST /api/v1/credit/borrowers/duplicate-exceptions/:id/decision
```

- Request: `credit:create`
- Read own request: requester or `credit:approve`
- Decide: `credit:approve`, with self-approval blocked

Register static exception routes before `/:id`.

Mount `borrowerDuplicateException.routes.ts` from `credit.routes.ts` at `/borrowers/duplicate-exceptions` before the general `/borrowers` router so Express cannot resolve `duplicate-exceptions` as a borrower ID.

### Step 4: Make borrower creation consume approval server-side

Add `duplicateExceptionId` to the validated create body. If the enhanced duplicate check returns an exact identity match, creation succeeds only when:

- the exception is approved and not expired/consumed;
- requester is the authenticated creator;
- matched borrower and recomputed identity fingerprint match;
- segment matches the create payload.

Use one Prisma transaction for borrower number allocation, borrower creation, exception consumption, and audit event. Preserve current direct `overrideDuplicate` only for `credit:admin`, with its existing reason and audit requirements.

### Step 5: Register operations and audit events

Add operation-control entries for request/read/decision/consume. Add immutable audit action names:

```text
BORROWER_DUPLICATE_EXCEPTION_REQUESTED
BORROWER_DUPLICATE_EXCEPTION_APPROVED
BORROWER_DUPLICATE_EXCEPTION_REJECTED
BORROWER_DUPLICATE_EXCEPTION_CONSUMED
```

Audit metadata must contain IDs, category, status transition, actor, timestamp, and fingerprint prefix only—not raw PII or the entire form payload.

### Step 6: Run and commit

```bash
cd backend && npm run prisma:generate
cd backend && npm test -- borrowerDuplicateException.integration.test.ts borrowerDuplicateOverride.test.ts borrowerIdentityDuplicate.test.ts
cd backend && npm run build
git add -- backend/prisma/schema.prisma backend/prisma/migrations backend/src/credit/services/borrowerDuplicateException.service.ts backend/src/credit/controllers/borrowerDuplicateException.controller.ts backend/src/credit/routes/borrowerDuplicateException.routes.ts backend/src/credit/validators/borrowerDuplicateException.validator.ts backend/src/credit/routes/borrowerProfile.routes.ts backend/src/credit/routes/credit.routes.ts backend/src/credit/controllers/borrowerProfile.controller.ts backend/src/credit/services/borrowerProfile.service.ts backend/src/security/operation-control.registry.ts backend/src/credit/__tests__/borrowerDuplicateException.integration.test.ts backend/src/credit/__tests__/borrowerDuplicateOverride.test.ts
git commit -m "feat(credit): govern borrower duplicate exceptions"
```

---

## Task 8: Implement mandatory Create Borrower Identity Check

**Files:**

- Modify: `frontend/pages/CreateBorrowerPage.tsx`
- Modify: `frontend/src/components/credit/create-borrower/DuplicateCheckStep.tsx`
- Modify: `frontend/src/components/credit/create-borrower/DuplicateConflictModal.tsx`
- Modify: `frontend/src/components/credit/create-borrower/ProgressTracker.tsx`
- Modify: `frontend/src/hooks/useDuplicateCheck.ts`
- Create: `frontend/src/components/credit/create-borrower/DuplicateExceptionPanel.tsx`
- Create: `frontend/src/components/credit/create-borrower/__tests__/IdentityCheckStep.test.tsx`
- Create: `frontend/e2e/credit/borrower-identity-check.spec.ts`

### Step 1: Write failing component tests

Test:

- Borrower segment is mandatory.
- Individual requires NRIC/passport; SME/Corporate requires registration number.
- Format errors remain inline and preserve input.
- There is no `Skip & Proceed` action.
- Exact match makes `View Existing Borrower` primary.
- Credit Officer sees `Request exception`, never a self-override confirmation.
- Pending request disables progression and displays current owner/status.
- Approved exception unlocks Continue for the original requester only.
- Clear result allows Continue to Borrower Details.

### Step 2: Expand duplicate result semantics

Replace the current single `exists/borrowerId` state with:

```ts
type DuplicateCheckState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'clear'; fingerprint: string }
  | { status: 'possible'; matches: DuplicateMatch[] }
  | { status: 'exact'; matches: DuplicateMatch[]; fingerprint: string }
  | { status: 'error'; message: string };
```

The server determines exact versus possible. The client must never downgrade an exact match.

### Step 3: Implement the exception UX

Use the approved modal fields—category, justification, supporting reference, and acknowledgement—but change its final action to `Submit Exception Request`. After submission:

- Show status `Pending Credit Manager review`.
- Offer `View Existing Borrower` and `Cancel creation`.
- Poll only while the page is open using a conservative interval or use existing notification/SSE support to refresh status.
- On approval, display approver/time/expiry and enable Continue.
- On rejection, show the decision comment and allow the officer to revise and resubmit as a new request.

### Step 4: Persist the identity checkpoint in the local draft

Add a client-generated UUID `draftId`, selected segment, identity type, masked display value, server fingerprint, match status, and exception ID/status to `createBorrowerDraft`. Never store full NRIC/registration in a second analytics store; the current form draft may retain it only under the existing local draft policy and must be cleared on completion/cancel.

### Step 5: Run and commit

```bash
cd frontend && npm test -- src/components/credit/create-borrower/__tests__/IdentityCheckStep.test.tsx
cd frontend && npx playwright test e2e/credit/borrower-identity-check.spec.ts
cd frontend && npm run build
git add -- frontend/pages/CreateBorrowerPage.tsx frontend/src/components/credit/create-borrower/DuplicateCheckStep.tsx frontend/src/components/credit/create-borrower/DuplicateConflictModal.tsx frontend/src/components/credit/create-borrower/ProgressTracker.tsx frontend/src/hooks/useDuplicateCheck.ts frontend/src/components/credit/create-borrower/DuplicateExceptionPanel.tsx frontend/src/components/credit/create-borrower/__tests__/IdentityCheckStep.test.tsx frontend/e2e/credit/borrower-identity-check.spec.ts
git commit -m "feat(credit): enforce borrower identity checkpoint"
```

---

## Task 9: Consolidate the existing wizard into six production stages

**Files:**

- Modify: `frontend/pages/CreateBorrowerPage.tsx`
- Modify: `frontend/src/components/credit/create-borrower/ProgressTracker.tsx`
- Modify: `frontend/src/components/credit/create-borrower/BasicInfoStep.tsx`
- Modify: `frontend/src/components/credit/create-borrower/ContactInfoStep.tsx`
- Modify: `frontend/src/components/credit/create-borrower/EmploymentFinancialsStep.tsx`
- Modify: `frontend/src/components/credit/create-borrower/ComplianceChecksStep.tsx`
- Modify: `frontend/src/components/credit/create-borrower/DocumentUploadStep.tsx`
- Modify: `frontend/src/components/credit/create-borrower/ReviewStep.tsx`
- Modify: `frontend/src/components/credit/create-borrower/CreateBorrowerActionPanel.tsx`
- Create: `frontend/src/components/credit/create-borrower/__tests__/CreateBorrowerWizard.test.tsx`
- Create: `frontend/e2e/credit/create-borrower.spec.ts`

### Step 1: Write the stage-transition tests

The stage model is:

```text
1 Identity Check
2 Borrower Details
3 Contact & Address
4 Financial Profile
5 KYC & Compliance (includes Documents)
6 Review
```

Test that each step blocks progression on its own required fields and that browser refresh restores the exact completed/current stage. Direct navigation must not bypass Identity Check.

### Step 2: Preserve legal type while adapting by segment

- Individual: legal type defaults to `INDIVIDUAL`; Joint remains an explicit subtype where supported.
- SME: collect legal form in `businessType` and preserve `SOLE_PROPRIETOR` where applicable.
- Corporate: legal type is `CORPORATE`, with corporate-specific fields.

The form sends both `segment` and the existing `borrowerType`; it does not infer one from visual labels during submission.

### Step 3: Reuse current components

- Fold `BorrowerTypeStep` into Identity Check.
- Rename/recompose Basic Information as Borrower Details.
- Keep Contact Details and Employment/Financials behavior.
- Render `DocumentUploadStep` as a section inside KYC & Compliance.
- Keep all current post-create document, income, KYC, and AML calls until the backend orchestration in Task 10 is available.

Calculated/system/read-only values use distinct presentation from editable inputs. Amounts accept numeric input but display RM formatting on blur and in Review.

### Step 4: Add type-specific end-to-end journeys

Playwright must cover:

1. Individual: Ahmad bin Rahman, NRIC flow, employment and monthly income.
2. SME: Alpha Trading Sdn Bhd, registration number, industry, annual revenue/turnover, legal form.
3. Corporate: Meridian Manufacturing Berhad, registration number, industry, annual revenue/turnover, representative.

Each journey verifies the resulting Borrower 360 route and that the new borrower appears in Borrower List with the correct segment, owner, masked identifier, and borrower number.

### Step 5: Run and commit

```bash
cd frontend && npm test -- src/components/credit/create-borrower/__tests__/CreateBorrowerWizard.test.tsx
cd frontend && npx playwright test e2e/credit/create-borrower.spec.ts
cd frontend && npm run build
git add -- frontend/pages/CreateBorrowerPage.tsx frontend/src/components/credit/create-borrower frontend/e2e/credit/create-borrower.spec.ts
git commit -m "feat(credit): consolidate borrower creation journey"
```

---

## Task 10: Make borrower creation recoverable and operationally safe

**Files:**

- Create: `backend/src/credit/services/borrowerOnboarding.service.ts`
- Modify: `backend/src/credit/controllers/borrowerProfile.controller.ts`
- Modify: `backend/src/credit/validators/borrowerProfile.validator.ts`
- Create: `backend/src/credit/__tests__/borrowerOnboarding.integration.test.ts`
- Modify: `frontend/pages/CreateBorrowerPage.tsx`
- Modify: `frontend/src/services/credit.service.ts`

### Step 1: Write failure-mode tests

Test:

- Double-click/retry with the same idempotency key creates one borrower.
- Core borrower + number + duplicate exception consumption are atomic.
- A document/KYC downstream failure returns explicit per-section outcome and does not silently report full success.
- Retrying incomplete enrichment does not create a second borrower.
- Audit events identify created, partially completed, resumed, and completed onboarding.

### Step 2: Add an orchestration boundary

Introduce an onboarding service that accepts one validated command with an `idempotencyKey`/`draftId`. Core identity and exception consumption execute transactionally. Existing income, KYC/AML, and document services run as explicit follow-up stages with recorded outcomes.

Response:

```ts
interface BorrowerOnboardingResult {
  borrowerId: string;
  borrowerNumber: string;
  status: 'COMPLETED' | 'REQUIRES_FOLLOW_UP';
  stages: Array<{
    name: 'PROFILE' | 'INCOME' | 'KYC' | 'AML' | 'DOCUMENTS';
    status: 'COMPLETED' | 'FAILED' | 'NOT_REQUIRED';
    message?: string;
  }>;
}
```

Do not keep the present best-effort behavior that navigates as though all operations succeeded. If enrichment fails, navigate to Borrower 360 with a visible `Onboarding requires follow-up` banner and a resumable action.

### Step 3: Run and commit

```bash
cd backend && npm test -- borrowerOnboarding.integration.test.ts borrowerDuplicateException.integration.test.ts
cd backend && npm run build
cd frontend && npm run build
git add -- backend/src/credit/services/borrowerOnboarding.service.ts backend/src/credit/controllers/borrowerProfile.controller.ts backend/src/credit/validators/borrowerProfile.validator.ts backend/src/credit/__tests__/borrowerOnboarding.integration.test.ts frontend/pages/CreateBorrowerPage.tsx frontend/src/services/credit.service.ts
git commit -m "feat(credit): make borrower onboarding recoverable"
```

---

## Task 11: Add approval visibility for duplicate exceptions

**Files:**

- Modify: `frontend/pages/MyApprovals.tsx`
- Create: `frontend/src/components/credit/approvals/DuplicateExceptionQueue.tsx`
- Create: `frontend/src/components/credit/approvals/DuplicateExceptionDecisionModal.tsx`
- Create: `frontend/src/components/credit/approvals/__tests__/DuplicateExceptionQueue.test.tsx`
- Modify: `backend/src/credit/services/borrowerDuplicateException.service.ts`
- Modify: `backend/src/credit/controllers/borrowerDuplicateException.controller.ts`
- Modify: `backend/src/credit/routes/borrowerDuplicateException.routes.ts`

### Step 1: Add queue API and tests

Add a `credit:approve`-protected paginated pending queue ordered oldest first, with branch/tenant scoping and expiry visibility. Return masked identity, matched borrower summary, requester, category, justification, supporting reference, and audit timestamps.

### Step 2: Add the queue to the existing approval area

Do not create a new global nav destination. Add a `Duplicate Exceptions` tab/count to `/credit/approvals` for users with `credit:approve`. Continue to enforce requester/approver segregation on the server; navigation visibility is not the control boundary.

Decision UX must:

- Open the existing borrower in a new tab without losing the decision context.
- Require a decision comment for rejection.
- Show the expiry and single-use conditions.
- Prevent requester self-approval and display the server reason.

### Step 3: Run and commit

```bash
cd backend && npm test -- borrowerDuplicateException.integration.test.ts
cd frontend && npm test -- src/components/credit/approvals/__tests__/DuplicateExceptionQueue.test.tsx
cd frontend && npm run build
git add -- frontend/pages/MyApprovals.tsx frontend/src/components/credit/approvals backend/src/credit/services/borrowerDuplicateException.service.ts backend/src/credit/controllers/borrowerDuplicateException.controller.ts backend/src/credit/routes/borrowerDuplicateException.routes.ts
git commit -m "feat(credit): add duplicate exception approval queue"
```

---

## Task 12: Accessibility, telemetry, security, and rollout verification

**Files:**

- Create: `frontend/e2e/credit/credit-dashboard-a11y.spec.ts`
- Create: `frontend/e2e/credit/borrower-list-a11y.spec.ts`
- Modify: `frontend/e2e/credit/render-smoke.spec.ts`
- Modify: `backend/src/config/index.ts`
- Modify: `frontend/src/lib/featureFlags.ts`
- Modify: `backend/src/credit/services/borrowerProfile.service.ts`
- Modify: `backend/src/credit/services/borrowerDuplicateException.service.ts`
- Create: `docs/credit/credit-ui-v2-runbook.md`

### Step 1: Add rollout switches

Use the existing feature flag patterns for:

```text
creditOperationalDashboard
creditBorrowerListV2
creditBorrowerIdentityCheckV2
```

Flags select the UI composition, not security rules. New backend validation and audit protections remain server-authoritative even if a frontend flag is off.

### Step 2: Add operational telemetry

Record structured, PII-safe events/metrics:

- borrower search latency and result count;
- zero-result rate;
- identity exact/possible/clear result counts;
- duplicate exception requested/approved/rejected/expired/consumed counts;
- borrower onboarding completed/follow-up counts;
- API error rate and p95 duration.

Never log raw search text when it may contain NRIC, registration number, phone, or email.

### Step 3: Accessibility and layout tests

At 1440px and the supported narrower desktop breakpoint, verify:

- one page-level `h1`;
- skip link and focus order;
- keyboard operation of module navigation, filters, sortable headers, row menus, modal, and pagination;
- `aria-current`, sort state, labels, live result count, and validation errors;
- icon-plus-label statuses and WCAG AA contrast;
- no clipped primary CTA or inaccessible horizontal overflow.

### Step 4: Full verification

```bash
cd backend && npm run prisma:generate
cd backend && npm run build
cd backend && npm test -- borrowerOperationalMigration.test.ts borrowerList.integration.test.ts borrowerIdentityDuplicate.test.ts borrowerDuplicateOverride.test.ts borrowerDuplicateException.integration.test.ts borrowerOnboarding.integration.test.ts creditOfficerDashboard.test.ts
cd backend && npm run audit:verify
cd frontend && npm test
cd frontend && npm run build
cd frontend && npm run test:e2e:credit
cd frontend && npm run test:e2e:a11y
```

### Step 5: Staged rollout

1. Deploy additive migrations and backend APIs with UI flags off.
2. Run dry-run backfill and resolve segment/owner exceptions.
3. Run write backfill, verify counts, then apply non-null constraints.
4. Enable dashboard for internal Credit pilot users.
5. Enable Borrower List for one branch and monitor search latency/zero-result rate.
6. Enable Identity Check after the admin exception queue is staffed and SLA/ownership is agreed.
7. Expand branch-by-branch; keep the prior page composition available for one release window.
8. Remove old UI paths and feature flags only after adoption, support, and audit review.

### Step 6: Document and commit

The runbook must include flag rollback, backfill reconciliation, exception-queue ownership, expired approvals, onboarding recovery, PII-safe diagnostics, and support contacts.

```bash
git add -- frontend/e2e/credit frontend/src/lib/featureFlags.ts backend/src/config/index.ts backend/src/credit/services/borrowerProfile.service.ts backend/src/credit/services/borrowerDuplicateException.service.ts docs/credit/credit-ui-v2-runbook.md
git commit -m "docs(credit): add UI v2 rollout and operations runbook"
```

---

## 3. API compatibility and security checklist

- Existing `/api/v1/credit` prefix remains unchanged.
- Existing borrower detail payloads remain compatible; the new list endpoint returns an intentional projection.
- Every query is tenant/branch scoped using the same predicate for rows, stats, and owner options.
- Search input is bounded, normalized, and never interpolated into raw SQL.
- Full NRIC/passport is absent from list and exception responses.
- Search and duplicate telemetry never logs raw PII.
- `credit:read` controls list/detail, `credit:create` controls originator and exception-request actions, `credit:approve` controls application approvals and duplicate-exception decisions, and `credit:admin` controls configuration and the existing audited break-glass duplicate override.
- UI visibility is convenience only; every backend route retains permission middleware.
- Exact duplicate approval is server-verified, expiring, single-use, and transactionally consumed.
- Segregation of duties prevents self-approval.
- All material actions write the existing immutable Credit audit chain.

---

## 4. Definition of done

The implementation is complete only when:

1. Clicking shared `Credit` lands the user on the role-appropriate `/credit` dashboard.
2. ESM, CRM, and Credit coexist correctly in the shared rail without Credit page links leaking into it.
3. A Credit Officer can find a borrower by supported identifiers within one operational screen and can see type/segment, active applications, exposure, owner, status, and update time.
4. A Reviewer or Manager can search/view but cannot create without `credit:create`.
5. A Credit Officer cannot bypass an exact duplicate, including by calling the API directly.
6. An approved exception can be consumed once by its requester and produces a complete audit trail.
7. Individual, SME, and Corporate borrower journeys create the intended segment and preserve legal subtype data.
8. Partial onboarding failure is visible and recoverable, never falsely reported as complete.
9. All specified backend, frontend, Playwright, build, accessibility, and audit checks pass.
10. Production rollout and rollback steps are documented and exercised in a non-production environment.

---

## 5. Recommended execution order

Start with Tasks 1–3 to land the shared shell and Credit dashboard without database migration risk. Then complete Tasks 4–6 as the Borrower List vertical slice. Complete Tasks 7 and 11 together before exposing exception requests, followed by Tasks 8–10 for borrower creation. Finish with Task 12 and a controlled branch pilot.

The next implementation task is **Task 1: Lock contracts and add shared Credit UI vocabulary**. The next screen design remains **Create Borrower / Borrower Identity Check**, but implementation should not proceed from mockup directly; it must follow the governance API sequence above.
