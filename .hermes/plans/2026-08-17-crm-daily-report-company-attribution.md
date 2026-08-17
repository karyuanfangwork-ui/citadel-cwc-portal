# CRM Daily Operational Company Attribution Plan

**Goal:** Show which company each CRM activity belongs to, while preserving the existing daily operational totals and Activity Summary behavior.

**Recommended design:** Add a `By Company` breakdown to the Daily Operational report and add company name to the detailed CSV. Keep the current daily totals as the primary operational summary. Company attribution must come from linked CRM entities, not from parsing activity subjects.

## Current state

- Activities can be linked to `accountId`, `contactId`, `leadId`, or `opportunityId`.
- Leads contain `companyName`.
- Accounts contain `name`.
- Contacts resolve to their parent account name.
- Opportunities resolve to their parent account name.
- The current Daily Operational response only contains daily totals.
- The current Activity Summary response is aggregate-only and should remain unchanged.

## Attribution rules

Use this priority order:

1. Linked account name (`activity.account.name`)
2. Linked opportunity account name (`activity.opportunity.account.name`)
3. Linked contact account name (`activity.contact.account.name`)
4. Linked lead `companyName`
5. `Unassigned / No company` for unlinked activities or linked entities with no company name

If multiple polymorphic foreign keys are populated, treat the record as invalid for attribution and expose it under `Unassigned / Invalid linkage`; do not silently choose an arbitrary relation.

## Phase 1 — Backend response contract

### Task 1: Extend report types

**Files:**
- Modify: `backend/src/services/crm-daily-report.types.ts`

Add:

```ts
export interface DailyOperationalCompanyRow {
  companyName: string;
  accountId: string | null;
  activityCount: number;
  emailsSent: number;
  emailBounces: number;
  newCalls: number;
  followUpCalls: number;
  callEngagement: number;
  interested: number;
  noAnswer: number;
  notInterested: number;
  wrongNumber: number;
  notReachable: number;
  meetingsArranged: number;
  merchantsSignedUp: number;
  merchantsDeclined: number;
}
```

Extend `DailyOperationalReport` with:

```ts
byCompany: DailyOperationalCompanyRow[];
```

### Task 2: Add service-level attribution helper

**Files:**
- Modify: `backend/src/services/crm-daily-report.service.ts`
- Test: `backend/src/__tests__/crm-daily-report.service.test.ts`

Add a pure helper that accepts the selected relation data and returns:

```ts
{
  companyName: string;
  accountId: string | null;
}
```

The helper must:

- Apply the documented priority order.
- Preserve the account ID where available.
- Return `Unassigned / No company` for unlinked activities.
- Return `Unassigned / Invalid linkage` if more than one polymorphic ID is populated.
- Never derive company names from free-text subjects/descriptions.

## Phase 2 — Query and aggregate by company

### Task 3: Expand activity query relations

**Files:**
- Modify: `backend/src/services/crm-daily-report.service.ts`

The report activity query should select only required fields:

```ts
lead: {
  select: {
    companyName: true,
    accountId: true,
  },
},
account: {
  select: {
    id: true,
    name: true,
  },
},
contact: {
  select: {
    account: {
      select: {
        id: true,
        name: true,
      },
    },
  },
},
opportunity: {
  select: {
    account: {
      select: {
        id: true,
        name: true,
      },
    },
  },
},
```

Do not include sensitive contact information in the report response.

### Task 4: Build `byCompany` using the same activity predicate

**Files:**
- Modify: `backend/src/services/crm-daily-report.service.ts`
- Test: `backend/src/__tests__/crm-daily-report.service.test.ts`

For each qualifying activity:

1. Resolve its company attribution.
2. Increment `activityCount`.
3. Apply the same metric classification used by the daily totals.
4. Aggregate by stable key:
   - Prefer `accountId` when present.
   - Otherwise use `companyName`.
5. Sort by `activityCount` descending, then company name ascending.

Acceptance criteria:

- The sum of all `byCompany.activityCount` values equals the number of qualifying activities.
- The sum of company metric fields equals the corresponding classified activity totals, except lifecycle lead metrics which must be documented separately.
- Existing daily totals remain unchanged.
- Existing Activity Summary remains unchanged.

### Task 5: Define lifecycle company attribution

Converted and lost lead lifecycle metrics require separate handling from activity metrics.

**Files:**
- Modify: `backend/src/services/crm-daily-report.service.ts`
- Test: `backend/src/__tests__/crm-daily-report.service.test.ts`

When querying lifecycle leads, select:

- `companyName`
- `accountId`
- `status`
- `convertedAt`
- `updatedAt`

