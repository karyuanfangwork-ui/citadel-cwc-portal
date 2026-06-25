# Credit Assessment Gap Remediation Implementation Plan

Goal: Close the production-blocking and high-risk gaps identified in `docs/2026-06-24-credit-assessment-module-audit-gap-analysis.md`, prioritizing a safe controlled pilot for generic personal + SME financing before broader Malaysian non-bank product expansion.

Architecture: Implement this as phased remediation, not one giant refactor. First harden document security, real upload lifecycle, approval authority, and row-level scoping. Then add immutable decision packets and audit-chain reconstruction. Finally mature financial/risk controls, borrower party management, CA memo versioning, reporting, and product-specific capabilities.

Tech Stack: Backend Node.js + Express + TypeScript + Prisma + PostgreSQL; frontend React 19 + TypeScript + Vite; tests via backend Jest and frontend build/Vitest where available.

Implementation principle: Each audit item must be re-verified against current code immediately before implementation. Do not assume the audit line numbers are still exact. Search/read live files first, then write tests, then implement.

---

## Non-Negotiable Scope Decisions

These are the assumptions to proceed unless the user overrides them before implementation:

1. Launch scope
   - In scope for remediation: generic personal financing + generic SME term/revolving workflow.
   - Out of scope for first remediation pass: HP, leasing, factoring, cooperative-specific models.
   - Reason: current schema is generic LOS foundation; product-specific models require business policy and larger design.

2. Approval matrix no-match policy
   - Default: no approval matrix match hard-blocks submission/approval everywhere.
   - No silent fallback to one approval.
   - Any fallback policy must be explicit and separately approved.

3. Conditional approval policy
   - Conditional approval counts as an approving decision only when the required approval threshold is met.
   - The application/facility cannot proceed to disbursement/finalization while open conditions remain unresolved.

4. Document AV policy
   - Downloads require explicit clean AV status.
   - Null, pending, failed, infected, or unavailable AV status blocks user download.
   - Any privileged override must be permission-gated and audited.

5. Row-level scope policy
   - Admin/credit managers: broad credit scope.
   - Branch managers: branch scope.
   - RM/officer: assigned applications and borrowers.
   - Approvers/committee: only items requiring their authority or explicitly assigned to them.
   - Scope enforcement must be server-side.

6. Audit/versioning policy
   - Approval decisions must reference an immutable decision packet.
   - Audit events must become append-only and hash-verifiable.

---

## Phase 0 — Codebase Re-Verification and Test Inventory

Objective: Confirm the audit findings against live code and identify exact test hooks before changing behavior.

Files to inspect:
- `backend/prisma/schema.prisma`
- `backend/src/credit/routes/creditDocument.routes.ts`
- `backend/src/credit/middleware/assertBorrowerAccess.middleware.ts`
- `backend/src/credit/controllers/creditDocument.controller.ts`
- `backend/src/credit/services/creditDocument.service.ts`
- `backend/src/credit/services/approvalAction.service.ts`
- `backend/src/credit/services/creditApplication.service.ts`
- `backend/src/credit/services/creditDashboard.service.ts`
- `backend/src/credit/services/submissionReadiness.service.ts`
- `backend/src/credit/services/retailIncome.service.ts`
- `backend/src/credit/services/smeFinancial.service.ts`
- `backend/src/credit/services/financial.service.ts`
- `backend/src/credit/services/auditChain.service.ts`
- `frontend/pages/credit/CreditApplicationCreate.tsx`
- `frontend/src/components/credit/BulkDocumentUpload.tsx`
- `frontend/pages/credit/tabs/DocumentsTab.tsx`
- `frontend/pages/credit/CreditDashboard.tsx`
- `frontend/pages/CreditApplicationList.tsx`
- `frontend/pages/BorrowerProfileDetail.tsx`
- `frontend/pages/credit/tabs/sections/AuditTab.tsx`
- `frontend/pages/credit/tabs/CaMemoPreviewTab.tsx`
- `frontend/src/services/credit.service.ts`

Steps:
1. Run `git status --short` and `git branch --show-current` to capture current working tree.
2. Search for existing tests around credit document, approval matrix, application transition, audit chain, and readiness.
3. Read exact route/service implementations for all P0 items.
4. Produce a mini verification matrix before editing:
   - Finding
   - Current status: Confirmed / Already fixed / Different issue
   - Files involved
   - Test target
   - Implementation task ID

Exit criteria:
- No implementation starts until each P0 finding is mapped to exact files and test targets.

---

# Phase 1 — P0 Control Floor / Launch Blockers

Goal: Fix security, document lifecycle, approval bypass, and dead workflow issues required for controlled pilot.

Recommended order:
1. Document authorization and AV download block.
2. Bulk upload applicationId fix.
3. Real create-wizard document upload.
4. Approval authority/no-matrix consistency.
5. Conditional approval handling.
6. Row-level scoping for dashboard/reports/monitoring.
7. Dead UX/navigation cleanup.

---

