# CWC 2.0 Enterprise Service Management — Current-State Baseline

**Assessment date:** 21 July 2026  
**Decision scope:** large-enterprise production go-live  
**Evidence basis:** current working tree; 285,342 source/config/test LOC; 1,311 source/config files; 188 Prisma models; 84 enums; 76 migrations; 876 Express route declarations in 118 route families; 75 frontend routes. Generated artifacts, dependencies, binary assets, and historical logs were inventoried but were not treated as source.

## Executive baseline

CWC 2.0 is a large modular monolith combining an ESM core with CRM and regulated credit-origination capabilities. It has a credible engineering foundation—typed services, PostgreSQL/Prisma, Redis, BullMQ, SSE, tenant context, granular permissions, dynamic catalog forms, configurable workflow metadata, structured logs, health checks, metrics, CI, containers, backups, and broad domain coverage. It is materially beyond a prototype.

It is nevertheless **not currently production-ready for a large enterprise**. Tenant isolation is application-layer and allow-list based; department isolation is not a first-class authorization dimension; several authenticated APIs permit cross-resource actions; tests and lint are red; SSO/SCIM and universal MFA are absent; workflow state changes remain split between a central service and many direct writes; notification delivery has no durable retry queue; reporting/search/export do not consistently enforce department visibility; and the repository contains only single-node deployment topology.

## Architecture

```text
Browser / React 19 SPA
  |  HttpOnly cookies + Axios; SSE for notifications
  v
Nginx / TLS reverse proxy
  |
  v
Express / TypeScript modular monolith (/api/v1)
  |-- authentication, RBAC, tenant/user AsyncLocalStorage context
  |-- ESM: catalog, requests, approvals, HR/IT/Finance workflows
  |-- shared: KB, search, reports, notifications, assets, scheduler
  |-- CRM module
  |-- Credit module
  |
  +--> Prisma extension --> PostgreSQL
  +--> Redis: token revocation, permission cache, rate limits, locks, SSE, queues
  +--> BullMQ worker: PDF generation
  +--> S3-compatible object storage: attachments/documents
  +--> Resend: email
  +--> OpenAI and placeholder/no-op external credit adapters
```

The deployable is a **modular monolith**, which is appropriate at the present stage. The problem is not the absence of microservices; it is inconsistent enforcement across a very broad monolithic surface and the co-location of schedulers/workers with every API instance (`backend/src/index.ts`).

## Technology and dependency baseline

| Layer | Current implementation | Assessment |
|---|---|---|
| Frontend | React 19, TypeScript, Vite 6, React Router 7, Tailwind 4, Axios, Recharts, i18next, Sentry | Modern but one 4.63 MB minified JS entry bundle; little route splitting |
| Backend | Node.js, Express 4, TypeScript, Zod/Joi, Passport/JWT | Sound baseline; 457 core and 419 credit route declarations |
| Persistence | PostgreSQL + Prisma 5.22 | Rich schema; 188 models, 368 indexes, 48 JSON fields, 132 cascade relations |
| Cache/coordination | Redis/ioredis | RBAC cache, revocation, rate-limit option, SSE pub/sub, scheduler locks, BullMQ |
| Async | BullMQ PDF queue; in-process cron scheduler | Useful start; business notifications/workflow side effects are not durable jobs |
| Files | S3-compatible storage, multer | Request-specific access path exists, but generic key download is unsafe |
| Email | Resend | Templated email; no retry/DLQ or per-user preferences |
| Observability | Winston, correlation ID, Prometheus, live/ready health | No trace/APM stack, alert rules, log shipping, SLOs, or runbooks-as-code |
| CI/CD | GitHub Actions for lint/typecheck/test/build | CI exists; current tests/lint fail; no deployment pipeline or promotion/rollback automation |
| Runtime | Docker Compose, Nginx, Postgres 15, Redis 7 | Single-host topology; containers run as root; no IaC/Kubernetes/managed HA evidence |

## Module and capability inventory

| Module | Current capability | Baseline status | Principal gap |
|---|---|---|---|
| Service catalog | Desk → category → request type, catalog lifecycle, entitlement records, dynamic form JSON, snapshots | Strong/Partial | Entitlements are not a universal backend authorization boundary |
| Core request | Create/list/detail, assignment, comments, attachments, participants, activity, PDF/XLSX | Partial | Multiple subresources and exports miss object-level authorization |
| IT desk | Help, hardware, software, email and approval/fulfilment chains | Functional | No Incident/Problem/Change/Major Incident/CMDB practices |
| HR desk | Hiring, interview, screening, LOA, onboarding, offboarding | Functional | Confidentiality and participant/search/report boundaries are incomplete |
| Finance desk | Purchase, budget, expense, chargeback/payment flows | Functional/Partial | Generic JSON data, incomplete SOD/policy use, cross-desk reporting/export risk |
| Workflow | DB transitions/steps/guards plus hardcoded controllers | Partial | No versioned runtime instances; direct state writes remain; no atomic side effects |
| Approval | RequestApproval, policies, sequential steps, delegation/reminders/timeouts | Partial | AUTO condition is stored but not evaluated; timeout rejects; parallel/quorum incomplete |
| SLA/escalation | Single `slaHours`, pause/resume, breach scan, escalation rules | Partial | No business calendar, response/resolution matrix, OLA/UC, pre-breach tiers |
| Assignment | Round robin/least-loaded/random and entity routing | Partial | String-based team boundary; no skills/capacity/calendar/fallback governance |
| Notifications | In-app, SSE, email, templates | Partial | No durable queue/retry/DLQ/preferences/digest; SMS/push are templates only |
| Search | Request, KB, user global search | Unsafe/Partial | No request team/owner filter in search controller; no attachment index |
| Knowledge | Published articles, desk reference, tags/helpfulness | Partial | Search and UI do not enforce department audience; no review/version workflow |
| Reports | Six ESM aggregates; CRM/credit reports; some exports | Unsafe/Partial | ESM report permission is global and queries have no department scope |
| Assets | Registry, assignments, lifecycle, imports/exports | Partial | Not a CMDB; frontend/backend action scoping must be desk-specific |
| Audit | General audit + stronger credit hash-chain/PII logs | Partial | Core audit is not tamper-evident; audit failure can be non-blocking; cascade exposure |
| Tenant admin | Tenant model, stats and lifecycle | Unsafe | Any `admin:access` principal can reach global tenant management |
| CRM | Accounts, contacts, leads, opportunity/pipeline, AI, import/export | Broad | Child-route UI guards and row scopes are inconsistent |
| Credit | Extensive origination, risk, approvals, documents, compliance | Broad/Strong | Adjacent product greatly increases blast radius and operational complexity |

