# CRM Daily Operational Report Implementation Plan

> For Hermes: execute this plan only after product approval. Use strict TDD for new behavior and preserve unrelated working-tree changes.

**Goal:** Add a CRM-backed daily operational report that can reproduce the meaningful structure of `docs/DAILY REPORT UMHAJGO EMARKET.xlsx` while preserving the existing Activity Summary report and avoiding unsupported historical reconstruction.

**Architecture:** Keep `Activity Summary` as an activity-count report. Add a separate `Daily Operational Report` based on structured CRM activity outcomes and lead lifecycle events. Store structured outcomes on CRM activities, aggregate them by local calendar day and owner, and provide an Excel-compatible export. Existing free-text activity descriptions remain historical evidence but are not retroactively classified automatically.

**Current evidence / assumptions:**
- Cristel Erguiza has 833 active leads, 832 `NEW`, 1 `CONVERTED`.
- Current CRM has only 15 activities for Cristel; only 6 qualify for the selected 1–17 August 2026 Activity Summary range.
- The workbook contains manual daily metrics that are not currently represented as structured CRM rows.
- The current activity model has `activityType`, subject, description, metadata, timestamps, and lead/entity links, but no structured call/email/meeting outcome fields.
- The existing workbook is internally inconsistent in places, including mixed date/text formats and a July `#VALUE!` formula result. It should be treated as a business-layout reference, not as a clean data contract.

## Product decisions required before implementation

1. Add a new report named `Daily Operational Report`; do not change the meaning of `Activity Summary`.
2. Use structured outcome capture going forward. Do not infer old outcomes from free-text descriptions without an explicit, reviewable migration rule.
3. Define whether the report timezone is Asia/Kuala_Lumpur. Recommendation: yes, because the workbook is a Malaysian operational report and daily boundaries must not use UTC implicitly.
4. Define whether email counts represent CRM activity logs or actual provider delivery events. Recommendation: initially count CRM-recorded sends and bounces only; integrate provider delivery events separately later.
5. Define the meaning of “interested”, “signed up”, and “declined”. Recommendation: use explicit activity outcomes for daily engagement and lead status/conversion events for lifecycle totals.

## Phase 1 — Establish the reporting contract

### Task 1: Define report data contract

**Files:**
- Create: `backend/src/services/crm-daily-report.types.ts`
- Test: `backend/src/__tests__/crm-daily-report.contract.test.ts`

Define stable enums/types for:
- `callCategory`: `NEW_CALL`, `FOLLOW_UP_CALL`
- `callOutcome`: `ANSWERED`, `NO_ANSWER`, `NOT_INTERESTED`, `WRONG_NUMBER`, `NOT_REACHABLE`, `INTERESTED`
- `emailOutcome`: `SENT`, `BOUNCED`, `REPLIED`, `RESEND_REQUIRED`
- `meetingOutcome`: `ARRANGED`, `COMPLETED`, `CANCELLED`, `NO_SHOW`
- daily row fields: date, email sent, email bounce, new calls, follow-up calls, engagement, interest, no answer, not interested, wrong number, not reachable, meetings arranged, signed up, declined

Acceptance criteria:
- The contract distinguishes activity counts from lead counts.
- Every exported field has a documented source and inclusion rule.
- Unsupported metrics cannot silently default to misleading values.

### Task 2: Document workbook-to-CRM mapping

**Files:**
- Create: `docs/crm-daily-operational-report-spec.md`

Document:
- Column mapping from the workbook to CRM fields.
- Date/timezone convention.
- Treatment of weekends, holidays, leave, and free-text notes.
- Difference between `createdAt`, `scheduledAt`, and `completedAt`.
- Treatment of deleted leads and historical activities.
- Export compatibility and limitations.

## Phase 2 — Add structured activity outcome storage

### Task 3: Extend Prisma activity schema

**Files:**
- Modify: `backend/prisma/schema.prisma` (`CrmActivity`)
- Create: Prisma migration under `backend/prisma/migrations/`

Recommended fields:
- `callCategory String?` mapped to `call_category`
- `callOutcome String?` mapped to `call_outcome`
- `emailOutcome String?` mapped to `email_outcome`
- `meetingOutcome String?` mapped to `meeting_outcome`
- `engagementOutcome String?` mapped to `engagement_outcome`
- Optional `outcomeAt DateTime?` if reporting must use outcome time rather than creation time