## Task 1 — Document-Specific Authorization Middleware

Objective: Replace borrower-param-based document authorization with document-aware row-level authorization.

Problem:
- `/credit-documents/:id/download` has `id`, not `borrowerProfileId`.
- Existing `assertBorrowerAccess()` expects `req.params.borrowerProfileId`, so it cannot correctly authorize document downloads.
- List/get/update/delete routes also need document/application/borrower scope.

Likely files:
- Modify: `backend/src/credit/routes/creditDocument.routes.ts`
- Modify/Create: `backend/src/credit/middleware/assertCreditDocumentAccess.middleware.ts`
- Modify/Create: `backend/src/credit/services/creditScope.service.ts`
- Modify: `backend/src/credit/services/creditDocument.service.ts`
- Test: existing or new backend credit document access test under `backend/src/credit/**/__tests__/*.test.ts`

Implementation design:
1. Create a reusable credit scope service if one does not already exist:
   - `canAccessApplication(user, applicationId)`
   - `canAccessBorrower(user, borrowerProfileId)`
   - `canAccessDocument(user, documentId)`
   - `buildApplicationScopeWhere(user)` for list/report queries.
2. `canAccessDocument` resolves:
   - CreditDocument by id.
   - Its `applicationId` and/or `borrowerProfileId`.
   - Associated borrower/application branch/RM/assignment.
   - User permissions and scope.
3. Middleware variants:
   - `assertCreditDocumentAccess({ action: 'read' | 'update' | 'delete' | 'download' | 'verify' })`
   - `assertApplicationDocumentAccess` for application-level list/upload routes.
4. Apply to document routes before controller handlers.
5. Ensure deleted/soft-deleted documents are denied for get/download/update unless admin-specific restore flow exists.

TDD / tests:
1. Write failing tests for:
   - User with application assignment can download clean document.
   - Cross-branch/non-assigned user gets 403.
   - Admin/credit manager can access.
   - Missing/nonexistent document gets 404, not accidental allow.
   - Soft-deleted document cannot be downloaded.
2. Implement middleware and service.
3. Run targeted backend tests.

Acceptance criteria:
- Document access never depends on absent `borrowerProfileId` route param.
- All sensitive document routes have server-side scope checks.
- Unauthorized cross-scope access is denied.

---

## Task 2 — Enforce AV-Clean Downloads

Objective: Block document downloads unless AV status is explicitly clean.

Problem:
- Audit found unscanned documents may be downloadable if AV status is null.

Likely files:
- Modify: `backend/src/credit/services/creditDocument.service.ts`
- Modify: `backend/src/credit/controllers/creditDocument.controller.ts` if controller shapes error response
- Test: credit document service/controller tests

Implementation design:
1. Find existing AV status enum/field values in Prisma schema and service logic.
2. Define a single helper:
   - `assertDocumentDownloadable(document, user, options?)`
   - Checks not deleted, storage key exists, AV status clean.
3. Deny statuses:
   - null/undefined
   - PENDING
   - FAILED
   - INFECTED
   - ERROR
   - any non-clean enum/value.
4. If existing service-only/internal scan token flow needs access, keep separate service route, not normal user download.
5. Audit all successful downloads and denied privileged attempts if applicable.

TDD / tests:
1. Write failing tests for AV null/pending/failed download denial.
2. Write allowed test for explicit clean status.
3. Implement helper.
4. Run targeted tests.

Acceptance criteria:
- Normal users only download clean documents.
- Error message is clear: document is pending scan / not safe to download.

---

## Task 3 — Fix Bulk Document Upload Application ID

Objective: Ensure bulk uploads attach documents to the current application and refresh checklist state.

Problem:
- `BulkDocumentUpload` sends empty `applicationId`.

Likely files:
- Modify: `frontend/src/components/credit/BulkDocumentUpload.tsx`
- Modify: `frontend/pages/credit/tabs/DocumentsTab.tsx`
- Modify: `frontend/src/services/credit.service.ts` if request shape/type needs tightening

Implementation design:
1. Make `applicationId` a required prop for `BulkDocumentUpload`.
2. Pass current application id from `DocumentsTab`.
3. Fail fast in UI if missing application id.
4. Ensure upload payload includes application id and document class/category/requirement id where available.
5. After success, call existing refresh handlers for:
   - document list
   - requirements/checklist
   - readiness status if available.
6. Remove any fallback to `''` application id.

Tests / verification:
1. If frontend test infra has patterns for this component, add a test that upload service receives non-empty applicationId.
2. Run frontend build.
3. Manual Application 360 Documents tab smoke test after implementation.

Acceptance criteria:
- No request can be sent with `applicationId: ''`.
- Bulk uploaded docs show on the same application after refresh.
- Checklist reflects new uploads.

---

## Task 4 — Real Document Upload in Application Create Wizard

Objective: Replace filename-only wizard document step with backend-backed upload lifecycle.

Problem:
- Wizard records file names locally but does not create backend documents.

