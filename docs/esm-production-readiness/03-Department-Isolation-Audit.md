# Department Isolation Audit

## Verdict

**FAIL — Critical — P0 — Not production-ready.**

The system has meaningful tenant separation and partial service-desk filtering, but **department isolation is not an end-to-end security boundary**. It is primarily reconstructed from `User.agentTeam`, `ServiceDesk.code`, `Request.serviceDeskId`, `assignedTeam`, ownership and route-specific logic. There is no canonical department membership, resource department owner, scoped grant, or policy decision point applied to every request, KB article, report, notification, attachment, asset and configuration operation.

The requirement “IT agent must never see or act on HR/Finance data” is not satisfied. Current code permits or risks cross-desk search, reports, exports, generic file downloads, activities/comments, participant management, selected request mutations, user directory exposure, KB visibility and globally scoped administration.

## Isolation model actually implemented

| Boundary | Implementation | Strength | Failure mode |
|---|---|---|---|
| Tenant | `tenantId` on 30 schema models; AsyncLocalStorage + Prisma allow-list injection | Useful application isolation | Fails open without context; no RLS; only 28 roots in code allow-list; system/background paths bypass |
| Department/service desk | `serviceDeskId`, desk `code`, user `agentTeam`, `assignedTeam` | Request list/detail partially scoped | String equality and per-controller logic; not universal; future desk codes require code review |
| Confidentiality | `Request.isConfidential`, permission and ownership/approver exceptions | Helpful secondary gate | User-influenced creation path; not a substitute for desk isolation; participants can widen audience |
| Catalog audience | `CatalogEntitlement` records | Good product primitive | Not enforced as a universal API policy and frontend trusts arbitrary desk/category/type IDs |
| Entity/branch | Entity routing and credit branch scopes | Useful workflow context | Entity is not a department security domain; inconsistent across ESM resources |

## Required isolation matrix

| Area | Current backend enforcement | Frontend behavior | Status | Risk | Priority | Effort | Production ready |
|---|---|---|---|---|---|---|---|
| Navigation | None required for security; server returns desks | IT/HR/Finance links are unconditional (`frontend/src/components/layout/navConfig.ts`) | Fail | High | P0 | Medium | No |
| Menus | Permission/role only | Generic AGENT and authenticated pages expose cross-desk entry points | Fail | High | P0 | Medium | No |
| Dashboard | Request list has partial team filters | Renders every service desk returned by API | Partial | High | P0 | Medium | No |
| Ticket/request types | Tenant scoping and optional entitlements | Arbitrary desk/category/type IDs accepted by wizard | Partial | Critical | P0 | Medium | No |
| Queues | `getAllRequests` filters agents by desk code/assigned team | Queue calls are intentionally unscoped and rely on backend | Partial | High | P0 | Medium | No |
| Workflows | Role/status gates vary by controller | Generic AGENT often receives workflow UI | Fail | Critical | P0 | Large | No |
| Templates | Tenant-scoped notification templates; onboarding/offboarding templates | Admin configuration is coarse | Partial | High | P1 | Medium | No |
| Knowledge Base | Tenant scoped; `serviceDeskId` exists but search/list audience is not enforced universally | Global KB UI has no desk audience contract | Fail | High | P1 | Medium | No |
| Reports | Only `report:read`; aggregate queries have no desk condition | Global report pages display all desks/agents | Fail | Critical | P0 | Medium | No |
| Notifications | Per-user records, tenant scoped | No department metadata/filter | Partial | High | P0 | Medium | No |
| Approval flows | Approver IDs/roles/statuses; some entity routing | Approval pages are not department-policy driven | Partial | High | P0 | Large | No |
| Attachments | Request attachment routes now use `assertRequestAccess` | Custom-field files use generic key download | Fail | Critical | P0 | Medium | No |
| Search | Tenant + confidentiality filter | Auth-only global search renders cross-desk result shapes | Fail | Critical | P0 | Medium | No |
| Global search | No agent-team/owner/request-access predicate; direct user search is auth-only | Displays request text, desk, users, emails, departments | Fail | Critical | P0 | Medium | No |
| Assets | Tenant + asset permissions | Several mutation/export controls appear with `asset:read` | Partial | High | P0 | Medium | No |
| Categories | Tenant scoped and desk FK | Desk pages find code client-side | Partial | High | P0 | Medium | No |
| SLA | Tenant-scoped request type/rules | Admin SLA configuration is not delegated per desk | Partial | Medium | P1 | Medium | No |
| Automation | Jobs and rules operate in system context | No department policy surfaced | Fail | High | P0 | Large | No |
| Escalation | Roles and rules, tenant scope | No universal desk target validation | Partial | High | P1 | Medium | No |
| Configuration | Global ADMIN/admin permission | One coarse admin shell exposes all configuration | Fail | Critical | P0 | Large | No |
| API | Auth/RBAC/tenant context present | UI cannot compensate for backend gaps | Fail | Critical | P0 | XLarge | No |
| Database | Tenant keys/checks on roots; service-desk FKs | N/A | Partial | Critical | P0 | Large | No |
| Logs/audit | Tenant scoped general audit | Admin audit UX has no delegated desk scope | Partial | High | P1 | Medium | No |
| Deleted/archived | Request/search normally exclude `deletedAt` | No consistent archive policy UI | Partial | Medium | P1 | Medium | No |
| Future departments | New desks can be inserted | Navigation, labels, confidentiality and actions hardcode current desks | Fail | High | P1 | Large | No |

