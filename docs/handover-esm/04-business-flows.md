# CWC 2.0 ESM — Business Flows

Traced from real code (`backend/src/routes`, `controllers`, `services` + `backend/prisma/schema.prisma` + `prisma/seed.ts`). All URL patterns mounted under `/api/v1`. Scope: **service desk / request platform (IT / HR / Finance / ESM-travel)** — CRM and credit excluded.

**Global gates:** all routes require `authenticate`; many use `authorizeResource(loadRequestScopeFromParam('id'), ...)` for row-level access (P02-09) plus `requestAccess.service.ts` policy evaluation. Admin routes use `requirePermission('admin:access')` (read) / `admin:settings` (write).

---

## 1. Service desks & catalog hierarchy

**Model hierarchy** (`schema.prisma`): `ServiceDesk` (:424) → `ServiceCategory` (:454) → `RequestType` (:476). A desk belongs to a `Department` (:342) and has `autoAssignTeam`, `assignmentStrategy` (ROUND_ROBIN), `lastAssignedIndex` (:434-438). `RequestType` is the catalog item: `requiresApproval`, `slaHours`, JSON `formConfig` (+`formConfigVersion`), `workflowTypeId` (links a WorkflowType state machine), `lifecycleStatus` (catalog governance), `classification`, `ownerId`.

**Routes** (`routes/serviceDesk.routes.ts`): public reads at :22-50 (list desks/categories/request-types); admin CRUD gated by `admin:settings` at :103-172; deactivation-impact preview at :82-96.

**Service** (`services/serviceDesk.service.ts`): `getAllServiceDesks` (:6), `getRequestTypes` (:241, filters `lifecycleStatus: 'PUBLISHED'`, P5-01), `reorderCategories` (transaction), deactivation-impact counts.

**Seeded desks** (`prisma/seed.ts`):
- **IT Support** (`IT`) — **5 categories** (:1031-1042): Get IT Help (24h), Email Management (24h), Report System Problem (24h), Software Installation (48h), Request New Hardware (72h).
- **Group HR** (`HR`) — **4 categories** (:1162-1214): Question for HR, New Hiring Request (48h), New Employee Onboarding, Offboard an Employee.
- **Group Finance** (`FINANCE`) — **4 categories** (:1292-1347): Purchase Requisition, Inter-Company Chargeback, Submit Budget Proposal, Expense Claims (disabled). SLA 72h each.
- **Executive Services (ESM)** — **1 category**: Travel Request (:1442-1463, 168h).

---

## 2. IT workflow

**Files:** `routes/it-workflow.routes.ts`, `controllers/it-workflow.controller.ts` (931 lines).

**Procurement chain** (via `transitionRequest`, guarded in `transitionGuards.ts` + `workflowTransitions.ts`):
`SUBMITTED → PROCUREMENT_IN_PROGRESS → HARDWARE_ORDERED → HARDWARE_RECEIVED → SOFTWARE_PROVISIONED → RESOLVED`, plus an executive chain `ACKNOWLEDGED_IT → PENDING_CEO_APPROVAL_IT → PENDING_CTO_APPROVAL_IT → PENDING_INVOICE_IT → PENDING_CFO_APPROVAL_IT → PAYMENT_PROCESSING_IT → PAYMENT_DONE_IT → PENDING_DELIVERY_IT → RESOLVED`.

- `markProcurement` (:52) — SUBMITTED→PROCUREMENT_IN_PROGRESS, stores order/vendor.
- `markHardwareOrdered` (:128) — orderNumber/tracking → `ITHardwareRequest`.
- `markHardwareReceived` (:180) — sets `procurementStatus:'RECEIVED'` and **auto-creates an Asset** when `registerAsAsset && assetTag` (dedup on tag/serial, :210-238), inferring category via `inferCategoryFromName` (:10-21).
- `markSoftwareProvisioned` (:264), `markFulfilled` (:98 → RESOLVED).
- Exec approvals: `acknowledgeRequest` (:311), `ceoDecision` (:410), `ctoDecision` (:534), `routeToCfoApproval` (:621, upload invoices), `cfoDecision` (:730), `markPaymentDone` (:819, branches hardware→PROCUREMENT vs software→PENDING_DELIVERY_IT), `completeDelivery` (:896).

