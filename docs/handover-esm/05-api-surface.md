# CWC 2.0 ESM — API Surface

All ESM endpoints mount under **`/api/v1`** via `backend/src/routes/index.ts` (107 lines). This is the authoritative map of the ESM service-desk / request API.

---

## 1. Route mounting (`backend/src/routes/index.ts`)

| Prefix | Router | Line |
|---|---|---|
| `/auth` | auth (before global rate limiter) | 54 |
| `/requests` | request | 61 |
| `/service-desks` | serviceDesk | 62 |
| `/notifications` | SSE + REST | 63–64 |
| `/approvals`, `/approvals` | approval + policyExplainer | 67–68 |
| `/interviews`, `/screening`, `/loa`, `/onboarding`, `/offboarding` | HR flows | 69–73 |
| `/admin/onboarding-templates`, `/admin/offboarding-templates` | templates | 74–75 |
| `/it-workflow`, `/finance-workflow`, `/chargeback-workflow`, `/esm-workflow` | workflow controllers | 76–79 |
| `/admin/workflows` | **workflowVersion + workflow** | 80–81 |
| `/reports`, `/admin/banner-configs`, `/admin/status-definitions`, `/admin/workflow-transitions`, `/admin/notification-templates` | | 82–86 |
| `/files`, `/admin/entities`, `/admin/audit-logs`, `/sla` | | 88–91 |
| `/crm`, `/announcements`, `/credit`, `/admin/tenants`, `/admin/scheduler`, `/admin/queues`, `/insights`, `/pdf-jobs`, `/admin/catalog-entitlements`, `/admin/approval-policies`, `/approval-delegations`, `/departments` | | 93–104 |

> Global rate limiter `apiLimiter` is applied after `/auth`.

---

## 2. Request endpoints (`request.routes.ts`, 160 lines)

| Method | Path | Handler | Permission |
|---|---|---|---|
| GET | `/requests` | `getAllRequests` | auth + visibility scoping |
| POST | `/requests` | `createRequest` | auth |
| GET | `/requests/pending-approvals` | `getPendingApprovals` | `request:approve` |
| POST | `/requests/bulk-action` | `bulkAction` | `request:approve` |
| GET | `/:id/available-transitions` | `getAvailableTransitions` | authorizeResource |
| GET | `/requests/recent-services` | `recentServices` | auth |
| POST | `/requests/export/xlsx` | `exportRequestsXlsx` | `request:export` |
| GET | `/:id` | `getRequestById` | authorizeResource |
| PUT | `/:id` | `updateRequest` | authorizeResource |
| DELETE | `/:id` | `deleteRequest` | `request:delete` |
| GET | `/:id/export/pdf` | `exportRequestPdf` | authorizeResource |
| GET/POST | `/:id/activities` | get/add activity | authorizeResource |
| POST/GET/DELETE | `/:id/attachments...` | upload/download/delete | authorizeResource |
| PUT | `/:id/assign` | `assignRequest` | `request:assign` |
| PUT | `/:id/status` | `updateStatus` | `request:update` |
| USE | `/:id/participants` | participant routes | authorizeResource |

---

## 3. Service desk & catalog

Public reads (auth): list desks, categories, request-types. Admin CRUD (`admin:settings`): create/update/delete desk, category (create/update/reorder/delete), request-type; deactivation-impact previews. `GET /service-desks/agents?team=FINANCE` lists eligible agents.

---

## 4. Workflow-designer endpoints

Mounted at `/admin/workflows`:
- **WorkflowType / WorkflowStep** (`workflow.routes.ts`): CRUD under `/admin/workflows`.
- **Versioned graph** (`workflowVersion.routes.ts`): `/versions/:versionId/...` — `nodes/edges/graph` PATCH (draft edit), `validate`, `publish` (with status remap), `rollback`, `discard`.
- **Runtime transitions** (`workflowTransition.routes.ts`, `/admin/workflow-transitions`): list/create/update/delete `WorkflowTransition` rows (the runtime-authoritative table).
- **Status definitions** (`requestStatusDefinition.routes.ts`, `/admin/status-definitions`): status catalog CRUD.