## Proven isolation failures

### DI-01 — Global request search crosses departments

`backend/src/controllers/search.controller.ts` filters tenant and confidentiality but not request ownership, participant/approver access, agent team or service desk. An IT agent can search non-confidential HR or Finance requests within the tenant. Direct `/search/users` is available to every authenticated user despite the comment saying admin/agent.

**Risk:** Critical · **Priority:** P0 · **Effort:** Medium · **Owner:** Backend Security

### DI-02 — Reports are tenant-wide, not department-scoped

All six ESM report endpoints require only `report:read` (`backend/src/routes/reports.routes.ts`). Every query in `reports.controller.ts` aggregates all tenant requests. Agent workload returns agent email addresses. An IT reporting role can view HR and Finance volumes, SLA, priorities and workloads.

**Risk:** Critical · **Priority:** P0 · **Effort:** Medium · **Owner:** Data/Reporting + IAM

### DI-03 — Arbitrary object-key download bypasses request policy

`GET /api/v1/files/download/*` requires authentication only and passes the supplied key to `getPresignedUrl` (`backend/src/controllers/file.controller.ts`). Anyone who learns or guesses an S3 key can request it without request, department, owner or attachment authorization.

**Risk:** Critical · **Priority:** P0 · **Effort:** Medium · **Owner:** Security + File Platform

### DI-04 — XLSX/PDF exports do not re-authorize records

`POST /requests/export/xlsx` checks `request:export` but `requestExport.service.ts` fetches every supplied ID. `GET /requests/:id/export/pdf` loads the request directly. `GET /pdf-jobs/:jobId` has no job owner check. Export permission therefore expands to cross-desk data access.

**Risk:** Critical · **Priority:** P0 · **Effort:** Medium · **Owner:** Backend Security + Reporting

### DI-05 — Activity read/write misses parent request access

`getRequestActivities` and `addActivity` verify only that the request exists. Any authenticated tenant user with an ID/reference can read activities or add a comment. The frontend’s internal-tab behavior further relies entirely on backend output filtering.

**Risk:** Critical · **Priority:** P0 · **Effort:** Small · **Owner:** Backend Security

### DI-06 — Participant operations permit cross-desk generic agents

Participant controllers treat any AGENT as authorized and directory search is tenant-wide. A generic agent can enumerate or change participants on a request outside the agent’s desk, widening confidential HR/Finance access.

**Risk:** Critical · **Priority:** P0 · **Effort:** Medium · **Owner:** Backend Security + ESM Product

### DI-07 — Generic request update/assignment paths are broader than request access

`updateRequest` treats any AGENT as authorized and `assignRequest` updates the supplied request ID after only a coarse permission route check. They do not consistently call `assertRequestAccess`. Several workflow controllers also use role/status conditions without desk ownership.

