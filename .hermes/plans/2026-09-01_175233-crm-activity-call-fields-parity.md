# CRM Activity Call-Field Parity Rectification Plan

> **For Hermes:** Use the subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Ensure every CRM record activity form captures and preserves call category and call outcome consistently for call-related activities.

**Architecture:** Use the existing Lead activity form as the behavioral reference. Bring the Account, Contact, and Opportunity activity create/edit forms to the same conditional-field contract without changing the API, validators, Prisma schema, or database. Keep each page’s existing visual styling and local state architecture to minimize regression risk; only shared behavior and payload semantics need to converge.

**Tech Stack:** React 19, TypeScript, Vitest, React Testing Library, Axios CRM service, Express/Zod/Prisma.

---

## Findings and Scope

### Existing source of truth

`frontend/pages/CrmLeadDetail.tsx` already implements the intended behavior:

- `CALL` and `FOLLOW_UP` activities show Call category and Call outcome.
- Call category supports `NEW_CALL` and `FOLLOW_UP_CALL`.
- Call outcome supports:
  - `ANSWERED`
  - `NO_ANSWER`
  - `NOT_INTERESTED`
  - `WRONG_NUMBER`
  - `NOT_REACHABLE`
  - `INTERESTED`
- The selected values are submitted as part of the existing activity payload.

### Gaps found

1. `frontend/pages/CrmOpportunityDetail.tsx`
   - Add Activity modal only renders Type, Subject, and Description.
   - Edit Activity modal also omits Call category and Call outcome.
2. `frontend/pages/CrmAccountDetail.tsx`
   - Add Activity modal omits Call category and Call outcome.
   - Edit Activity modal omits Call category and Call outcome.
3. `frontend/pages/CrmContactDetail.tsx`
   - Add Activity modal omits Call category and Call outcome.
   - Edit Activity modal omits Call category and Call outcome.
4. The three affected pages initialize activity forms with only `{ activityType: 'CALL' }`, unlike the Lead page’s call-category-aware initialization.
5. The backend already accepts all fields in `backend/src/validators/crm.validator.ts:222-243`; no backend contract change is required.
6. `frontend/pages/CrmOpportunityDetail.tsx` supports creating and displaying notes, but does not expose Edit or Delete controls.
7. The shared notes service and backend already support note update/delete, with `crm:write` plus note-author ownership enforcement; the Opportunity Add Note button is not currently permission-gated.

### In scope

- Activity create and edit forms for Leads, Accounts, Contacts, and Opportunities.
- Conditional rendering and state handling for call category/outcome.
- Clearing irrelevant call fields when switching to a non-call activity type.
- Opportunity note edit/delete parity with the existing backend contract.
- Permission- and author-aware Opportunity note controls and Add Note gating.
- Tests proving fields render, update state, and reach `createActivity`/`updateActivity` payloads, plus Opportunity note CRUD interactions.

### Out of scope

- New activity types or new outcome enum values.
- Changes to backend routes, Zod schemas, Prisma models, migrations, or database data.
- Redesigning modal layouts or extracting a shared modal component.
- Changing the Lead page’s existing behavior except to add regression coverage if needed.
- Changing note, document, or activity permission behavior unrelated to these fields.

---

## Product and Payload Contract

### Field visibility

- For `CALL` and `FOLLOW_UP`:
  - Show Call category.
  - Show Call outcome.
- For all other activity types:
  - Hide both call fields.
  - Remove stale call values from the form state before submission.

### Defaults

- New `CALL` activity:
  - `callCategory: 'NEW_CALL'`
  - `callOutcome: undefined` / empty selection
- New `FOLLOW_UP` activity:
  - `callCategory: 'FOLLOW_UP_CALL'`
  - `callOutcome: undefined` / empty selection
- Existing activity edit forms should initialize from the saved activity values and preserve null/empty values as an unselected option.

### Payload rules