Likely files:
- Modify: `frontend/pages/credit/CreditApplicationCreate.tsx`
- Modify: `frontend/src/services/credit.service.ts`
- Backend may already support upload; inspect before modifying:
  - `backend/src/credit/controllers/creditDocument.controller.ts`
  - `backend/src/credit/services/creditDocument.service.ts`

Implementation design:
1. Inspect current create wizard flow to determine when applicationId exists.
2. Preferred approach:
   - Create/save draft application before document step if applicationId does not already exist.
   - Upload documents against draft applicationId during document step.
3. Wizard document state should store backend document metadata, not just file names:
   - document id
   - filename
   - category/class
   - requirement id
   - AV status
   - verification status
   - uploadedAt.
4. Document step completion should be derived from backend requirement/checklist response, not local selected files.
5. Submission should use backend readiness check; do not locally assume document completeness.
6. If draft creation fails, block document upload and show error.

TDD / tests:
1. Add service/component test if feasible:
   - Selecting file calls upload with real applicationId.
   - Completion is not true from filename alone.
2. Backend tests only if upload endpoint contract changes.
3. Manual E2E is mandatory because this is workflow-heavy.

Manual verification:
1. Start new application.
2. Reach document step.
3. Upload required docs.
4. Refresh browser or navigate away/back.
5. Confirm uploaded docs persist.
6. Submit application.
7. Confirm readiness/checklist sees backend documents.

Acceptance criteria:
- Wizard no longer shows document completion for local-only file names.
- Uploaded documents are persisted and linked to application/checklist.
- Refresh does not lose uploaded document state.

Risk:
- If create wizard currently creates the application only at final submit, this task needs careful draft-first change. Keep the draft API minimal and aligned with existing draft model.

---

## Task 5 — Canonical Approval Authority Service

Objective: Remove divergent no-matrix and approval authority behavior across actions, transitions, inbox, and dashboard.

Problem:
- Approval action path blocks no matrix.
- State transition path can default to one approval.
- Approval inbox can show no-matrix items.
- Route transition permission map diverges from service map.

Likely files:
- Modify/Create: `backend/src/credit/services/approvalAuthority.service.ts`
- Modify: `backend/src/credit/services/approvalAction.service.ts`
- Modify: `backend/src/credit/services/creditApplication.service.ts`
- Modify: `backend/src/credit/services/creditDashboard.service.ts` or approval inbox service
- Modify: `backend/src/credit/routes/creditApplication.routes.ts`
- Test: approval action/application transition/dashboard tests

Implementation design:
1. Create/normalize a canonical service with methods:
   - `lookupApprovalAuthority(application)`
   - `assertApprovalMatrixExists(application)`
   - `getRequiredApprovalCount(application)`
   - `getEligibleApprovers(application)`
   - `assertUserCanApprove(user, application)`
   - `getApprovalReadiness(application)`
2. Remove fallback from transition path.
3. Use same service in:
   - submit/transition into approval states
   - approval action create/submit
   - approval inbox query
   - dashboard counters/KPIs
   - readiness checks.
4. Ensure no-matrix application is either:
   - blocked before entering approval, or
   - shown as blocked remediation item only to admin/manager, not actionable to random approvers.
5. Consolidate route permission map with service map or export one constant used by both.

TDD / tests:
1. No matrix blocks transition into approval.
2. No matrix blocks approval action.
3. No matrix item excluded or flagged as blocked in approval inbox.
4. Board-band hard rule still applies.
5. SOD/maker-checker checks still apply.
6. Duplicate approval still blocked.
7. Eligible approver scope enforced.

Acceptance criteria:
- One authority lookup determines all approval paths.
- No matrix means hard block consistently.
- Approval inbox never shows actions the user cannot take.

---

## Task 6 — Conditional Approval Semantics

Objective: Prevent conditional approvals from getting stuck or bypassing condition controls.

Problem:
- Conditional approval counting is flawed/inconsistent.

Likely files:
- Modify: `backend/src/credit/services/approvalAction.service.ts`
- Modify: `backend/src/credit/services/creditApplication.service.ts`
- Possibly modify schema if condition model is insufficient:
  - `backend/prisma/schema.prisma`
- Frontend visibility if current UI lacks conditions:
  - Application 360 approval/conditions components

Implementation design:
1. Re-verify existing condition models before schema changes.
2. If adequate condition model exists, reuse it. Otherwise add minimal model for approval conditions:
   - applicationId
   - approvalDecisionId
   - conditionType
   - description
   - status: OPEN / SATISFIED / WAIVED / REJECTED
   - dueDate optional
   - createdBy / createdAt
   - resolvedBy / resolvedAt
3. Counting policy:
   - APPROVED counts as approval.
   - CONDITIONALLY_APPROVED counts toward approval threshold but creates open conditions.
   - REJECTED blocks/rejects according to existing policy.
4. State policy:
   - If approval threshold reached and open conditions exist: application becomes CONDITIONALLY_APPROVED or equivalent state.
   - Disbursement/finalization blocked until conditions satisfied/waived.