**Model:** `ITHardwareRequest` (schema :1421) — hardwareName/model, estimatedPrice, vendor, manager approval flags, procurementStatus/order/tracking/serial/assetTag/assetId.

---

## 3. HR workflow

**Recruitment journey** (routes: approval, interview, screening, loa, onboarding, offboarding).

**Status chain** (`workflowTransitions.ts` :22-40 + :96-114):
`SUBMITTED → PENDING_CEO_APPROVAL → CEO_APPROVED → PENDING_GROUP_DCEO_APPROVAL → GROUP_DCEO_APPROVED → JOB_POSTED → PENDING_MANAGER_REVIEW → MANAGER_APPROVED → INTERVIEW_SCHEDULED → INTERVIEW_FEEDBACK_PENDING → HR_SCREENING → LOA_PENDING_APPROVAL → LOA_APPROVED → LOA_ISSUED → LOA_ACCEPTED → COMPLETED → ONBOARDING_SUBMITTED → … → ONBOARDING_COMPLETED`.

- **Job posting / CEO / Group DCEO** (`approval.controller.ts`): `routeToCEO` (:49), `ceoDecision` (:160, →CEO_APPROVED→PENDING_GROUP_DCEO_APPROVAL or skips if CEO is GROUP_DCEO), `markJobPosted` (:356), `routeToManager` (:433), `managerDecision` (:569), `entityDecision` (:774), `routeToGroupDceoHr` (:922), `groupDceoDecisionHr` (:1024).
- **Interview** (`interview.controller.ts`): `scheduleInterview` (:10), `updateInterviewSchedule`, `submitInterviewFeedback` (:156, PROCEED/REJECT → INTERVIEW_FEEDBACK_PENDING). Models `InterviewSchedule`, `InterviewFeedback`.
- **Screening** (`screening.controller.ts`): `startHRScreening` (:10 → HR_SCREENING), `updateScreeningStatus` (:111 → LOA_PENDING_APPROVAL). Model `HRScreening`.
- **LOA** (`loa.controller.ts`): upload → route-for-approval → manager-approve → mark-issued → upload-signed → mark-accepted (→LOA_ACCEPTED → COMPLETED). Model `LetterOfAcceptance`.
- **Onboarding** (`onboarding.controller.ts` + `services/onboarding.service.ts`): `createOnboardingFromHiring` (:11) auto-derives hire from LOA/resume (start date +7 days); phases map to statuses (:199-223): ONBOARDING_PENDING_HR_APPROVAL → PRE_ARRIVAL_SETUP → READY_FOR_DAY_1 → DAY_1_ORIENTATION → WEEK_1_INTEGRATION → MONTH_1/2/3_MILESTONE → ONBOARDING_COMPLETED. Models `OnboardingRequest`, `OnboardingTask`, `OnboardingTaskTemplate`.
- **Offboarding** (`offboarding.controller.ts`): →OFFBOARDING_SUBMITTED → NOTICE_PERIOD → KNOWLEDGE_TRANSFER → FINAL_WEEK → EXIT_PROCEDURES → OFFBOARDING_COMPLETED (:174-202); resignation-letter upload; IT revocation + HR flags. Models `OffboardingRequest`, `OffboardingTask`.

**Candidate:** `Candidate` (schema :1629) + `CandidateResume` (:1647), one-to-one with a hiring `Request`.

---

## 4. Finance workflow

**Files:** `finance-workflow.routes.ts`, `chargeback-workflow.routes.ts`; controllers `finance-workflow.controller.ts` (1310 lines), `chargeback-workflow.controller.ts` (434 lines).

**Purchase requisition** (`finance-workflow.controller.ts`): `acknowledge` (:152 → FINANCE_ACKNOWLEDGED), `routeToCfo` (:187) / `setFinalizedAmountAndRouteCfo` (:261 → PENDING_CFO_APPROVAL_FIN), `cfoDecision` (:375; approve→CFO_APPROVED_FIN then branches FINANCE_IN_PROGRESS or PENDING_GROUP_DCEO_APPROVAL :439-475), `groupDceoDecision` (:812 → GROUP_DCEO_APPROVED → PAYMENT_PROCESSING_FIN :855), `markPaymentComplete` (:912 → AWAITING_PAYMENT_CONFIRMATION), `closeTicket` (:950 → TICKET_CLOSED_FIN). Reassign approvers (:551, :696).