Prefer Prisma enums if the project migration conventions support them; otherwise use validated strings with shared TypeScript constants and database checks where safe.

Do not add `tenantId` to `CrmActivity` unless the schema is explicitly changed to include it; the current model does not have that field.

### Task 4: Add validation and controller write mapping

**Files:**
- Modify: `backend/src/validators/crm.validator.ts` around the activity body schema
- Modify: `backend/src/controllers/crm.controller.ts` activity create/update handlers
- Modify: `frontend/src/services/crm.service.ts` shared activity types/payloads

Acceptance criteria:
- `CALL` can require/accept call category and outcome.
- `EMAIL` can accept email outcome.
- `MEETING` can accept meeting outcome.
- Invalid outcome/type combinations are rejected with a clear 400 response.
- Existing activity creation remains backward-compatible for activities that do not need an outcome.
- Relation fields are not spread into Prisma write payloads.

### Task 5: Add activity form controls

**Files:**
- Modify: `frontend/pages/CrmLeadDetail.tsx`
- Modify: `frontend/pages/CrmContactDetail.tsx`
- Modify: `frontend/pages/CrmAccountDetail.tsx` if account activities remain in scope
- Modify: shared CRM activity type definitions if present

Add conditional fields:
- New call / follow-up call
- Call outcome
- Email outcome
- Meeting outcome
- Engagement/interest result

Acceptance criteria:
- The form requires an outcome for reportable completed activities, not merely scheduled activities.
- Existing users can still edit historical activities without being forced to invent an outcome.
- The saved outcome is visible in the activity timeline.

## Phase 3 — Implement the report backend

### Task 6: Add report service with shared predicates

**Files:**
- Create: `backend/src/services/crm-daily-report.service.ts`
- Test: `backend/src/__tests__/crm-daily-report.service.test.ts`

Implement:
- Inclusive `from` / `to` date handling.
- Explicit timezone conversion to the approved report timezone.
- Owner visibility via `resolveVisibleOwnerIds`.
- Active lead/entity handling as a documented choice.
- One immutable base predicate reused by all aggregates.
- Daily grouping by report-local calendar date.
- Separate counts for emails, bounces, new calls, follow-up calls, outcomes, and meetings.
- Lead lifecycle counts for converted/signed-up and lost/declined metrics, using event dates where available.

Important rules:
- Do not count a lead as a call or email merely because it exists.
- Do not classify free-text descriptions heuristically in the production report unless the migration is explicitly approved.
- Do not let `Activity Summary` and the new report use silently different owner-scope rules.
- Make the deleted-parent policy explicit: active-only report versus historical activity report.

### Task 7: Add controller, route, and CSV response

**Files:**
- Modify: `backend/src/controllers/crm.controller.ts`
- Modify: `backend/src/routes/crm.routes.ts`
- Modify: `backend/src/security/operation-control.registry.ts`
- Modify/add: backend report response tests

Endpoint:
- `GET /api/v1/crm/reports/daily-operational`

Parameters:
- `from=YYYY-MM-DD`
- `to=YYYY-MM-DD`
- optional `ownerId`
- optional `format=csv`

Response:
```text
{
  daily: [...],
  totals: {...},
  period: { from, to, timezone }
}
```

Acceptance criteria:
- Admin and scoped users receive only permitted owners' records.
- JSON and CSV use the same aggregation source.
- The CSV contains one row per report-local day plus a total row.
- Empty days are either included with zeroes or omitted according to the documented contract, consistently.

### Task 8: Add backend regression coverage

**Files:**
- Create/modify: `backend/src/__tests__/crm-daily-report.integration.test.ts`
- Modify: existing CRM report tests only when shared helpers/contracts change

Test cases:
- One new call and one follow-up call on the same day.
- One call with each outcome category.
- Email sent and bounced counts.
- Meeting arranged versus completed.
- Converted/lost lifecycle event date handling.
- Date end-of-day inclusion.
- Cross-owner visibility denial.
- Deleted linked lead handling.
- Activities with no linked entity.
- JSON/CSV parity.

Use suffix-namespaced real Prisma fixtures for integration tests and clean up activities before leads/accounts/users.

## Phase 4 — Implement the frontend report

### Task 9: Add typed API client method