- Create and update calls must include selected `callCategory` and `callOutcome` for call-related activities.
- Do not send call-specific fields for non-call activity types.
- Preserve each page’s existing relationship field:
  - Lead: `leadId`
  - Account: `accountId`
  - Contact: `contactId`
  - Opportunity: `opportunityId`
- Preserve existing scheduling, duration, email, meeting, and engagement fields.

### Opportunity note CRUD contract

- Keep existing note creation through `crmService.createNote({ content, opportunityId })`.
- Gate the Opportunity Add Note affordance with `hasPermission(user, 'crm:write')`.
- Expose Edit and Delete only when the current user has `crm:write` and `note.authorId === user?.id`.
- Edit sends only `{ content }` through `crmService.updateNote(note.id, { content })`.
- Delete requires explicit confirmation and calls `crmService.deleteNote(note.id)`.
- Refresh the Opportunity after a successful update/delete; failed mutations keep the note and dialog state intact.
- Do not add an admin override because the backend currently permits only the note author to edit/delete.

---

## Implementation Tasks

### Task 1: Establish a page-local call-field state pattern

**Objective:** Make each affected activity form track call-specific fields with correct defaults and reset behavior.

**Files:**
- Modify: `frontend/pages/CrmAccountDetail.tsx:97-100, 187-236`
- Modify: `frontend/pages/CrmContactDetail.tsx:492-494, 593-621`
- Modify: `frontend/pages/CrmOpportunityDetail.tsx:106-116, 269-318`

**Steps:**
1. Update new-activity form initialization to use the same call-aware default as the Lead page, or centralize a small local helper in each page if required by existing state conventions.
2. When the activity type changes:
   - set the new type;
   - default `callCategory` to `NEW_CALL` for `CALL`;
   - default `callCategory` to `FOLLOW_UP_CALL` for `FOLLOW_UP`;
   - clear `callCategory` and `callOutcome` for all other types.
3. Update edit-form initialization to copy `callCategory` and `callOutcome` from the existing activity.
4. When editing an activity and changing away from `CALL`/`FOLLOW_UP`, clear those fields before submission.
5. Keep existing `activityForm` and `editActivityForm` types; `CrmActivity` already exposes the supported fields.
6. Do not coerce an empty call outcome into a fake enum value. Preserve the existing optional backend contract.

### Task 2: Add conditional call fields to Account activity modals

**Objective:** Bring Account Add Activity and Edit Activity forms to parity with Lead behavior.

**Files:**
- Modify: `frontend/pages/CrmAccountDetail.tsx:844-938`

**Steps:**
1. After the Type select in the Add Activity modal, render Call category and Call outcome when `activityForm.activityType` is `CALL` or `FOLLOW_UP`.
2. Use the existing Account modal labels, border, spacing, and typography.
3. Add an empty `Select outcome` option for call outcome.
4. Add the two call-category options with user-friendly labels (`New call`, `Follow-up call`).
5. Add the six existing call-outcome options using the Lead labels.
6. Add the same conditional fields to the Edit Activity modal using `editActivityForm`.
7. Ensure changing Type updates the conditional fields and clears stale values as defined in Task 1.
8. Verify Account’s existing schedule, completion, duration, and note flows remain unchanged.

### Task 3: Add conditional call fields to Contact activity modals

**Objective:** Bring Contact Add Activity and Edit Activity forms to parity with Lead behavior.

**Files:**
- Modify: `frontend/pages/CrmContactDetail.tsx:1177-1214`
- Modify: `frontend/pages/CrmContactDetail.tsx:492-621` for state/handler behavior

**Steps:**
1. Add conditional Call category and Call outcome fields to the Add Activity modal.
2. Add the same fields to the Edit Activity modal.
3. Preserve the Contact page’s existing design-token classes and modal behavior.
4. Ensure saved activity values are preselected during edit.
5. Ensure non-call activity types hide and clear call-specific values.
6. Preserve the Contact relationship payload and existing activity edit/delete behavior.