**Expense reimbursement** (same controller, routes :43-47): `managerApproveExpense` (:1031 → MANAGER_APPROVED_FIN) → `financeHeadApproveExpense` (:1154 → FINANCE_HEAD_APPROVED) → `markExpensePaymentComplete` (:1264 → PAYMENT_COMPLETED → REIMBURSEMENT_CLOSED). Models `FinanceExpenseReimbursement` (:1481) + `ExpenseLineItem` (:1513).

**Chargeback** (`chargeback-workflow.controller.ts`): `submitChargeback` (:23), `fromEntityDecision` (:101 → PENDING_TO_ENTITY_APPROVAL / FROM_ENTITY_REJECTED), `toEntityDecision` (:219), `markConfirmed` (:348), `completeChargeback` (:393 → CHARGEBACK_COMPLETED). Chain: PENDING_FROM_ENTITY_APPROVAL → PENDING_TO_ENTITY_APPROVAL → CHARGEBACK_FINANCE_REVIEW → AWAITING_CHARGEBACK_CONFIRMATION → CHARGEBACK_COMPLETED.

---

## 5. ESM Travel workflow

**Files:** `routes/esm-workflow.routes.ts` (:17-23), `controllers/esm-workflow.controller.ts` (1063 lines).

**Approval chain** (`workflowTransitions.ts` :22-27): `SUBMITTED → PENDING_CEO_APPROVAL → CEO_APPROVED → PENDING_GROUP_DCEO_APPROVAL → GROUP_DCEO_APPROVED → FINANCE_ACKNOWLEDGED → PENDING_CFO_APPROVAL_FIN → CFO_APPROVED_FIN → COMPLETED`.

- `submitForCeoApproval` (:193) — routes to PENDING_CEO_APPROVAL, validates CEO/GROUP_DCEO approver via `executiveRole` (:62-84, :171-174).
- `ceoDecision` (:442) — rejection→REJECTED; approval→CEO_APPROVED; if the approver also holds GROUP_DCEO it **auto-skips the DCEO stage** (:517-555), else →PENDING_GROUP_DCEO_APPROVAL (:591).
- `groupDceoDecision` (:636 → GROUP_DCEO_APPROVED → FINANCE_ACKNOWLEDGED :707), `financeAcknowledge` (:755 → PENDING_CFO_APPROVAL_FIN), `cfoDecisionTravel` (:821 → CFO_APPROVED_FIN → COMPLETED :903, or reject→REJECTED).
- **Group DCEO threshold** configurable via `systemSettingService.getEsmDceoThreshold` (default 50000).

---

## 6. Approvals, delegation, policy

**Models** (schema): `ApprovalPolicy` (:728) → `ApprovalPolicyStep` (:751) → `ApprovalPolicyVersion` (:782, frozen definition, DRAFT/PUBLISHED/RETIRED) → `ApprovalInstance` (:808) → `ApprovalInstanceStep` (:831). Approver types: ROLE/DEPARTMENT/ENTITY/USER/TEAM/AUTO (:690-697). Steps have `parallelGroup` + `timeoutAction` (REMINDER/ESCALATE/REJECT). Legacy `RequestApproval` (:1542) + `ApprovalDelegation` (:1593) + `ApprovalReminder` (:1613).

**Runtime** (`services/approvalRuntime.service.ts`): `publishPolicyVersion` (:88, freezes steps), `retirePolicyVersion` (:144), `startApprovalInstance` (:181, fail-closed — only PUBLISHED versions start; resolves policy by priority/tenant :194-205; activates sequential groups :229+), `decideApproval` (routes through `executeWorkflowCommand`), `delegateApprovalRuntime` (rejects self/cyclic/out-of-tenant delegation + requester SoD).

**Policy service** (`approvalPolicy.service.ts`): CRUD (:45), `resolvePolicy` (:121, lowest `priority` wins), step approver resolution (:171-209).