**Files:**
- Modify: `frontend/src/services/crm.service.ts`
- Add/update: shared CRM report types if present

Add `getDailyOperationalReport(params)` with typed response and CSV export support.

### Task 10: Add the report panel

**Files:**
- Modify: `frontend/pages/CrmReports.tsx`
- Prefer create: `frontend/src/components/crm/DailyOperationalReportPanel.tsx` if the page becomes too large

UI should include:
- From/to date controls.
- Owner scope where permitted.
- Daily table matching the workbook column concepts.
- Monthly/weekly total rows.
- Explicit “CRM-recorded data” label.
- Empty-state explanation when there are no structured outcomes.
- CSV export.

Do not replace the existing Activity Summary tab. Add a separate tab labelled `Daily Operational` or `Daily Activity Report`.

### Task 11: Add frontend verification

**Files:**
- Create: frontend report component test if frontend test infrastructure supports it
- Otherwise document browser smoke steps in the implementation PR

Verify:
- Date changes reload the report.
- Exported CSV matches displayed totals.
- Zero values do not disappear incorrectly.
- Long company names and outcome labels do not break the table.
- The report explains that imported leads are not historical calls/emails.

## Phase 5 — Data migration and historical handling

### Task 12: Reconcile historical workbook data

**Files:**
- Create: `backend/prisma/import-crm-daily-report.ts` or a dedicated one-off script under `backend/scripts/`
- Create: `docs/crm-daily-report-migration-notes.md`

Recommended approach:
- Keep the original workbook unchanged as source evidence.
- Normalize its rows into a staging structure first.
- Record provenance: workbook name, sheet, cell/range, original text, normalized value.
- Import only values that can be mapped confidently.
- Do not create fake CRM activity records for unverified historical counts.
- If historical backfill is required, mark imported events with metadata such as `source: workbook` and preserve the original text.

Backfill options:
1. No backfill: report begins when structured outcomes are deployed. Recommended for data integrity.
2. Audited backfill: import only manually reviewed rows with provenance.
3. Heuristic backfill: not recommended for official reporting.

## Phase 6 — Quality, documentation, and rollout

### Task 13: Update CRM guide and operational documentation

**Files:**
- Modify: `frontend/pages/CrmGuide.tsx`
- Modify/create: `docs/crm-daily-operational-report-spec.md`

Explain:
- Activity Summary versus Daily Operational Report.
- Required outcome fields.
- How to log a new call versus follow-up call.
- Why imported leads do not automatically count as emails/calls.
- How to interpret zero and missing values.

### Task 14: Run verification

Commands:
```bash
cd backend
npm test -- --runInBand src/__tests__/crm-daily-report.service.test.ts src/__tests__/crm-daily-report.integration.test.ts
npm run build

cd ../frontend
npm run build
```

Also run:
- `git diff --check`
- Existing CRM report regression test:
  `cd backend && npm test -- --runInBand src/__tests__/crm-reports.activity.test.ts`
- Authenticated browser smoke test against `/crm/reports`.

Verification evidence must include:
- A fixture report with known daily totals.
- JSON versus CSV equality.
- Owner-scope result.
- Date boundary result.
- A statement of what historical workbook data was and was not imported.

## Out of scope for the first release

- Reconstructing all historical Excel totals automatically from free text.
- Replacing the existing Activity Summary semantics.
- Live email-provider bounce integration.
- Automatic classification of old notes/descriptions as call outcomes.
- Rebuilding the entire workbook’s inconsistent formatting and formulas exactly.
- Physical deletion of old activities or leads.

## Recommended delivery sequence

1. Approve the metric and timezone contract.
2. Add structured activity fields and validation.
3. Add activity form controls.
4. Build/test the backend daily report.
5. Add frontend table/export.
6. Decide whether to perform an audited historical backfill.
7. Roll out with a short parallel period comparing CRM report totals against manually maintained daily records.

## Acceptance criteria

The feature is ready when:

- A user can log a structured call/email/meeting outcome against a lead.
- The daily report produces deterministic counts by local calendar day and owner.
- The report has separate lead totals and activity totals.
- The report never presents 833 imported leads as 833 calls/emails.
- JSON and CSV totals match.
- Scoped users cannot see another owner's records.
- Historical data limitations and provenance are visible to report users.
- Backend tests and builds pass, frontend build passes, and browser smoke verification confirms the live report uses the new endpoint.