Add lifecycle counts to the corresponding company row. If a converted lead has already been linked to an account, use the account name; otherwise use the lead company name.

Do not count a lifecycle event as an activity.

## Phase 3 — API and CSV

### Task 6: Preserve JSON response and add company breakdown

**Files:**
- Modify: `backend/src/controllers/crm.controller.ts` only if response mapping needs adjustment
- Test: `backend/src/__tests__/crm-daily-report.integration.test.ts` if present, otherwise create it

The endpoint remains:

`GET /api/v1/crm/reports/daily-operational`

Response shape:

```json
{
  "daily": [],
  "totals": {},
  "byCompany": [],
  "period": {
    "from": "...",
    "to": "...",
    "timezone": "Asia/Kuala_Lumpur"
  }
}
```

The existing route, permission, owner visibility, date semantics, and deleted-entity behavior must not change.

### Task 7: Add company fields to CSV output

**Files:**
- Modify: `backend/src/controllers/crm.controller.ts`

Do not replace the daily CSV with the company breakdown. Add a separate format parameter:

- `format=csv`: daily totals, existing behavior
- `format=company-csv`: company breakdown rows

Recommended company CSV columns:

```text
companyName,accountId,activityCount,emailsSent,emailBounces,newCalls,followUpCalls,callEngagement,interested,noAnswer,notInterested,wrongNumber,notReachable,meetingsArranged,merchantsSignedUp,merchantsDeclined
```

Add a regression test to verify both CSV modes.

## Phase 4 — Frontend display

### Task 8: Extend frontend report type

**Files:**
- Modify: `frontend/pages/CrmReports.tsx`
- Optionally move shared types to `frontend/src/services/crm.service.ts` if reused elsewhere

Add the `byCompany` response type and company metric fields.

### Task 9: Add `By Company` table

**Files:**
- Modify: `frontend/pages/CrmReports.tsx`
- Prefer extraction if file size becomes difficult: create `frontend/src/components/crm/DailyOperationalCompanyTable.tsx`

Add a collapsible `By Company` section below the daily table.

Columns:

- Company
- Activities
- Email Sent
- Bounce
- New Calls
- Follow-up Calls
- Engagement
- Interested
- No Answer
- Not Interested
- Wrong Number
- Not Reachable
- Meetings
- Signed Up
- Declined

Display `Unassigned / No company` explicitly rather than hiding it.

### Task 10: Add company CSV export

**Files:**
- Modify: `frontend/pages/CrmReports.tsx`

Add a second export action:

- `Export Daily CSV`
- `Export Company CSV`

The company CSV must be generated from `data.byCompany`, not reconstructed from visible table text.

## Phase 5 — Verification

### Task 11: Unit tests

Test:

1. Lead-only activity maps to lead `companyName`.
2. Account-linked activity maps to account name.
3. Contact-linked activity maps to contact account name.
4. Opportunity-linked activity maps to opportunity account name.
5. Unlinked activity maps to `Unassigned / No company`.
6. Multiple linked IDs map to `Unassigned / Invalid linkage`.
7. The three known Cristel companies aggregate correctly:
   - Wanzar group sdn bhd: 1
   - Kapitani sdn bhd: 2
   - ASIA HEALTHCARE SDN BHD: 3
8. Company totals reconcile with daily activity totals.
9. Lifecycle conversion count is shown under the correct company but not added to activity count.
10. Deleted linked entities remain excluded according to the current report policy.

### Task 12: Commands

```bash
cd backend
npm test -- --runInBand src/__tests__/crm-daily-report.service.test.ts src/__tests__/crm-reports.activity.test.ts
npm run build

cd ../frontend
npm run build

cd ..
git diff --check
```

Also run an authenticated browser smoke test:

1. Open `/crm/reports`.
2. Select `Daily Operational`.
3. Select 1 August–17 August 2026.
4. Confirm the daily totals remain unchanged.
5. Expand `By Company`.
6. Confirm the three company rows and counts.
7. Export both CSVs and compare the totals to the UI.

## Out of scope

- Parsing company names from activity subjects or descriptions.
- Automatically converting all 833 leads into activities.
- Reconstructing manual Excel company totals without provenance.
- Changing Activity Summary.
- Exposing personal phone numbers or email addresses in the report.

## Acceptance criteria

The feature is complete when:

- Every qualifying activity is attributable to a company or an explicit unassigned bucket.
- Cristel’s current six qualifying activities appear as 1, 2, and 3 across the three known companies.
- Daily totals and company totals reconcile.
- Company CSV export is available separately from daily CSV export.
- Existing report permissions, owner scope, date handling, and Activity Summary behavior remain unchanged.
- Focused tests and both builds pass.