5. Audit all condition status changes.

TDD / tests:
1. Approve + conditional reaches threshold and creates/keeps open conditions.
2. Conditional + conditional reaches threshold where policy allows.
3. Open condition blocks disbursement/finalization.
4. Satisfied/waived condition allows next step.
5. Rejected decision still blocks as expected.

Acceptance criteria:
- Conditional approvals have clear lifecycle.
- No stuck approval state.
- No movement to final/disbursement with unresolved conditions.

---

## Task 7 — Row-Level Scoping for Dashboard, Reports, Monitoring

Objective: Prevent broad data leakage and make dashboard/report numbers match user scope.

Problem:
- Dashboard/report routes generally require broad `credit:read` but do not consistently scope by RM/branch/authority.

Likely files:
- Modify/Create: `backend/src/credit/services/creditScope.service.ts`
- Modify: `backend/src/credit/services/creditDashboard.service.ts`
- Modify: report service files under `backend/src/credit/services/` or `backend/src/services/`
- Modify: dashboard/report routes if middleware needed
- Test: dashboard/report/exposure service tests

Implementation design:
1. Build canonical `buildCreditApplicationScopeWhere(user)` returning Prisma `where` conditions.
2. Add related helpers for borrowers/documents/exposure.
3. Apply scope at DB query level to:
   - dashboard KPIs
   - work queue
   - alerts
   - activity feed if application-linked
   - pipeline report
   - exposure report
   - approval turnaround report
   - portfolio monitoring/early warning endpoints.
4. Avoid frontend-only filtering.
5. Ensure summary/count queries use same scope as list/detail queries.

TDD / tests:
1. Cross-branch user sees only scoped records in dashboard counts.
2. Report exports include only scoped records.
3. Admin sees all records.
4. RM sees assigned records.
5. Dashboard count equals application list count for same scope/filter.

Acceptance criteria:
- Reports/dashboard/monitoring use server-side scope.
- No out-of-scope application/borrower/document data appears in aggregate or export.

---

## Task 8 — Dead Navigation and Query Consistency Cleanup

Objective: Remove visible dead paths and align shortcut/list/filter behavior.

Problems:
- Dashboard links to `/credit/audit` with no route.
- Dashboard/list query mismatch for assigned-to-me/quick filters.
- Application List summary ignores row filters.
- Dead create modal remains in list page.
- Dashboard can fail entirely if one endpoint fails.

Likely files:
- Modify: `frontend/pages/credit/CreditDashboard.tsx`
- Modify: `frontend/App.tsx` only if adding real route
- Modify: `frontend/pages/CreditApplicationList.tsx`
- Modify: `frontend/src/services/credit.service.ts`

Implementation design:
1. For `/credit/audit`:
   - Preferred short-term: remove/replace link with application-specific audit links where context exists.
   - If a global audit page is desired, add route only if backend supports global audit list with scope and pagination.
2. Assigned-to-me shortcut:
   - Standardize on query param consumed by application list.
   - Reuse `quickFilterToServerParams()` if already present.
3. Application list summary:
   - Pass same filters to summary endpoint as row list.
4. Dead create modal:
   - Remove stale modal code if canonical flow is route-based `/credit/applications/new`.
5. Dashboard resilience:
   - Replace `Promise.all` with `Promise.allSettled` or per-widget fetch isolation.
   - Show per-widget errors instead of blank/broken page.

Verification:
1. Frontend build.
2. Manual click dashboard shortcuts.
3. Confirm list URL filters match visible rows/summary.

Acceptance criteria:
- No dashboard dead link.
- Assigned-to-me shortcut actually filters list data.
- Summary KPI matches current filters.
- One dashboard widget failure does not blank the dashboard.

---

# Phase 2 — Decision Integrity and Audit Reconstruction

Goal: Make every approval reconstructable from immutable data and tamper-evident audit trail.

---

## Task 9 — Immutable Application Decision Packet

Objective: Capture the exact application/borrower/facility/financial/risk/document state used for approval.

Problem:
- Current `CreditApplication.version` is optimistic concurrency, not an immutable approved packet.

Likely files:
- Modify: `backend/prisma/schema.prisma`
- Create/Modify: `backend/src/credit/services/decisionPacket.service.ts`
- Modify: `backend/src/credit/services/creditApplication.service.ts`
- Modify: `backend/src/credit/services/approvalAction.service.ts`
- Modify: CA memo/narrative service where packet reference is needed
- Modify: frontend Application 360 metadata display if required

Schema design:
Add model similar to:
- `CreditDecisionPacket`
  - id
  - applicationId
  - packetVersion
  - sourceApplicationVersion
  - borrowerSnapshot Json
  - facilitiesSnapshot Json
  - financialSnapshot Json
  - riskSnapshot Json
  - documentSnapshot Json
  - approvalMatrixVersionId nullable if lookup unavailable but should usually be required
  - scorecardRunId nullable
  - caMemoVersionId nullable
  - dataHash
  - status: DRAFT/FROZEN/SUPERSEDED if needed
  - createdById
  - createdAt
  - frozenAt