## Core data flow

1. The SPA restores identity with `/users/me`; protected routes primarily check authentication and selected coarse permissions.
2. Express authentication validates JWT/JTI/revocation, loads roles/permissions, then runs downstream code in tenant and user contexts (`backend/src/middleware/auth.middleware.ts`).
3. A Prisma extension injects `tenantId` only for a hardcoded set of 28 root models (`backend/src/lib/prisma.ts`). Child isolation depends on parent foreign keys and correct controller queries.
4. Requests use `serviceDeskId`, `assignedTeam`, user `agentTeam`, ownership, participation and approver state for visibility. There is no universal department-membership/policy object.
5. Workflow controllers and `requestTransition.service.ts` update requests and synchronously write activities/audit/SLA/notifications. Many controllers still bypass the central transition service.
6. Notifications persist in-app/email records and push SSE through Redis pub/sub; email delivery is synchronous best-effort.
7. Attachments are stored in S3. Request attachment endpoints can check request access, but `/files/download/*` authorizes only by authentication and object key.

## Roles and authorization model

Seeded roles include ADMIN, AGENT, IT_AGENT, NORMAL_STAFF, HIRING_MANAGER, FINANCE_HEAD, CEO, CTO, CFO, GROUP_DCEO, CRM roles, and CREDIT roles. Permissions use `resource:action` names and union across roles. Redis caches permissions for five minutes. The model has no deny rules, no role hierarchy semantics, no department-bound grant, no contextual condition language, and no universal resource-policy evaluator.

## Verification results

| Check | Result | Production implication |
|---|---|---|
| Backend TypeScript build | Pass | Compile baseline exists |
| Frontend production build | Pass with 4.63 MB chunk warning | Performance budget absent |
| Prisma validate | Pass | Schema parses |
| Backend tests | **Fail: 33/149 suites, 226/1,657 tests** | Release gate blocked |
| Frontend tests | **Fail: 11/27 files, 13/160 tests** | Release gate blocked |
| Backend lint | **Fail: 2 errors, 1,420 warnings** | CI gate blocked |

The failures include test-runner mismatch, missing imports, tenant constraint drift, Redis mock breakage, workflow expectation drift, CRM UI contract drift, and accessibility regression. They cannot be waived as one missing external service.

## Strengths

- Tenant IDs, tenant foreign keys/check constraints and composite tenant indexes exist on important roots.
- Access tokens have JTI revocation, refresh tokens are hashed and rotated, cookies are HttpOnly/Secure in production, passwords use bcrypt, and lockout exists.
- Request list/detail scoping has explicit agent-team and confidentiality logic.
- Form configuration snapshots preserve historical request meaning.
- Conditional-rule validation utilities, workflow guards, scheduler locks, queue monitoring, health/readiness and metrics demonstrate good platform instincts.
- HR hire-to-exit and credit governance are unusually deep for a custom service platform.
- Backups, restore verification scripts, CI gates and a production hardening checklist exist.

## Weaknesses, technical debt and production risks

- Department isolation is encoded inconsistently through `agentTeam`, desk code, ownership, role and controller-specific conditions.
- Application-level tenant scoping fails open without context and has no PostgreSQL RLS defense.
- BOLA/IDOR remains in generic files, notifications, request activities/comments/participants, exports/PDF jobs, and selected mutation controllers.
- Local authentication cannot meet typical enterprise SSO, lifecycle, conditional-access and SCIM requirements.
- Workflow/approval changes are not versioned per in-flight request and side effects are not atomic.
- A single `slaHours` does not model enterprise response/resolution calendars.
- Search/report/KB/notification schemas do not consistently carry or enforce department audience.
- Frontend route/menu checks are not security controls and several child/action routes are too broad.
- Core audit and deletion policy are weaker than the credit module; 132 cascade relationships require compliance review.
- Production topology is single-node and has no tested HA, PITR, off-site immutable backup, RTO/RPO, SLO or load-test evidence.

## Baseline production decision

**Maturity: Level 2 — Internal.** The platform can support controlled internal pilots with strict data classification and limited departments. It does not meet the approval threshold for a large-enterprise production deployment until the P0 authorization/isolation paths and red release gates are closed and independently tested.
