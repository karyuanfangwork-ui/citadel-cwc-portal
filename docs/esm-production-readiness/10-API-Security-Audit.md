# API Security Audit

## Scope and method

The current route graph was enumerated and reviewed: **118 route files, 876 declared HTTP handlers**—370 GET, 277 POST, 72 PUT, 71 PATCH and 86 DELETE. Core contributes 45 families/457 handlers; Credit contributes 73 families/419 handlers. Review traced route inheritance, authentication, permissions, controller queries, tenant context, validation and output handling. Route-level `validate(...)` occurs about 160 times; controllers sometimes validate manually, so this is a coverage indicator rather than an exact percentage.

## Verdict

**FAIL — Critical — P0.** Authentication is widespread, but object- and function-level authorization is inconsistent. The most dangerous paths are authenticated endpoints that treat possession of an ID/key as authority.

## Endpoint-family coverage ledger

| Surface | Families reviewed | AuthN baseline | Principal authorization result |
|---|---:|---|---|
| Auth/session/password | auth | Mixed public/private as designed | Partial; reset race, token exposure, no universal MFA |
| Users/RBAC/tenant | user, tenant | Authenticated/admin routes | Fail: raw secrets, global RBAC/tenant control |
| Requests/subresources | request, participant, file, pdfJob | Authenticated + selected permissions | Fail: activity/participant/file/export/PDF BOLA |
| Catalog/config | serviceDesk, catalogEntitlement, banner, systemSetting, entity | Authenticated/admin/permission | Fail: missing central tenant scope for entitlement; coarse admin |
| Workflow/approval | approval, approvalPolicy, approvalDelegation, workflow, workflowTransition, requestStatus | Authenticated, mixed permissions | Fail: authenticate-only legacy actions and unscoped histories |
| HR | interview, screening, LOA, onboarding/offboarding + templates | Mostly authenticated | Fail: pervasive request-object BOLA |
| IT/Finance/ESM | it-workflow, finance-workflow, chargeback, esm-workflow | Auth + broad roles | Fail: generic AGENT/auth-only cross-desk actions |
| Notifications | notification, SSE, templates | Authenticated/SSE auth | Fail: notification owner IDOR; targeting gaps |
| Search/KB/reports | search, KB, reports, insights | Auth + selected permission | Fail: cross-desk visibility/aggregation |
| Assets/SLA/audit | asset, escalation/SLA, audit | Permissions/admin | Partial; desk scope and escalation recipient gaps |
| Scheduler/queues | scheduler, queue | Admin permission | Partial; operational semantics unsafe under HA |
| CRM | crm (137 handlers), CRM AI | Auth + CRM permission family | Partial; mass assignment/child scope inconsistencies |
| Credit applications/borrowers/docs | application, borrower, party, facility, document, comments | Credit permissions, some scope middleware | Fail: direct-ID scope ignored/inconsistent |
| Credit decisions/governance | approval, committee, delegation, scoring, overrides, signoff, disbursement, DLP, MFA | Credit action permissions | Partial/Fail: MFA not mounted; scope varies |
| Credit financial/risk | financials, income, projections, risk, ESG, ECL, SICR, ratings, pricing, profitability | Credit read/write | Partial: broad permission, child BOLA review required |
| Credit compliance/integrations | AML/STR, consent, FATCA/CRS, bureau, webhook, AI | Mixed credit/service auth | Partial: service callback binding and placeholder adapters |
| Credit monitoring/reporting | monitoring, covenants/items, dashboards, reports, exposure | Credit read/write | Partial: direct-ID and export scope inconsistent |

## Required API matrix

| Control | Current status | Risk | Priority | Ready |
|---|---|---|---|---|
| Authentication | Broadly present | Medium | P1 | Partial |
| Function authorization | Mixed role/permission/auth-only | Critical | P0 | No |
| Object authorization | Inconsistent | Critical | P0 | No |
| Department filtering | Not universal | Critical | P0 | No |
| Tenant filtering | Allow-list Prisma extension | Critical | P0 | No |
| Input validation | Incomplete | High | P1 | No |
| Output filtering | Raw User responses exist | Critical | P0 | No |
| Rate limiting | Global/auth/sensitive tiers; Redis opt-in | High | P1 | No |
| Pagination | Inconsistent caps | Medium | P2 | No |
| Mass assignment | Concrete raw-body paths | High | P1 | No |
| Injection | Prisma reduces SQL injection; raw-query whitelist review needed | Medium | P1 | Partial |
| File security | Type/signature limits but key BOLA/AV gaps | Critical | P0 | No |
| API contract/versioning | `/v1`; no OpenAPI/deprecation policy | Medium | P2 | No |