- Add `decisionPacketId` to approval decisions if not already present.

Implementation design:
1. Create packet at submission-for-approval or immediately before approval process starts.
2. Freeze packet before first approval decision.
3. If material data changes after packet freeze, require refer-back/amendment and create new packet version.
4. Compute deterministic hash of packet payload.
5. Approval decisions must reference active frozen packet.
6. CA memo generation should reference decision packet.

TDD / tests:
1. Submit for approval creates frozen packet.
2. Approval action without packet fails or creates packet according to chosen policy.
3. Editing application after packet creation does not mutate packet JSON/hash.
4. New amendment creates new packet version.
5. ApprovalDecision references packet id.

Acceptance criteria:
- Every approval can be tied to exact packet version/hash.
- Packet is immutable by service behavior.

Migration caution:
- Do not destructive reset.
- Add nullable fields first if needed, backfill, then tighten constraints in later migration/db push step.

---

## Task 10 — Audit Chain Hardening

Objective: Make credit audit events hash-complete, ordered, verifiable, and DB append-only.

Problem:
- Hash nullable, no explicit previousHash/sequence, no DB-level immutability enforcement.

Likely files:
- Modify: `backend/prisma/schema.prisma`
- Modify: `backend/src/credit/services/auditChain.service.ts`
- Create/Modify: audit route/controller for verification endpoint
- Modify: `frontend/pages/credit/tabs/sections/AuditTab.tsx`

Schema design:
- Add `previousHash String?`
- Add `sequence Int?` or BigInt if expected volume high
- Backfill sequence/hash for existing events
- Later make `hash`, `sequence` non-null if migration/backfill is safe
- Add indexes:
  - `(applicationId, sequence)` unique where applicationId not null if supported, or regular composite index
  - `(applicationId, createdAt)`

DB immutability:
- Add PostgreSQL trigger to prevent UPDATE/DELETE on audit event table.
- If Prisma-managed migration is not clean, implement via explicit SQL migration/script, but do not use force reset.

Implementation design:
1. New event sequence is previous max + 1 per application or global chain depending existing chain design.
2. New hash formula includes:
   - sequence
   - previousHash
   - event type/action
   - actor
   - entity/application ids
   - timestamp
   - sanitized payload
3. Add verification API:
   - `GET /credit/applications/:id/audit/verify` or equivalent
   - returns valid, checkedAt, eventCount, firstBrokenSequence.
4. UI shows chain status and paginates audit events.

TDD / tests:
1. Append event includes sequence/hash/previousHash.
2. Two events chain correctly.
3. Verification detects tampered hash/payload in test setup.
4. DB update/delete attempt fails if integration test feasible.

Acceptance criteria:
- New audit events are non-null hash chain entries.
- Chain validity visible via API/UI.
- DB prevents update/delete.

---

## Task 11 — Expand Sensitive Mutation Auditing

Objective: Ensure critical mutations are reconstructable beyond state transitions.

Scope to audit:
- document upload/download/verify/reject/delete
- borrower party create/update/delete
- PII reveal
- risk assessment update
- financial assessment update
- group exposure edits
- approval matrix changes
- CA memo generation/export
- report export
- approval condition create/resolve/waive

Likely files:
- Multiple service files in `backend/src/credit/services/`
- `backend/src/credit/services/auditChain.service.ts`

Implementation design:
1. Define shared audit helper methods per entity/action.
2. For each mutation, append event inside same transaction where feasible.
3. Include before/after diff for high-value records, sanitized for PII.
4. Link `decisionPacketId` when mutation affects approval basis.
5. Avoid silent catch around audit writes for critical security events; fail transaction if audit event cannot be written for critical mutations.

TDD / tests:
- Add targeted test per high-risk mutation group, not every route at once.
- Prioritize document, approval, risk, financial, PII reveal.

Acceptance criteria:
- Critical mutation has actor, entity, action, timestamp, metadata, and hash-chain event.

---

# Phase 3 — Financial and Risk Correctness

Goal: Centralize formulas, align readiness gates, and make risk assessment structured enough for approvals.

---

## Task 12 — Centralize Financial Formula Engine

Objective: Remove inconsistent DSR/DSCR formula behavior.

Problems:
- SME owner DSR excludes proposed instalment.
- SME dual assessment computes net DSR but status uses gross DSR.
- Readiness gate can be weaker than benchmark pass threshold.

Likely files:
- Modify/Create: `backend/src/credit/services/financialFormula.service.ts`
- Modify: `backend/src/credit/services/retailIncome.service.ts`
- Modify: `backend/src/credit/services/smeFinancial.service.ts`
- Modify: `backend/src/credit/services/financial.service.ts`
- Modify: `backend/src/credit/services/submissionReadiness.service.ts`

