# Scorecard Governed Activation Implementation Plan

> For Hermes: execute this plan task-by-task with fresh verification after each task.

**Goal:** Replace the non-functional scorecard Activate action with a complete, auditable maker/checker lifecycle that supports draft creation, approval, activation, and safe UI feedback.

**Architecture:** A scorecard version is created as `DRAFT` and remains inactive. A separate approval action records the first approver. A different authenticated credit administrator activates the approved version. Activation and parent-scorecard activation happen atomically, and the existing fail-closed scoring behavior remains unchanged until activation.

**Tech Stack:** Express + TypeScript, Prisma/PostgreSQL, React 19 + TypeScript, Axios, Jest, Vitest.

---

## Current evidence and root cause

- `frontend/pages/ScorecardManagement.tsx` renders Activate for every inactive version.
- `frontend/src/services/credit.service.ts` calls `POST /credit/scorecard-versions/:id/activate`.
- `backend/src/credit/routes/scorecardVersion.routes.ts` exposes only the activation route.
- `backend/src/credit/services/scorecard.service.ts:254` rejects activation when `approvedById` is null and requires a different second approver.
- The draft baseline generator intentionally creates:
  - `approvedById = null`
  - `approvedAt = null`
  - scorecard `isActive = false`
  - version `isActive = false`
- The frontend catches the rejected request with `console.error()` only, so the user sees an apparent stuck action.

The existing scorecard page is therefore not a network hang. It is a missing approval lifecycle plus an inadequate error state.

---

## Scope

### In scope

- Persist version creator identity for maker/checker enforcement.
- Add a governed approval endpoint and service method.
- Make activation require an approved version and a different checker.
- Activate the parent scorecard atomically with the version.
- Return explicit lifecycle state to the frontend.
- Replace the impossible Activate action with an approval-aware UI.
- Add audit events and regression tests.
- Provide a safe path for the existing system-created draft baseline.

### Out of scope

- Changing score thresholds, factor weights, DSR/LTV policies, or credit decision rules.
- Activating production credit configuration automatically.
- Re-enabling static rating fallback in production.
- Changing rating-band lifecycle; its existing DRAFT → SUBMITTED → APPROVED → ACTIVE workflow remains separate.
- Broad scorecard redesign or unrelated Credit UI changes.

---

## Required lifecycle contract

| State | Required data | Allowed next action |
|---|---|---|
| DRAFT | `isActive = false`, no approval | Submit/approve by an authorized maker/checker according to policy |
| APPROVED | `approvedById` and `approvedAt` present, `isActive = false` | Activate by a different credit administrator |
| ACTIVE | `isActive = true`, parent scorecard active | Deactivate through the existing controlled path |

Because the current database has no version `status` column, the first implementation may derive status from `approvedById` and `isActive`. If product wants explicit `SUBMITTED` or `REJECTED` states later, add them in a separate migration rather than overloading activation behavior.

For legacy/system-created drafts whose creator is unknown, allow an authorized administrator to approve them while recording the approval actor. Activation must still require a different administrator. Do not set `approvedById` from a client-supplied field during version creation.

---

## Task 1: Add creator provenance to scorecard versions

**Objective:** Record who created a version so future approval checks cannot rely on client-supplied approval fields.

**Files:**
- Modify: `backend/prisma/schema.prisma` — `CreditScorecardVersion`
- Create: `backend/prisma/migrations/YYYYMMDDHHMMSS_scorecard_version_governance/migration.sql`
- Modify: `backend/src/credit/services/scorecard.service.ts`
- Modify: `backend/src/credit/controllers/scorecard.controller.ts`
- Modify: `backend/src/credit/routes/scorecard.routes.ts`
- Modify: `backend/src/credit/services/__tests__/scorecard.activate.test.ts`

**Changes:**

- Add nullable `createdById` mapped to `created_by_id` with a relation to `User`.
- Keep it nullable for existing production rows and system-generated draft baselines.
- Set it from `req.user.id` in `createVersion`; ignore any incoming `approvedById` from the request body.
- Include `createdBy` in version list/detail responses.
- Keep `approvedById` and `approvedAt` writeable only through the new approval service method.

**Verification:**

- Run `npx prisma generate`.
- Run `npm run build` from `backend/`.
- Verify the migration is additive and does not require a data backfill.

---

## Task 2: Implement the approval command

**Objective:** Add an authenticated, permission-checked approval step before activation.