## Priority findings

| ID | Endpoint/path | Finding | Impact | Risk | Priority | Effort | Owner |
|---|---|---|---|---|---|---|---|
| API-01 | `GET /files/download/*` | Signs arbitrary S3 key; no resource/tenant/desk policy | Any authenticated user can retrieve registered/unregistered objects | Critical | P0 | Medium | File/Security |
| API-02 | `POST /requests/export/xlsx` | Caller IDs are fetched without per-record access | Bulk HR/Finance export | Critical | P0 | Medium | Reporting/Security |
| API-03 | `GET /requests/:id/export/pdf` | No actor passed to PDF data loader | Confidential request export | Critical | P0 | Medium | Reporting/Security |
| API-04 | `GET /pdf-jobs/:jobId` | Job/result not bound to creator | Presigned URL disclosure | Critical | P0 | Small | Queue/Security |
| API-05 | Request activities | Read/add check existence only | Cross-desk timeline read/write | Critical | P0 | Small | Requests |
| API-06 | Request participants | Any AGENT bypasses ownership/team | Confidentiality boundary expansion | Critical | P0 | Medium | Requests/IAM |
| API-07 | Notification read/delete | Mutation by ID only | Cross-user inbox tampering | High | P0 | Small | Notifications |
| API-08 | Search requests | No resource/team scope | Cross-department ticket disclosure | Critical | P0 | Medium | Search |
| API-09 | Reports | `report:read` aggregates all desks | Cross-department analytics leakage | Critical | P0 | Medium | Reporting |
| API-10 | HR routes | Authenticate-only ID operations | Employee/LOA/screening/on-offboarding BOLA | Critical | P0 | Large | HR Backend |
| API-11 | IT/Finance/ESM workflows | Generic AGENT/auth-only actions | Cross-desk functional authorization | Critical | P0 | Large | Workflow |
| API-12 | User list/detail/update | Raw `User` rows | Password/MFA hash/secret disclosure | Critical | P0 | Small | Users/Security |
| API-13 | Credit application direct IDs | RM scope filter ignored | Sensitive lending/PII BOLA | Critical | P0 | Large | Credit Security |
| API-14 | Tenant CRUD | Ordinary `admin:access` controls global Tenant | Cross-tenant administration | Critical | P0 | Medium | Platform IAM |
| API-15 | RBAC CRUD | Tenant admin changes global roles/permissions | Cross-tenant vertical escalation | Critical | P0 | Large | IAM |
| API-16 | Catalog entitlement/policy | Tenant-bearing models absent central scope | Cross-tenant config leakage | Critical | P0 | Medium | Backend/DB |
| API-17 | CRM pipeline PATCH and similar | Raw `req.body` persistence | Protected-field/mass assignment | High | P1 | Large | API Owners |
| API-18 | AV callback | One static key; no tenant/job/document hash binding | Spoofed scan result | High | P1 | Medium | Platform Security |
| API-19 | Password reset consume | Non-atomic single-use enforcement | Concurrent reset race | High | P1 | Small | Identity |
| API-20 | SSE query token | Deprecated but accepted | URL/log/history token exposure | High | P1 | Medium | Identity |
| API-21 | Search/user list pagination | Weak caps/validation | Scraping and resource exhaustion | Medium | P2 | Medium | API Platform |
| API-22 | Global rate limit | In-memory by default in multi-instance | Limit multiplication/bypass | High | P1 | Small | Platform |
| API-23 | Response contracts | No OpenAPI/output schemas | Client drift and excessive properties | Medium | P2 | Large | API Governance |
| API-24 | CSRF | Cookie auth without token/origin enforcement | Same-site/cross-site mutation risk | Medium | P2 | Medium | Security |

## Mandatory remediation pattern

For every handler:

1. Authenticate and reject inactive/tenant-disabled users.
2. Validate path/query/body with strict schemas; reject unknown fields.
3. Resolve the resource in tenant context without disclosing foreign existence.
4. Decide `principal, action, resource, department, classification, ownership` centrally.
5. Use allowlisted request DTOs and response DTOs.
6. Apply bounded pagination/rate/size limits.
7. Write immutable audit for privileged reads/writes/exports.
8. For async jobs, persist actor and policy snapshot and re-authorize result retrieval.
9. Add negative tests for tenant/department/owner/role/state and mass-assignment probes.

## Go-live gate

Generate an OpenAPI inventory from the 876 handlers and require a machine-readable control record per operation: authentication, permission, object policy, department scope, validators, response schema, rate tier and audit event. CI must fail when a new operation lacks any required field. Independent API penetration testing must close all BOLA/BFLA/property-level findings.