Implementation design:
1. Create canonical formula functions:
   - `calculateGrossDsr(existingCommitments, proposedInstalment, grossIncome)`
   - `calculateNetDsr(commitments, proposedInstalment, netIncome)`
   - `calculateDscr(netIncome, depreciation, interest, principal)`
   - `calculateDisposableIncome(...)`
   - `calculateFoir(...)` only if policy confirmed.
2. Formula outputs should include:
   - value
   - numerator
   - denominator
   - inputs
   - threshold/policy used
   - status
   - explanation/reason code.
3. Refactor retail/SME services to use canonical functions.
4. Align submission readiness with the same policy evaluation.
5. Add tests around boundary thresholds and proposed instalment inclusion.

Acceptance criteria:
- Retail and SME affordability calculations include proposed instalment consistently.
- Net DSR is enforced where policy says it is the stricter gate.
- Readiness cannot pass an application that financial assessment marks fail.

---

## Task 13 — Structured Risk Assessment and Completion Gate

Objective: Convert risk assessment from mostly narrative into structured, gateable risk factors.

Likely files:
- Modify: `backend/prisma/schema.prisma`
- Modify/Create: `backend/src/credit/services/riskAssessment.service.ts`
- Modify: `backend/src/credit/services/submissionReadiness.service.ts`
- Modify frontend risk tab/components in Application 360

Schema design:
- Add or extend risk factor model:
  - applicationId
  - category: borrower/financial/collateral/industry/conduct/AML/operational/etc.
  - factor
  - severity
  - likelihood
  - impact
  - inherentRisk
  - residualRisk
  - mitigation
  - owner
  - status
  - evidenceDocumentId nullable
  - createdBy/updatedBy timestamps.

Implementation design:
1. Define required categories per current launch product.
2. Add backend CRUD/upsert for risk factors if missing.
3. Add readiness gate requiring all mandatory categories completed.
4. Include structured risk factors in decision packet and CA memo.
5. Preserve narrative summary as supplemental, not source of truth.

TDD / tests:
1. Missing required risk category blocks submission/approval.
2. Complete required categories allow readiness to pass if other gates pass.
3. Risk factor changes are audited.

Acceptance criteria:
- Risk assessment has structured factors and statuses.
- Required categories gate committee/approval readiness.

---

## Task 14 — Enable SME Directors/Shareholders/UBO UI

Objective: Surface existing party APIs/models in Borrower 360 and make SME KYC usable.

Problem:
- Directors/shareholders/UBO UI blocks are disabled or display-only.

Likely files:
- Modify: `frontend/pages/BorrowerProfileDetail.tsx`
- Modify: `frontend/src/services/credit.service.ts`
- Backend routes/services for borrower parties if incomplete
- Audit service for party changes

Implementation design:
1. Inspect existing party APIs and modal code.
2. Enable tabs/cards for:
   - directors
   - shareholders
   - UBOs
3. Add create/edit/delete flows with validation.
4. Include fields:
   - name/id/reference
   - relationship/role
   - shareholding percentage where relevant
   - appointment date
   - verification status
   - screening status
   - connected-party/staff flags.
5. Audit all changes.
6. Wire Application 360/readiness to party completeness if SME product requires it.

Verification:
- Frontend build.
- Manual Borrower 360 create/edit/delete party flows.
- Backend tests if routes/services are modified.

Acceptance criteria:
- SME borrower parties can be managed from UI.
- Changes persist and are audited.
- Disabled/dead party UI is removed or replaced.

---

# Phase 4 — CA Memo, Reporting, Portfolio, UX Hardening

Goal: Improve traceability, operational reliability, and management accuracy.

---

## Task 15 — CA Memo Versioning and Metadata

Objective: Tie CA memo output to a decision packet and show source metadata.

Problems:
- No clear immutable CA memo version tied to decision version.
- Preview lacks generated timestamp/signoff/source data version.

Likely files:
- Modify: `backend/prisma/schema.prisma` if memo version model missing
- Modify: `backend/src/credit/services/creditNarrative.service.ts`
- Modify CA memo export/download controller/service
- Modify: `frontend/pages/credit/tabs/CaMemoPreviewTab.tsx`
- Modify: `frontend/pages/CreditApplicationDetail.tsx`

Implementation design:
1. Add memo version metadata if missing:
   - sourceDecisionPacketId
   - sourceApplicationVersion
   - generatedById
   - generatedAt
   - dataHash
   - signoffStatus
2. Re-generating memo creates new version or explicit replacement with audit trail.
3. UI shows metadata prominently:
   - generated date
   - generated by
   - source packet version/hash
   - signoff status.
4. Unify duplicate export paths and error handling.
5. Consider native structured preview later; keep iframe if needed for this phase but add metadata outside iframe.

Acceptance criteria:
- Memo export can be traced to exact decision packet.
- User sees generated/version/signoff metadata.

---

## Task 16 — Reporting and Exposure Correctness

Objective: Make reports scoped, consistent, and more scalable.

Problems:
- Exposure aggregation in memory.
- FX-aware exposure inconsistently applied.
- Report routes lack consistent scope.

