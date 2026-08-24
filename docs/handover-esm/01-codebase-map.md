# CWC 2.0 ESM — Codebase Map

A directory-by-directory guide to the ESM service-management module, backend and frontend. All paths relative to repo root.

---

## 1. Backend core (`backend/src/`)

```
backend/src/
├── routes/         Express routers (~46 files) — index.ts is the aggregator
├── controllers/    ~45 HTTP controllers (thin)
├── services/       ~70 service files (business logic)
├── middleware/     auth, RBAC, upload, rate-limit, validate, authorizeResource, etc.
├── utils/          prisma, logger, workflowTransitions (fallback map), redis, sse
├── validators/     Joi request validators
├── constants/      enums/constants (requestStatusCompat, etc.)
├── config/         centralized env config (backend/src/config/index.ts)
├── jobs/, workers/, queues/   scheduled jobs + BullMQ workers
├── templates/      email/PDF templates
└── security/       operation-control registry, etc.
```

### Routes — the entry points

Everything mounts in **`backend/src/routes/index.ts`** under `/api/v1`:

| URL prefix | Domain |
|---|---|
| `/auth` | auth (before global rate limiter) |
| `/users` | users |
| `/requests` | **request lifecycle** (create/get/update/transitions/approvals/bulk/export) |
| `/service-desks` | **service desks / categories / request types** (public + admin) |
| `/approvals`, `/approval-policies`, `/approval-delegations` | approvals, policies, delegation |
| `/admin/workflows`, `/admin/workflow-versions`, `/admin/workflow-transitions`, `/admin/status-definitions` | workflow-designer admin |
| `/it-workflow`, `/finance-workflow`, `/chargeback-workflow`, `/esm-workflow` | IT / Finance / chargeback / ESM-travel workflows |
| `/onboarding`, `/offboarding`, `/loa`, `/interviews`, `/screening` | HR workflows (+ templates) |
| `/sla` | SLA / escalation rules |
| `/notifications` | notifications (SSE + REST) |
| `/assets` | IT asset management |
| `/kb` | knowledge base |
| `/search`, `/reports`, `/insights` | search, reports, insights |
| `/files` | file upload/download |
| `/announcements`, `/admin/banner-configs`, `/admin/system-settings`, `/admin/audit-logs`, `/admin/tenants`, `/admin/entities`, `/admin/scheduler`, `/admin/queues` | announcements + admin |
| `/esm-workflow` | ESM travel request workflow |

### Controllers (`backend/src/controllers/`)
`request.controller.ts` (the big one), `serviceDesk.controller.ts`, `workflow.controller.ts`, `workflowVersion.controller.ts`, `workflowTransition.controller.ts`, `approval.controller.ts`, `escalationRule.controller.ts`, `notification.controller.ts`, `asset.controller.ts`, `kb.controller.ts`, `search.controller.ts`, `reports.controller.ts`, `insights.controller.ts`, `it-workflow.controller.ts`, `finance-workflow.controller.ts`, `chargeback-workflow.controller.ts`, `esm-workflow.controller.ts`, `onboarding/offboarding/loa/interview/screening.controller.ts`, `auth.controller.ts`, `user.controller.ts`, plus admin/notification/export/pdf controllers.

### Services (`backend/src/services/`) — key files for orientation
- **Request lifecycle:** `requestTransition.service.ts` (central transition service — **read first**), `availableTransitions.service.ts`, `requestAccess.service.ts`, `requestCreationPolicy.service.ts`, `autoAssignment.service.ts`, `reassign.service.ts`.
- **Workflow engine:** `workflowCompiler.service.ts`, `workflowGraph.service.ts`, `workflowGraph.types.ts`, `workflowVersion.service.ts`, `workflowBootstrap.service.ts`, `workflowValidator.service.ts`, `workflowCommand.service.ts`, `transitionGuards.ts`, `transitionPolicy.service.ts`, `conditionalRules.service.ts`, `conditionEvaluator.service.ts`, `requestStatusDefinition.service.ts`, `statusRemap.service.ts`.
- **Approvals:** `approvalRuntime.service.ts`, `approvalPolicy.service.ts`, `approvalDelegation.service.ts`.
- **SLA:** `sla.service.ts`, `sla-pause.service.ts`.
- **Notifications:** `notification.service.ts`, `outboxDispatcher.service.ts`, `email.service.ts`.
- **Other:** `asset` / `kb` / `search` / `insights` / `reports` / `announcement` / `systemSetting` / `tenant` / `permission` / `password-reset` / `pdfJob` / `s3` / `retentionPolicy`.