**Files:**
- Modify: `backend/src/credit/services/scorecard.service.ts`
- Modify: `backend/src/credit/controllers/scorecard.controller.ts`
- Modify: `backend/src/credit/routes/scorecardVersion.routes.ts`
- Modify: `backend/src/credit/validators/scorecard.validator.ts` if a body schema is required
- Create/modify: `backend/src/credit/services/__tests__/scorecard.approval.test.ts`
- Modify: `backend/src/credit/__tests__/creditRbac.test.ts` or the nearest scorecard route RBAC test

**Endpoint:**

`POST /api/v1/credit/scorecard-versions/:id/approve`

**Rules:**

- Requires authentication and `credit:admin`.
- Loads the version and returns 404 when missing.
- Rejects an already active version.
- Rejects a version that is already approved unless the operation is explicitly idempotent.
- Sets `approvedById` to the authenticated user and `approvedAt` to the current time.
- Does not accept `approvedById` from the request body.
- Records a scorecard governance audit event with version ID, approver ID, and prior lifecycle state.
- For a legacy/system-created draft with `createdById = null`, approval is allowed but activation still requires a different authenticated administrator.

**Tests:**

- Unauthenticated request rejected.
- Non-admin request rejected.
- Missing version returns 404.
- Draft approval records the authenticated approver.
- Client-supplied approval identity is ignored.
- Already approved/active behavior is deterministic.
- Audit event is emitted with no sensitive payload.

---

## Task 3: Harden activation and parent scorecard state

**Objective:** Make activation atomic, approval-aware, and consistent with scorecard selection.

**Files:**
- Modify: `backend/src/credit/services/scorecard.service.ts`
- Modify: `backend/src/credit/controllers/scorecard.controller.ts`
- Modify: `backend/src/credit/services/__tests__/scorecard.activate.test.ts`
- Create/modify: `backend/src/credit/__tests__/scorecard.governance.test.ts`

**Rules:**

- Require `approvedById` and `approvedAt`.
- Require the authenticated checker to differ from `approvedById`.
- If `createdById` exists, reject activation by the creator as an additional segregation-of-duties guard.
- Reject activation if a different scorecard already has an active version.
- In one Prisma transaction:
  1. Deactivate any active version on the same scorecard.
  2. Activate the selected version.
  3. Set the parent `CreditScorecard.isActive = true`.
  4. Record the activation audit event using the transaction client.
- Preserve the current active version if any validation fails.
- Ensure `deactivateVersion` leaves the parent scorecard inactive only when it has no active versions.
- Return the updated version and parent scorecard state.

**Regression tests:**

- No approval → 409 and no writes.
- Same approver attempts activation → 409 and no writes.
- Creator attempts activation when creator provenance exists → 409.
- Different checker activates successfully.
- Parent scorecard becomes active in the same transaction.
- Conflicting active scorecard is rejected without deactivating the current active version.
- Transaction rollback leaves version and parent state unchanged.

---

## Task 4: Add stable frontend lifecycle types and API methods

**Objective:** Keep the frontend contract explicit and stop relying on inferred status from incomplete fields.

**Files:**
- Modify: `frontend/src/services/credit.service.ts`
- Modify: `frontend/pages/ScorecardManagement.tsx`
- Create/modify: `frontend/src/services/__tests__/credit.service.test.ts` if the service test harness covers this module

**Changes:**

- Extend `CreditScorecardVersion` with:
  - `createdById: string | null`
  - `createdBy?: CreditUserRef | null`
  - `lifecycleStatus: 'DRAFT' | 'APPROVED' | 'ACTIVE'`
- Normalize the backend response in `listVersions()`.
- Add:
  - `scorecardApi.approveVersion(versionId)`
  - existing `activateVersion(versionId)` retained
- Preserve backend error messages from Axios responses.

**Tests:**

- Raw backend response with null creator/approver normalizes to `DRAFT`.
- Approved inactive response normalizes to `APPROVED`.
- Active response normalizes to `ACTIVE`.
- Approval and activation use the exact endpoint paths and HTTP methods.

---

## Task 5: Replace the impossible Activate action in the UI

**Objective:** Make the scorecard page accurately reflect what the current user can do.

**Files:**
- Modify: `frontend/pages/ScorecardManagement.tsx`
- Create/modify: `frontend/pages/__tests__/ScorecardManagement.test.tsx`

**UI behavior:**

- `DRAFT` with no approver:
  - Show `Approval required` or `Approve` according to the current admin policy.
  - Do not render an Activate button.
- `APPROVED` and inactive:
  - Render Activate.
  - Show approver identity and approval timestamp.
- `ACTIVE`:
  - Show Active and no Activate action.
