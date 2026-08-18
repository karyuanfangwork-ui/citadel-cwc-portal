# CRM Lead Activity Update Import Plan

> **For Hermes:** Implement this plan task-by-task with backend/frontend verification.

**Goal:** Allow users to upload an exported Lead workbook, identify existing Leads by `Lead ID`, and append an activity log such as `EMAIL` / `EMAIL SENT` without overwriting unrelated Lead fields.

**Architecture:** Add a dedicated activity-only update mode to the existing CRM import flow. The import will accept `Lead ID`, `Activity Type`, and `Activity Subject`, resolve the Lead within the caller's authorized scope, and create a `CrmActivity` linked to that Lead. Existing Lead duplicate detection remains unchanged for normal new-Lead imports.

**Tech Stack:** Express + TypeScript, Prisma/PostgreSQL, React + TypeScript, XLSX parser, Jest/Supertest.

---

## Current behavior and gap

- The Lead import field registry supports `Activity Type` and `Activity Subject` for newly created Leads.
- Existing Lead matches are currently classified as duplicates and skipped.
- The attached export contains `Lead ID`, but `Lead ID` is not currently an import field.
- The current template/import flow has no explicit update mode.
- Therefore, importing the attached export cannot append activities to existing Leads.

## Proposed user flow

1. Open CRM > Import/Export.
2. Select `Leads`.
3. Select import mode: `Add activities to existing Leads`.
4. Download the activity-update template, or use an exported Lead workbook.
5. Keep `Lead ID` for each target Lead.
6. Add:
   - `Activity Type`: for example `EMAIL`
   - `Activity Subject`: for example `EMAIL SENT`
7. Upload the workbook.
8. Review the mapping and validation preview.
9. Execute the import.
10. See separate results for activities added, skipped rows, and failed rows.
11. Open the Lead detail page and verify the new activity in the activity timeline.

## Safety rules

- Activity update mode is explicit; normal Lead import behavior is unchanged.
- Match by `Lead ID` only. Do not fall back to email, phone, or title matching in update mode.
- Resolve the Lead within the caller's CRM visibility/ownership scope.
- Never update Lead fields in this mode.
- Require both `Activity Type` and `Activity Subject` for a row that is intended to create an activity.
- Validate `Activity Type` against the existing activity enum.
- Reject unknown, deleted, or unauthorized Lead IDs.
- Treat blank activity fields as a no-op only if the product explicitly allows blank rows; otherwise report them as skipped with a clear reason.
- Avoid duplicate activities from the same import job by preventing job re-execution. Do not silently deduplicate historical activities across separate uploads unless a future idempotency key is added.

---

## Backend implementation

### Task 1: Extend import contracts and field definitions

Files:
- Modify: `backend/src/services/crm-import-export.service.ts`
- Modify: `backend/src/controllers/crm.controller.ts` if query/body mode handling is needed
- Modify: `backend/src/routes/crm.routes.ts` only if a dedicated endpoint is preferable

Changes:
- Add `leadId` / `Lead ID` as an update-mode field, not as a normal new-Lead field unless needed for template display.
- Add an import mode contract such as `LEAD_ACTIVITY_UPDATE` or `mode=activity-update`.
- Define update-mode fields:
  - `leadId`, label `Lead ID`, required true, string/UUID validation
  - `activityType`, label `Activity Type`, required true, enum
  - `activitySubject`, label `Activity Subject`, required true, string max length 255
- Preserve existing `LEAD` field definitions and new-Lead duplicate behavior.
- Add aliases for `Lead ID`, `leadId`, `Activity Type`, and `Activity Subject`.

### Task 2: Persist import mode

Files:
- Inspect/modify: `backend/prisma/schema.prisma`
- Add migration only if the existing `CrmImportJob` model has no suitable mode/entity representation.

Preferred approach:
- Reuse the existing import job `entity` field with a distinct entity value only if all existing enum/database constraints support it.
- Otherwise add an optional `mode` field to `CrmImportJob`, defaulting to normal import behavior.
- Generate and apply a migration in development, then verify production migration SQL before deployment.

Do not change existing import jobs or historical records.

### Task 3: Add update-mode upload and validation

Files:
- Modify: `backend/src/controllers/crm.controller.ts`
- Modify: `backend/src/services/crm-import-export.service.ts`
- Modify: `backend/src/services/crm-scope.service.ts` only if an existing visibility helper cannot be reused

Changes:
- Accept the mode during upload and store it on the import job.
- Return update-mode field definitions and suggested mappings.
- Validate:
  - Lead ID format
  - Lead exists
  - Lead is not soft-deleted
  - Lead is visible to the importing user
  - Activity Type is a valid enum value
  - Activity Subject is present and <=255 characters
- Use original spreadsheet row numbers (`dataIndex + 2`) in validation errors.
- Fail closed: `valid: true` only when there are no validation errors.

### Task 4: Execute activity-only updates