**Risk:** Critical · **Priority:** P0 · **Effort:** Large · **Owner:** Backend/Workflow

### DI-08 — HR confidentiality can be influenced by crafted frontend route

The wizard derives `isConfidential` from the URL desk slug while submitting an independent desk ID. A crafted IT-slug URL containing an HR desk/category can submit `isConfidential=false` unless the backend derives sensitivity from canonical request-type policy. Required form fields are also bypassable when the form step unmounts.

**Risk:** Critical · **Priority:** P0 · **Effort:** Medium · **Owner:** Frontend + Backend Product Security

### DI-09 — Notification record mutations lack ownership checks

`PUT /notifications/:id/read` and `DELETE /notifications/:id` update/delete by ID, not `(id,userId)`. Tenant scoping prevents cross-tenant action but not cross-user or cross-department action within a tenant.

**Risk:** High · **Priority:** P0 · **Effort:** Small · **Owner:** Backend Security

### DI-10 — Tenant administration is globally authorized

`/admin/tenants` requires `admin:access`, but `Tenant` itself is not tenant-scoped. A normal tenant ADMIN can list, modify, deactivate and inspect every tenant unless a separate platform-superadmin deployment policy exists outside the code.

**Risk:** Critical · **Priority:** P0 · **Effort:** Medium · **Owner:** IAM/Platform

### DI-11 — Knowledge articles are not audience-filtered

Articles have tenant and optional service desk, but global/article search filters only publish/delete state and text. A Finance or IT user can receive HR articles unless the content is intended to be company-wide; no per-article classification/entitlement is enforced.

**Risk:** High · **Priority:** P1 · **Effort:** Medium · **Owner:** Knowledge Product + Backend

### DI-12 — Department semantics are not data-driven

Navigation, labels, confidentiality logic and workflow behavior hardcode IT/HR/Finance. New Procurement/Legal/Risk/Security desks will not inherit a complete boundary automatically.

**Risk:** High · **Priority:** P1 · **Effort:** Large · **Owner:** Enterprise Architecture

## Negative access tests required before approval

For each role pair—IT agent, HR agent, Finance agent, requester, manager, departmental admin, tenant admin—automated integration tests must attempt all of the following against another desk:

1. List, filter, paginate and retrieve by UUID/reference.
2. Search summary, description, activity, user, KB and attachment metadata.
3. Add/read internal and public comments.
4. Upload, download, preview and delete attachments; call generic key endpoints.
5. Add/remove participants and enumerate user directory candidates.
6. Assign, edit, change priority/confidentiality, transition, approve/reject and cancel.
7. Receive SSE/email/in-app events caused by the other desk.
8. Run dashboards, aggregates, drill-downs and CSV/XLSX/PDF exports.
9. Read/update workflow, SLA, category, template, automation and escalation configuration.
10. Use soft-deleted/archived IDs and job/result IDs.

Expected result is default-deny: `403`, `404` where existence must be hidden, or a filtered list with zero foreign-desk records. UI hiding is never acceptance evidence.

## Target architecture

- Introduce immutable `Department`/`BusinessUnit` IDs and explicit user memberships with roles per department.
- Put `departmentId` (or a policy-derived owner) on every isolatable root: request, KB, report definition/result, notification, attachment/document, asset, workflow definition/instance, template, SLA, automation, audit event and configuration.
- Centralize authorization in one policy service: principal + action + resource + tenant + department + ownership + classification.
- Apply the policy in middleware/service methods and re-check inside exports, jobs, notification targeting and presigned URL generation.
- Add PostgreSQL RLS for tenant and, where mandated, department boundaries; use transaction-local claims for system jobs.
- Replace broad ADMIN/AGENT semantics with platform admin, tenant admin, department admin, desk agent, requester and narrowly scoped approver capabilities.
- Return `allowedActions` with each resource so the frontend renders the server decision instead of recreating policy.

## Acceptance gate

Department isolation is approved only when every matrix row is green, every P0 path is fixed, automated negative tests run against a real PostgreSQL database and object store, and an independent penetration test finds no cross-desk read/write/search/export/notification channel.