- Any failed request:
  - Clear the loading state.
  - Show the server error in an accessible `role="alert"` region.
  - Show a toast notification.
- Successful approval/activation:
  - Refresh versions and scorecards.
  - Show a success toast.
- Keep confirmation before activation.

**Tests:**

- Draft with `approvedById = null` shows `Approval required` and no activation request can be triggered.
- Approved inactive version shows Activate.
- Activation failure renders the server message and does not leave the button stuck in `Activating...`.
- Successful activation refreshes the version list.

---

## Task 6: Add an explicit legacy/system-draft handling path

**Objective:** Make the existing generated baseline operable without weakening maker/checker controls.

**Files:**
- Modify: `backend/src/credit/services/scorecard.service.ts`
- Modify: `frontend/pages/ScorecardManagement.tsx`
- Create/modify: `backend/src/credit/services/__tests__/scorecard.approval.test.ts`

**Behavior:**

- Existing draft baseline has `createdById = null` and `approvedById = null`.
- An authorized admin may approve it through the approval endpoint.
- A second, different authorized admin must activate it.
- The UI must explain that a second approver is required after approval.
- Do not set the scorecard/version active during approval.
- Do not use a seed, direct SQL update, or client payload to bypass approval.

**Acceptance check:**

- One admin approves the baseline.
- A different admin activates it.
- Parent scorecard becomes active.
- Exactly one active scorecard version exists.
- Rating-band configuration remains separately governed.

---

## Task 7: Verification and rollout gates

**Local verification:**

1. `npx prisma generate` from `backend/`.
2. `npm run build` from `backend/`.
3. `npm run test -- --runInBand src/credit/services/__tests__/scorecard.activate.test.ts src/credit/services/__tests__/scorecard.approval.test.ts src/credit/__tests__/scorecard.governance.test.ts`.
4. `npm run build` from `frontend/`.
5. Relevant frontend Vitest tests.
6. `git diff --check`.
7. Verify the local draft baseline remains inactive before testing approval.

**Staging gate:**

- Take a database backup.
- Apply only the schema migration.
- Verify existing scorecard versions and approval fields.
- Test approval with one admin identity and activation with a distinct admin identity.
- Verify audit events and rollback behavior.
- Verify scoring uses the activated scorecard only.

**Production gate:**

- Do not activate the draft baseline automatically.
- Take a fresh production backup immediately before any approval/activation data write.
- Confirm the proposed factor weights, rating bands, and required-field rules remain the intended candidate baseline.
- Execute approval and activation as two separately authenticated actions.
- Verify configuration health, active-version uniqueness, audit records, and a controlled assessment.
- Roll back the configuration state—not merely the Docker image—if the controlled assessment fails.

---

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Client forges `approvedById` | Ignore request field; set only from authenticated approval endpoint |
| Same admin approves and activates | Require distinct approval and activation actors |
| Parent scorecard remains inactive | Update parent and version atomically |
| Existing system draft has no creator | Allow explicit admin approval with null creator, still require a distinct checker |
| UI appears stuck after API rejection | Render server error and clear `activating` in `finally` |
| Existing active methodology is replaced unexpectedly | Require confirmation, check cross-scorecard conflict, preserve current state on failure |
| Migration checksum conflict | Add only a new migration; do not edit historical migrations |
| Production policy is activated without review | Keep draft/inactive states and require separate approval/activation actions |

---

## Acceptance criteria

- A draft version cannot be activated without approval.
- The frontend never presents an impossible Activate action for an unapproved version.
- Activation errors are visible to the user.
- Approval and activation are separate authenticated operations.
- The two actors are different.
- Parent scorecard and active version state remain consistent.
- Audit events identify approval and activation actors.
- Existing production scoring remains fail-closed until deliberate activation.
- No historical migration files are rewritten.

---

## Execution status — 2026-08-30

Implemented and verified locally:

- Creator provenance, additive migration, maker/checker approval and activation gates.
- Separate authenticated approval endpoint with platform audit event.
- Atomic parent scorecard/version activation and deactivation consistency.
- Frontend Draft/Approved/Active lifecycle adapter and approval-aware actions.
- Legacy/system-created drafts remain inactive and require explicit approval.
- Operation-control registry and RBAC parity updated.
- Backend: 270 suites, 2,614 tests passed.
- Frontend: 115 test files, 610 tests passed.
- Backend and frontend production builds passed.
- Local Prisma migration status: database schema up to date.

Intentionally not performed: production deployment, commit, or push. Those remain separate release gates requiring explicit approval.