Files:
- Modify: `backend/src/services/crm-import-export.service.ts`

For each valid update row:
- Find the Lead by `id` plus the authorized visibility predicate.
- Create a `CrmActivity` with:
  - `activityType`
  - `subject`
  - `leadId`
  - `userId` set to the importing user
- Do not pass any Lead fields to `crmLead.update`.
- Use a transaction for the Lead lookup and activity creation where practical.
- Record row-level failures without aborting unrelated valid rows, following the existing import result convention.
- Return separate counts, for example:
  - `updatedRows` or `activitiesCreated`
  - `skippedRows`
  - `failedRows`
- Persist a durable error/update report in the import job status.
- Ensure a completed job cannot be executed again.

### Task 5: Audit and event behavior

Files:
- Modify: `backend/src/services/crm-import-export.service.ts`
- Inspect existing activity creation event/audit patterns in `backend/src/controllers/crm.controller.ts`

Changes:
- Create an audit entry for the import operation and/or each activity creation according to current CRM audit conventions.
- Emit the same CRM update/broadcast event used by normal activity creation so open Lead detail pages refresh their activity timeline.
- Do not invoke email delivery; an `EMAIL` activity log records the action but does not send an email.

---

## Frontend implementation

### Task 6: Add explicit import mode selection

Files:
- Modify: `frontend/pages/CrmImportExport.tsx`
- Modify: `frontend/src/services/crm.service.ts`

UI:
- Add a mode selector for Lead imports:
  - `Create new Leads`
  - `Add activities to existing Leads`
- Explain the update mode clearly: “Only adds activity logs. It does not overwrite Lead fields.”
- Pass the selected mode during upload.
- Load the appropriate field definitions and template.

### Task 7: Add activity-update template download

Files:
- Modify: `frontend/pages/CrmImportExport.tsx`
- Modify: `frontend/src/services/crm.service.ts`
- Backend template handler/service from Tasks 1–3

Template columns:
- `Lead ID`
- `Activity Type`
- `Activity Subject`

Template guidance should include an example row:
- `EMAIL`
- `EMAIL SENT`

The existing general Lead template remains available and unchanged except for the already-added optional new-Lead activity fields.

### Task 8: Update mapping and completion results

Files:
- Modify: `frontend/pages/CrmImportExport.tsx`
- Modify: `frontend/src/services/crm.service.ts`

Changes:
- Map `Lead ID` automatically from the attached export.
- Display validation errors with spreadsheet row numbers.
- Display activity-specific completion results, for example:
  - Activities created: N
  - Skipped: N
  - Failed: N
- Explain that an existing Lead record was not overwritten.
- Preserve the existing duplicate result UI for normal new-Lead imports.

---

## Tests

### Backend tests

Modify/add tests in:
- `backend/src/__tests__/crm-import.integration.test.ts`

Required cases:
1. Activity-update template exposes exactly the required update columns.
2. Exported workbook headers map `Lead ID` automatically.
3. Valid existing Lead ID + `EMAIL` + `EMAIL SENT` creates one linked `CrmActivity`.
4. Existing Lead fields remain unchanged after activity update.
5. Unknown Lead ID fails with the original spreadsheet row number.
6. Deleted Lead ID fails.
7. Lead outside the caller's visibility scope fails.
8. Missing Activity Type or Activity Subject fails validation.
9. Invalid Activity Type fails validation.
10. Re-executing the completed import job is rejected.
11. A mixed file reports successful activity rows and failed rows separately.
12. Normal new-Lead import still creates an activity when the two existing optional activity fields are supplied.
13. Normal duplicate Lead import still skips the row and does not append an activity.

### Frontend tests

Use the frontend's configured test runner and add coverage for:
- Mode selector behavior.
- Update-mode upload request includes the selected mode.
- Update-mode result renders activities created/skipped/failed.
- Normal import result behavior remains intact.

---

## Verification commands

From `backend/`:

```bash
npm run build
npm test -- --runInBand src/__tests__/crm-import.integration.test.ts
```

From `frontend/`:

```bash
npm run build
```

Repository checks:

```bash
git diff --check
git status --short
```

Manual verification:
- Use a copy of the attached workbook.
- Add the three update columns and one test row.
- Run update mode as an authorized CRM user.
- Confirm the Lead's activity timeline contains the new activity.
- Confirm Lead title, status, owner, contact, and company fields are unchanged.
- Confirm an unauthorized Lead ID is rejected.

## Out of scope

- Updating arbitrary Lead fields from an exported workbook.
- Sending real email when `Activity Type=EMAIL`.
- Deduplicating identical activities across separate import jobs.
- Bulk editing Lead status, owner, or contact details.
- Automatically inferring Lead identity from email or phone in activity-update mode.

## Open product decision

Use a dedicated explicit mode named `Add activities to existing Leads`, keyed by `Lead ID`, with activity-only writes. This is the recommended option because it minimizes accidental changes from stale exports.