Likely files:
- Backend reporting/exposure services
- `frontend/pages/credit/CreditReports.tsx`
- `frontend/src/services/credit.service.ts`

Implementation design:
1. Apply credit scope service to all report queries and exports.
2. Reuse canonical FX-aware exposure computation already present if available.
3. Move obvious aggregate counts/sums into DB queries where safe.
4. Keep materialized views as later optimization unless performance requires them now.
5. Add report filters to URL/query state for deep links.

Acceptance criteria:
- Scoped report data matches scoped application list.
- Exposure uses one canonical FX-aware path.
- Export respects the same filters/scope as UI.

---

## Task 17 — Dashboard Accuracy and Resilience

Objective: Make dashboard operationally trustworthy.

Problems:
- One failed endpoint can fail whole dashboard.
- Pipeline aging uses updatedAt instead of transition timestamps.
- Query mismatch and summary mismatch addressed partly in Phase 1.

Likely files:
- `frontend/pages/credit/CreditDashboard.tsx`
- `backend/src/credit/services/creditDashboard.service.ts`
- Audit/event service for transition timestamps

Implementation design:
1. Use per-widget fetch or `Promise.allSettled`.
2. Add per-widget loading/error/empty states.
3. Add last-refreshed timestamp.
4. Backend pipeline aging should derive from audit state transition timestamps, not generic updatedAt.
5. Keep UX changes minimal; no major dashboard redesign in this remediation phase.

Acceptance criteria:
- Dashboard partially renders on partial API failure.
- Aging reflects actual state transition time.

---

# Phase 5 — Deferred Product-Specific Expansion

Goal: Only after business confirms product scope.

Do not implement in first kickstart unless explicitly approved.

Product-specific modules:
1. Hire Purchase
   - asset financed
   - cash price/deposit/margin
   - title/ownership
   - statutory notices
   - repossession workflow
2. Leasing
   - lease asset schedule
   - residual value
   - rentals
   - purchase option
   - maintenance/insurance
   - asset return/repo workflow
3. Factoring
   - invoice ledger
   - debtor verification
   - assignment/notice
   - recourse/non-recourse
   - advance/reserve
   - dilution/dispute
   - collection allocation
4. Cooperative lending
   - member register/profile
   - share/subscription
   - payroll deduction
   - guarantors
   - cooperative board approval

Exit criteria before any of these:
- Phase 1 and Phase 2 complete.
- Business policy/design spec approved for selected product.

---

# Suggested Sprint Plan

## Sprint 1 — Document Security and Upload Integrity

Tasks:
1. Task 1: document-specific authorization middleware.
2. Task 2: AV-clean download enforcement.
3. Task 3: bulk upload applicationId fix.
4. Task 4: create-wizard real document upload.

Verification:
- Targeted backend document tests.
- `cd backend && npm run build`
- `cd frontend && npm run build`
- Manual E2E: wizard upload, Application 360 bulk upload, unauthorized download denial.

Exit gate:
- No false document completion.
- No out-of-scope document access.
- No unclean document download.

## Sprint 2 — Approval Control Consistency

Tasks:
1. Task 5: canonical approval authority service.
2. Task 6: conditional approval semantics.
3. Approval inbox/action/dashboard alignment.

Verification:
- Targeted approval service tests.
- Application transition tests.
- Manual approval flow.

Exit gate:
- No matrix means hard block everywhere.
- Conditional approvals have resolvable lifecycle.
- Approval inbox only shows actionable scoped items.

## Sprint 3 — Data Scope and Dead UX Cleanup

Tasks:
1. Task 7: row-level scoping for dashboard/reports/monitoring.
2. Task 8: dead navigation/query consistency cleanup.

Verification:
- Scoped dashboard/report tests.
- Frontend build.
- Manual dashboard/list shortcut testing.

Exit gate:
- Dashboard/report/list data respects same server-side scope.
- No dead dashboard links.

## Sprint 4 — Decision Packet Foundation

Tasks:
1. Task 9: immutable decision packet model/service.
2. ApprovalDecision -> packet linkage.
3. Packet included in approval and CA memo basis.

Verification:
- Prisma generate/build.
- Packet immutability tests.
- Approval tests.

Exit gate:
- Every approval references exact frozen data packet.

## Sprint 5 — Audit Reconstruction

Tasks:
1. Task 10: previousHash/sequence/hash hardening.
2. Task 11: sensitive mutation audit expansion.
3. Audit verification endpoint/UI status.

Verification:
- Audit chain tests.
- DB immutability test where feasible.
- Manual Audit tab check.

Exit gate:
- Audit trail is append-only and chain-verifiable.

## Sprint 6 — Financial/Risk Maturity

Tasks:
1. Task 12: formula centralization.
2. Task 13: structured risk factors and readiness gate.

Verification:
- Formula boundary tests.
- Readiness tests.
- Manual application submission gate check.

Exit gate:
- Financial/risk gates are consistent and explainable.

## Sprint 7 — Borrower SME Party Management