All require `authenticate` + `admin:access`.

---

## 5. Workflow-specific endpoints

- **IT** (`it-workflow.routes.ts`): `POST /requests/:id/procurement`, `/hardware-ordered`, `/hardware-received`, `/software-provisioned`, `/fulfill`, `/acknowledge`, `/ceo-decision`, `/cto-decision`, `/route-to-cfo`, `/cfo-decision`, `/payment-done`, `/complete-delivery`.
- **HR** (`approval.routes.ts`, `interview.routes.ts`, `screening.routes.ts`, `loa.routes.ts`, `onboarding.routes.ts`, `offboarding.routes.ts`): route-to-CEO/manager/GroupDCEO, CEO/manager/entity/GroupDCEO decisions, mark-job-posted, interview schedule/feedback, screening start/update, LOA upload/approve/issue/accept, onboarding create/phase-advance/tasks, offboarding phase-advance/tasks.
- **Finance** (`finance-workflow.routes.ts`): acknowledge, route-to-CFO, CFO decision, GroupDCEO decision, mark-payment-complete, close-ticket; expense manager/finance-head approval + payment complete.
- **Chargeback** (`chargeback-workflow.routes.ts`): submit, from-entity decision, to-entity decision, mark-confirmed, complete.
- **ESM travel** (`esm-workflow.routes.ts`): submit-for-CEO, reassign-CEO-approver, CEO decision, Group-DCEO decision, finance-acknowledge, CFO decision, close.

---

## 6. Approvals & policy

- `approval.routes.ts` (HR exec approvals + resume/candidate uploads) — `approval.controller.ts`.
- `approvalPolicy.routes.ts` (admin CRUD of `ApprovalPolicy`).
- `approvalDelegation.routes.ts` (delegate + history).
- `GET /approvals/explain/:policyId` (policy explainer).

---

## 7. SLA & escalation

`escalationRule.routes.ts`: admin CRUD of `EscalationRule` (`triggerHoursAfterBreach`, `notifyRoles`) per request type. SLA breach/escalation evaluated server-side by `sla.service.ts` (`checkSlaBreaches`, `checkEscalations`); pause/resume by `sla-pause.service.ts`.

---

## 8. Notifications, assets, KB, search, reports

- **Notifications**: `/notifications` REST (list/unread/read/delete) + `/notifications/sse` (Server-Sent Events, Redis pub/sub).
- **Assets**: `/assets` CRUD + assignment + CSV/XLSX import/export.
- **KB**: `/kb` published reads + admin CRUD/publish.
- **Search**: `/search` global + per-domain (`searchRequests`, `searchArticles`, `searchUsers`).
- **Reports**: `/reports` summary/status/desk/priority/agent-workload/SLA-status; **Insights**: `/insights` trend analytics.

---

## 9. Auth & users

`auth.routes.ts` (before rate limiter): login, refresh, logout, MFA. `user.routes.ts`: profile, roles, executives (`GET /users/executives?role=CEO,GROUP_DCEO`).

---

## 10. RBAC permission surface (ESM core)

`request:*` (read/create/approve/assign/update/delete/export), `admin:*` (access/settings), `asset:*` (read/write/import), `kb:*` (manage/read), `report:*` (read), `announcement:*` (write), plus role checks (`ADMIN`, `AGENT`, `CEO`, `GROUP_DCEO`, `CFO`, `CTO`, `HIRING_MANAGER`, `FINANCE_HEAD`, etc.).

> **Resource authorization:** most `/requests/:id/*` routes use `authorizeResource(loadRequestScopeFromParam('id'), ...)` (P02-09 defense-in-depth) + `requestAccess.service.ts` full policy evaluation. Don't bypass this for new request routes.