**Delegation service** (`approvalDelegation.service.ts`): `delegateApproval` (:26) verifies PENDING status + current approver, reassigns `approverId`→delegate, logs `ApprovalDelegation`; plus reminders and timeout fallback/escalation.

---

## 7. SLA & escalation

**Models** (schema): `SlaPolicyVersion` (:569, response/resolution/OLA targets in minutes, timezone `Asia/Kuala_Lumpur`), `SlaClock` (:591), `SlaPauseLedger` (:620), `SlaTimerJob` (:636), `SlaEscalationEvent` (:665), `EscalationRule` (:521, `triggerHoursAfterBreach` + `notifyRoles`, per request type).

**Per-type SLA hours** from `RequestType.slaHours` seed (IT 24-72h, HR 48h, Finance 72h, ESM Travel 168h). Legacy `Request` carries `slaDueAt`, `slaPausedAt`, `slaPauseDurationMs` (:1232-1234).

**`services/sla.service.ts`**:
- `checkSlaBreaches` (:7) — overdue non-paused requests not in terminal statuses → creates a `SYSTEM` "SLA BREACH" activity (dedup), notifies assigned agent or first admin.
- `checkEscalations` (:89) — per breached request, loads matching `EscalationRule`s ordered by `triggerHoursAfterBreach`; fires when `breachedAt + hours ≤ now`; idempotent via `slaEscalationEvent` upsert + `outboxEvent`; notifies `notifyRoles` and adds them as `ESCALATION_RECIPIENT` participants (:185-219).

**`services/sla-pause.service.ts`**: `pauseSla` (:13, sets `slaPausedAt`, idempotent), `resumeSla` (:57, accumulates pause ms + extends `slaDueAt`), `isPauseStatus` (:131, reads `WorkflowStep.slaPause`, Redis-cached 5min), `shouldResumeOnTransition` (:163), `getEffectiveSlaDueAt` (:182), `checkStalePauses` (:226, auto-resumes after 14 days).

---

## 8. Notifications, assets, KB, search

- **Notifications** (`services/notification.service.ts`, 553 lines): `notify` (:463, IN_APP+EMAIL inline), `notifyDurably` (:504, BullMQ queue), `notifyMultiple` (:537), `publishDomainEvent` (:127, writes `NotificationDomainEvent` + `NotificationDelivery` in tx), `deliverNotification` (:313), `deliverPendingNotifications` (:444). Global email toggle cached 30s. Models: `Notification`, `NotificationTemplate`, `NotificationDomainEvent`, `NotificationDelivery`.
- **Assets** (`routes/asset.routes.ts`, `controllers/asset.controller.ts`): full CRUD + CSV/XLSX import (parse/commit, :104-123), assignment (`assignAsset`), list active assignments, export. Models `Asset` (:2403, with `sourceRequestId` linking IT hardware), `AssetAssignment` (:2445). Auto-provisioning in IT workflow `markHardwareReceived`.
- **KB** (`routes/kb.routes.ts`, `controllers/kb.controller.ts`): published-article reads + admin create/update/delete/publish; scoped by policy visibility (`kb:manage`). Model `KnowledgeBaseArticle` (:1813, per service desk, helpful/not-helpful counts, viewCount). **No separate kb.service.ts** — logic lives in the controller.
- **Search** (`routes/search.routes.ts`, `controllers/search.controller.ts`): `globalSearch` (:10) across Requests, KB Articles, Users — department-scoped via `policyService.buildVisibleWhere` (P02-11, :30-31); plus `searchRequests`, `searchArticles`, `searchUsers`.

---

## 9. Cross-flow notes for maintainers

- **Runtime transitions are DB/published-workflow driven**; the hardcoded `VALID_TRANSITIONS` map is a seed/fallback only (see 03-request-lifecycle.md).
- **Many workflow services are embedded in controllers** — there is **no** `it-workflow.service.ts`, `kb.service.ts`, `screening.service.ts`, `interview.service.ts`, or `loa.service.ts`; logic lives in the controllers (verified).
- **`prisma/db-dump.json` and `dist/` are build artifacts**, not sources of truth.
- **SLA/escalation, notification delivery, and asset provisioning** are cross-cutting; changes here affect every workflow.