### Task 4: Add conditional call fields to Opportunity activity modals

**Objective:** Correct the reported Opportunity gap for both creating and editing activities.

**Files:**
- Modify: `frontend/pages/CrmOpportunityDetail.tsx:269-318` for state/handler behavior
- Modify: `frontend/pages/CrmOpportunityDetail.tsx:1049-1086` for Add Activity UI
- Modify: `frontend/pages/CrmOpportunityDetail.tsx:1269-1323` for Edit Activity UI

**Steps:**
1. Add Call category and Call outcome to the Add Activity modal after Type and before Subject, matching the Lead form’s order.
2. Add the fields to the Edit Activity modal in the same position.
3. Initialize a new Opportunity CALL activity with `NEW_CALL` and no outcome selected.
4. Initialize an edited activity from its persisted call fields.
5. Clear call-specific state when switching to non-call types.
6. Confirm the existing `createActivity({ ...activityForm, opportunityId: id })` and edit payloads forward the values without adding a second API path.

### Task 5: Add Opportunity note edit/delete parity

**Objective:** Complete the Opportunity Notes tab so it supports the same author-owned note CRUD behavior already available through the backend and implemented on the Lead page.

**Files:**
- Modify: `frontend/pages/CrmOpportunityDetail.tsx:104-121, 282-293` for note state and handlers.
- Modify: `frontend/pages/CrmOpportunityDetail.tsx:943-962` for note-card controls.
- Modify: `frontend/pages/CrmOpportunityDetail.tsx:1088-1110` for the edit modal and delete confirmation.

**Steps:**
1. Add state for the selected note being edited, edit content, selected note pending deletion, and delete-dialog visibility.
2. Add an edit handler that validates non-whitespace content, calls `crmService.updateNote(note.id, { content })`, closes/clears state only after success, and reloads the Opportunity after the mutation succeeds.
3. Add a delete handler that calls `crmService.deleteNote(note.id)`, closes/clears state only after success, and reloads the Opportunity after deletion.
4. Preserve the existing error and `saving` conventions; failed mutations must leave the note and active dialog intact.
5. Gate the Add Note button with `hasPermission(user, 'crm:write')`.
6. Add Edit and Delete buttons to each note card only when the current user has `crm:write` and is the note author.
7. Add an Edit Note modal prepopulated with the current content and a Save Changes action.
8. Add a `ConfirmDialog` with explicit destructive wording and loading state.
9. Do not change the existing note API, backend ownership rule, or note display format.

### Task 6: Add regression tests for all affected record pages

**Objective:** Prove UI parity and prevent the fields from disappearing from any CRM record activity form.

**Files:**
- Modify: `frontend/src/__tests__/CrmOpportunityDetail.test.tsx`
- Modify or create: `frontend/src/__tests__/CrmAccountDetail.test.tsx`
- Modify or create: `frontend/src/__tests__/CrmContactDetail.test.tsx`
- Review: `frontend/src/__tests__/CrmLeadDetail.test.tsx`

**Test setup:**
1. Extend each CRM service mock with `createActivity` and `updateActivity` where missing.
2. Add mutable activity mock functions and reset them in `beforeEach`.
3. Provide activity fixtures containing `activityType`, `callCategory`, `callOutcome`, relationship IDs, subject, description, and existing scheduling fields as required by each page.
4. Use the existing Vitest conventions in each test file; do not convert the test runner or introduce a new testing framework.

**Tests per page:**

1. Add Activity modal for `CALL`:
   - shows Call category and Call outcome;
   - defaults category to `New call`;
   - includes the expected outcome options.
2. Add Activity modal for `FOLLOW_UP`:
   - shows both call fields;
   - defaults category to `Follow-up call`.
3. Add Activity modal for a non-call type:
   - hides both call fields;
   - does not submit stale call fields.
4. Submit a CALL activity:
   - selects category and outcome;
   - asserts `createActivity` receives both values plus the correct relationship ID.