Tasks:
1. Task 14: enable director/shareholder/UBO UI.
2. Audit party mutations.
3. Optional borrower document lifecycle improvements if scoped.

Verification:
- Frontend build.
- Manual Borrower 360 create/edit/delete party flow.

Exit gate:
- SME party management is operational from UI.

## Sprint 8 — CA Memo, Reporting, Dashboard Hardening

Tasks:
1. Task 15: CA memo versioning.
2. Task 16: reporting/exposure consistency.
3. Task 17: dashboard resilience/aging accuracy.

Verification:
- Backend tests for memo/report services where changed.
- Frontend build.
- Manual report export and CA memo generation.

Exit gate:
- Memo/report/dashboard outputs are scoped, traceable, and resilient.

---

# Implementation Kickstart Recommendation

Start with Sprint 1 only.

Why:
- It closes the highest-risk PDPA/security issues first.
- It fixes false operational completion around document collection.
- It is narrow enough to implement and verify without destabilizing approval/audit schema.
- It creates a secure foundation before decision packet/audit work.

Sprint 1 exact first-pass sequence:
1. Re-verify document routes and tests.
2. Add failing document authorization tests.
3. Implement document-aware scope middleware/service.
4. Add failing AV download tests.
5. Enforce clean AV download rule.
6. Fix bulk upload applicationId and refresh behavior.
7. Change create wizard to draft-first or applicationId-backed document upload.
8. Run backend targeted tests.
9. Run backend build.
10. Run frontend build.
11. Manual E2E for document upload/download.

---

# Verification Commands

Run from repository root unless noted.

Initial state:
- `git status --short`
- `git branch --show-current`

Backend:
- `cd backend && npm run build`
- `cd backend && npm test -- --runInBand` or targeted Jest command based on existing scripts
- `cd backend && npm run lint` if lint is currently stable

Frontend:
- `cd frontend && npm run build`
- `cd frontend && npm test` only if test script exists and is stable
- If TypeScript checker exists separately, run it; Vite build alone may not catch all type drift.

Manual E2E after Sprint 1:
1. Login as authorized credit/admin user.
2. Create or open borrower.
3. Start new credit application.
4. Upload documents in create wizard.
5. Refresh and confirm documents persist.
6. Submit or check readiness.
7. Open Application 360 Documents tab.
8. Bulk upload additional documents.
9. Confirm checklist refreshes.
10. Download clean document as authorized user.
11. Attempt download of pending/unclean document and confirm block.
12. Login as unauthorized/cross-branch user and confirm document access denied.

Manual E2E after Sprint 2:
1. Create application with no matching approval matrix.
2. Confirm submission/approval is blocked consistently.
3. Create application with matching matrix.
4. Confirm eligible approver sees item.
5. Confirm non-eligible user does not see/take item.
6. Submit conditional approval.
7. Confirm open condition blocks final/disbursement step.
8. Satisfy/waive condition and confirm flow proceeds.

Manual E2E after Phase 2:
1. Submit application to approval.
2. Confirm decision packet created with version/hash.
3. Approve application.
4. Confirm approval references packet.
5. Generate CA memo.
6. Confirm memo references packet version/hash.
7. Verify audit chain status in Audit tab/API.
8. Confirm audit trail can reconstruct approval basis.

---

# Risks and Mitigations

1. Existing uncommitted working tree
   - Mitigation: Check `git status` before edits. Do not overwrite unrelated changes. Patch only touched files.

2. Prisma/schema migration risk
   - Mitigation: Defer schema-heavy decision packet/audit chain to Phase 2 after P0 frontend/backend fixes. Use additive nullable fields first. Never force reset.

3. Approval regression risk
   - Mitigation: Add tests before changing approval logic. Use one canonical authority service.

4. Document wizard flow complexity
   - Mitigation: Re-read create flow fully before patching. Prefer draft-first only if existing draft API supports it. Keep UI changes minimal.

5. Scope duplication risk
   - Mitigation: Build one `creditScope.service.ts` and consume it everywhere instead of one-off route checks.

6. Audit volume/performance
   - Mitigation: Add pagination before expanding audit events broadly. Index `(applicationId, createdAt)` and sequence.

7. Vite build vs TypeScript contract drift
   - Mitigation: If separate typecheck exists, run it. Otherwise treat frontend build as bundle verification only.

---

# Out of Scope for Kickstart

Do not implement in first batch unless user explicitly says so:
- HP/leasing/factoring/cooperative product-specific models.
- Full mobile redesign.
- Full native CA memo renderer replacing iframe.
- Materialized views for all reports.
- Large `credit.service.ts` service split/refactor.
- Production deploy.
- Commit/push.

---

# Proposed Immediate Next Step

If approved, begin Sprint 1 with read-only re-verification, then implement document security and upload integrity in this order:
1. Document access middleware/tests.
2. AV clean download enforcement/tests.
3. Bulk upload applicationId fix.
4. Real create-wizard document upload.
5. Backend/frontend builds and manual E2E.