### The two transition systems (IMPORTANT)
- **Runtime (authoritative):** published workflow graphs + the `workflow_transitions` DB table, consumed by `requestTransition.service.ts`.
- **Fallback/documentation:** `backend/src/utils/workflowTransitions.ts` — `VALID_TRANSITIONS` map of status → allowed next statuses. **Not the runtime source of truth.**

---

## 2. Frontend (`frontend/`)

```
frontend/
├── App.tsx                     React Router — ESM + CRM + Credit routes
├── pages/                      top-level pages (Dashboard, ITSupport, HRServices, GroupFinance, ...)
├── pages/credit/               credit module (separate)
├── src/components/             shared + domain components (FormBuilder, EntityApprovalsPanel, ...)
├── src/services/               per-domain API clients (request.service.ts, serviceDesk.service.ts, ...)
├── src/context/, hooks/, lib/  Auth, notifications, feature-flags, api client
├── src/components/layout/      LeftRail, TopBar, navConfig (buildNavLinks)
└── src/i18n/                   global i18n (only Dashboard uses it; ESM is otherwise hard-coded English)
```

### Frontend routes (App.tsx, lines 250–270) — ESM core
`/` (Dashboard), `/hr` (HRServices), `/it` (ITSupport), `/finance` (GroupFinance), `/esm` (ExecutiveServices), `/my-requests`, `/request/:id` (RequestDetail), `/agent` (AgentDashboard), `/reports` (report:read), `/insights` (report:read), `/search`, `/kb` + `/kb/:slug` (feature-flagged + kb:manage), `/approvals` (ApprovalCenter), `/inbox` (UnifiedInbox), `/announcements`, `/assets` (asset:read), plus admin routes. All wrapped in `ProtectedRoute`.

---

## 3. Prisma schema (`backend/prisma/schema.prisma`)

- **210 models** total. ESM core models: `Request`, `ServiceDesk`, `ServiceDeskCategory`, `RequestType`, `RequestActivity`, `RequestParticipant`, `RequestAttachment`, `RequestApproval`, `ApprovalInstance`, `WorkflowType`, `WorkflowVersion`, `WorkflowNode`, `WorkflowEdge`, `WorkflowStep`, `WorkflowFormSchema`, `WorkflowTransition`, `RequestStatusDefinition`, `ITHardwareRequest`, `HRLeaveRequest`, `FinanceExpenseReimbursement`, `OnboardingRequest`, `OffboardingRequest`, `Candidate`, `InterviewSchedule`, `LetterOfAcceptance`, `EscalationRule`, `Notification`, `Asset`, `AssetAssignment`, `KbArticle`, etc.
- **`RequestStatus` enum: ~110 statuses** across generic / HR-recruitment / IT-procurement / Finance / onboarding / offboarding / inter-company chargeback. `RequestStatusLifecycleType` (OPEN / RESOLVED / CLOSED / CANCELLED) classifies lifecycle.
- God-models: `Request` (~40 fields / 40+ relations), `User` (~163 fields / ~110 relations).

See **[02-data-model.md](02-data-model.md)**.

---

## 4. How to navigate a feature end-to-end (worked example)

Take **"an employee submits an IT hardware request and an IT agent progresses it"**:

1. **Frontend** — `/it` (ITSupport) → create request form (`CreateRequest` + `FormBuilder`) calls `frontend/src/services/request.service.ts` (or `it-workflow.service.ts`).
2. **HTTP** — `POST /api/v1/requests` (mounted in `routes/index.ts`) → `request.controller.ts::createRequest`.
3. **Service** — `requestCreationPolicy.service.ts` + `requestTransition.service.ts` validate and create the `Request` (form snapshot, reference number, initial status).
4. **Runtime** — the workflow engine (`requestTransition.service.ts` + published workflow) determines valid next statuses (`GET /requests/:id/available-transitions`).
5. **SLA/notifications** — SLA timer set; in-app + email notifications dispatched (durable outbox).
6. **Prisma** — `Request`, `RequestActivity`, `RequestParticipant`, `ITHardwareRequest`, `AssetAssignment`.

Follow the same path for any feature: route → controller → service → schema.