5. Edit an existing CALL activity:
   - opens the edit modal from the existing activity action;
   - asserts persisted category/outcome are selected;
   - changes them and asserts `updateActivity` receives the new values.
6. Edit and switch to a non-call type:
   - asserts call-specific values are omitted or cleared from the update payload according to the existing payload-cleaning convention.

**Opportunity note tests:**

1. An authored note renders Edit note and Delete note controls for a user with `crm:write`.
2. Edit opens with existing content and calls `updateNote` with the Opportunity note ID and changed content.
3. Delete opens confirmation and calls `deleteNote` only after confirmation.
4. Canceling edit or delete does not call a mutation service.
5. A different author cannot see the controls, even with `crm:write`.
6. A user without `crm:write` cannot see Add Note, Edit, or Delete controls.

**Lead coverage:**
- Confirm the existing Lead tests remain green.
- Add only missing call-field assertions if the current Lead suite does not already cover the established behavior.

**TDD sequence:**
1. Add one focused failing test per behavior group before changing the corresponding page.
2. Run the focused test and confirm it fails for the missing UI/payload behavior.
3. Implement the smallest page-local change.
4. Re-run the focused test until it passes.
5. Continue page by page and retain all existing tests.

### Task 7: Run contract, type, build, and scope verification

**Objective:** Verify all four CRM record surfaces use the same call-field contract and no unrelated behavior changed.

**Commands:**

From `frontend/`:

```bash
npx vitest run \
  src/__tests__/CrmLeadDetail.test.tsx \
  src/__tests__/CrmOpportunityDetail.test.tsx \
  src/__tests__/CrmAccountDetail.test.tsx \
  src/__tests__/CrmContactDetail.test.tsx

npx tsc --noEmit
npm run build
```

From the repository root:

```bash
git diff --check
git status --short
git diff --stat
```

**Acceptance checks:**

- Lead, Account, Contact, and Opportunity Add Activity forms expose call fields for `CALL` and `FOLLOW_UP`.
- All four Edit Activity forms preserve and update those fields.
- Non-call activity types do not display or submit stale call fields.
- Opportunity notes support author-owned Edit and Delete actions with confirmation.
- Opportunity Add Note, Edit, and Delete controls are hidden without `crm:write` or when the current user is not the note author.
- Create payloads use the correct parent relationship ID.
- Update payloads preserve existing fields while changing only the intended values.
- Backend validator compatibility is confirmed against `crm.validator.ts`; no API/schema changes are introduced.
- Focused CRM tests pass, TypeScript passes, production build passes, and diff checks are clean.
- Existing Vite warnings, if present, are reported separately from failures.

## Risks and Tradeoffs

- The activity modals are duplicated across legacy detail pages. Local parity changes are lower risk than a broad shared-modal extraction, but they require four surfaces to stay synchronized.
- Clearing call fields on type changes prevents stale data from being silently persisted under an unrelated activity type.
- The backend fields are optional, so the current omission does not cause a request failure; tests must assert payload contents, not only successful submission.
- Do not mark Call outcome required unless product explicitly decides that every call must have a recorded outcome; the current backend and Lead UI treat it as optional.
- Keep the Lead implementation as the behavioral reference, but preserve the visual language of each page rather than copying styling wholesale.

## Expected File Scope

- `frontend/pages/CrmLeadDetail.tsx` — only if adding missing regression assertions requires no production change.
- `frontend/pages/CrmAccountDetail.tsx`
- `frontend/pages/CrmContactDetail.tsx`
- `frontend/pages/CrmOpportunityDetail.tsx`
- `frontend/src/__tests__/CrmLeadDetail.test.tsx` — only if coverage is incomplete.
- `frontend/src/__tests__/CrmAccountDetail.test.tsx`
- `frontend/src/__tests__/CrmContactDetail.test.tsx`
- `frontend/src/__tests__/CrmOpportunityDetail.test.tsx`

No backend or Prisma files should change.
