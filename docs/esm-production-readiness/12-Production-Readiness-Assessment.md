# Production Readiness Assessment

## Executive summary

**Recommendation: NO-GO for large-enterprise production.**  
**Enterprise readiness score: 38/100.**  
**Maturity: Level 2 — Internal.**

CWC 2.0 has a substantial product and credible engineering foundations. It compiles, its schema validates, and it includes tenant IDs, RBAC, request confidentiality, dynamic catalog forms, workflow metadata, rich HR/Finance/IT flows, queues, distributed coordination primitives, health checks, metrics, CI, containers and backup scripts.

The board cannot approve go-live because active, reproducible P0 weaknesses permit cross-department/cross-resource access and because the release/operations evidence is red or incomplete. The current platform is suitable for controlled internal pilots using non-sensitive or tightly constrained data, but not for enterprise production containing HR, Finance, credit or regulated documents.

## Architecture diagram

```text
Users
  -> Nginx/TLS
  -> React SPA
       -> Express modular monolith (/api/v1)
            -> Auth/JWT/RBAC + tenant/user context
            -> ESM / HR / Finance / IT / CRM / Credit modules
            -> Prisma application tenant filter
                 -> PostgreSQL shared schema
            -> Redis (revocation, cache, SSE, locks, BullMQ)
            -> S3 files | Resend email | external/placeholder adapters

Critical missing boundaries:
  Department policy decision point
  PostgreSQL RLS / tenant-safe FKs
  Transactional workflow + outbox
  Durable notification/timer workers
  HA deployment + proven DR
```

## Readiness score

| Dimension | Score /100 | Gate assessment |
|---|---:|---|
| Architecture | 60 | Modular foundation, inconsistent cross-cutting policy |
| Security | 32 | Active BOLA/IDOR, output and XSS findings |
| RBAC | 25 | Global across tenants; no department-bound grants |
| Workflow | 48 | Good primitives, unsafe runtime semantics |
| Department Isolation | 20 | Not a universal boundary |
| Tenant Isolation | 45 | Partial app layer; missing models/RLS/platform admin split |
| Notification | 43 | Functional channels, no durable reliability/governance |
| Search & Visibility | 20 | Cross-desk request/KB/user visibility |
| Performance | 47 | Large bundle, in-memory aggregates, limited evidence |
| Scalability | 42 | Stateless elements exist; scheduler/single-host constraints |
| Reporting | 32 | Basic metrics, unsafe global scope/export |
| Database | 48 | Rich/indexed; isolation, FK, lifecycle and DR gaps |
| QA / Release | 30 | Tests and lint red; E2E stale/incomplete |
| Operations / SRE | 40 | Health/logs/metrics exist; HA/SLO/alerts/CD lacking |
| Compliance | 38 | Strong credit patterns, weak platform-wide controls |
| **Weighted overall** | **38/100** | **No-Go** |

Scores reflect evidence, not feature count. Any open Critical P0 caps the overall recommendation regardless of average.

## Production readiness matrix

| Area | Current evidence | Status | Risk | Priority | Effort | Ready |
|---|---|---|---|---|---|---|
| Availability | Single-host Compose | Fail | High | P0 | XLarge | No |
| Scalability | Redis/SSE/queues exist; cron and rate limits unsafe for replicas | Partial | High | P0 | Large | No |
| Reliability | Non-atomic workflows, best-effort notifications | Fail | High | P1 | Large | No |
| Observability | Logs, correlation IDs, Prometheus, live/ready | Partial | Medium | P1 | Medium | No |
| Monitoring/alerting | No alert rules/SLO/on-call evidence | Fail | High | P1 | Large | No |
| Health checks | DB and optional Redis | Partial | High | P1 | Medium | No |
| Caching | Permission and selected caches | Partial | Medium | P2 | Medium | Conditional |
| Disaster recovery | Scripts/policy, no proven enterprise topology | Fail | Critical | P0 | XLarge | No |
| Backup/restore | Logical scripts; optional/skippable verification | Partial | High | P0 | Large | No |
| Security | Strong primitives plus Critical failures | Fail | Critical | P0 | XLarge | No |
| CI/CD | CI design exists; baseline red; unsafe deploy | Fail | Critical | P0 | Large | No |
| Rollback | No safe application/database automatic rollback | Fail | High | P0 | Large | No |
| Configuration | Central env config; weak required-secret enforcement | Partial | High | P1 | Medium | No |
| Secrets | Env files/defaults; no secret manager evidence | Fail | High | P0 | Medium | No |
| Environment management | Version/topology drift | Fail | High | P1 | Medium | No |
| Feature flags | Partial/credit-centric, tenant cache risk | Partial | High | P1 | Medium | No |
| Production support | No complete operating model/runbooks/drills | Fail | High | P0 | Large | No |

## Critical blockers

1. Cross-tenant RBAC and platform tenant administration are not separated.
2. Department isolation is not an enforced policy dimension.
3. Search, reports, HR workflows, generic agents, files, activities, participants and exports contain P0 BOLA/BFLA paths.
4. User APIs can return password/MFA security fields.
5. Credit direct-ID scope is inconsistent and privileged MFA is not mounted.
6. Catalog entitlement/policy tenant scoping is incomplete and database RLS is absent.
7. Backend/frontend tests and backend lint fail.
8. Workflow state/audit/outbox is non-atomic and definitions are unversioned.
9. Normal schedulers bypass distributed locking and SLA cadence is not fit for hour-level commitments.
10. Deployment, HA, backup/PITR, rollback and production support evidence do not meet enterprise go-live standards.

## Quick wins: 0–15 days

- Disable generic file-key download and unsafe request exports/PDF results until owner checks ship.
- Replace every user response with allowlisted DTOs.
- Add owner/request policy checks to notification, activity and participant operations.
- Sanitize announcements; remove sensitive local drafts; fix SSE reload.
- Mount MFA on privileged routes and remove general query-token use.
- Add ApprovalPolicy/CatalogEntitlement to tenant scope; require tenant context for normal operations.
- Enforce Redis rate-limit/scheduler safe settings and remove insecure secret defaults.
- Repair tests/lint and make the CI gate authoritative.

## 90-day remediation plan

### Days 0–15 — Containment

- Freeze production launch and external sensitive-data onboarding.
- Close findings #1–#19 and #31–#33 from the Top 100 register.
- Add emergency negative tests for IT↔HR↔Finance search/read/write/file/export paths.
- Rotate/validate all production secrets and introduce platform-superadmin separation.

**Exit gate:** no known unauthorised cross-desk read/write path; user secrets never serialize; release baseline green.

### Days 16–30 — One authorization boundary

- Introduce Department/BusinessUnit memberships and scoped grants.
- Implement a central policy/query-scope service and apply it to requests, HR workflows, search, reports, files, participants, notifications, assets and credit direct-ID services.
- Bind async jobs/results/exports to actor and policy snapshot.
- Start PostgreSQL RLS/composite-key design and live-schema drift assessment.

**Exit gate:** real two-tenant/three-department PostgreSQL integration matrix is green; independent security review confirms closure.

### Days 31–45 — Workflow and timing correctness

- Make transitions optimistic and transactional with immutable history + outbox.
- Eliminate direct status writes.
- Lock/move all scheduled callbacks to durable workers; increase SLA timer cadence.
- Disable destructive timeout auto-rejection; fix approval sequencing/conditions/delegation governance.

**Exit gate:** concurrency, crash/restart, idempotency and retry tests pass.

### Days 46–60 — Durable communications and data controls

- Deliver notification outbox/workers, retry, DLQ, metrics and operator replay.
- Enforce recipient access and template tenant/department/locale keys.
- Add DLP, watermark, expiry and audit for ESM exports.
- Apply quarantine/AV lifecycle to all uploads.

**Exit gate:** provider outage and duplicate-delivery tests pass; zero cross-desk notification/export leakage.

### Days 61–75 — Release and observability

- Replace mutable-host deployment with signed immutable artifact promotion and reviewed `migrate deploy`.
- Add OpenAPI control metadata, SAST/SCA/secret/container scans, SBOM, Playwright role/desk tests and coverage thresholds.
- Add tracing, business/queue/security metrics, alerts, SLOs and on-call runbooks.

**Exit gate:** staged/canary deployment and rollback exercise passes; alert drills reach on-call.

### Days 76–90 — HA and DR proof

- Deploy multi-instance app/worker topology with managed/HA Postgres and Redis.
- Enable encrypted immutable off-site backups, WAL/PITR and object-version backup.
- Run timed restore/failover and load/soak tests at target volume.
- Complete privacy/terms/retention/support documentation and operational readiness review.

**Exit gate:** signed RPO/RTO evidence, performance capacity report, penetration test closure, and zero open P0/P1 go-live defects.

## Six-month roadmap

| Month | Outcome |
|---|---|
| 1 | Authorization containment, green release gates, platform/tenant admin separation |
| 2 | Department policy model, universal resource policy, negative isolation suite, RLS phase 1 |
| 3 | Transactional/versioned workflow runtime, durable timers/outbox/notifications |
| 4 | Enterprise CI/CD, telemetry/SLOs, HA and DR automation, production operating model |
| 5 | Business-calendar SLA, governed reports/exports, knowledge audiences, catalog publication package |
| 6 | ITSM capability expansion decision: Incident/Change first; CMDB/Problem only if strategy requires; independent certification/pen test |

Strategic work after security and reliability should include metadata-driven future departments, request/KB classification, scheduled governed reports, localization, connector/webhook architecture, and consistent platform-wide tamper-evident audit. Feature expansion must not displace P0/P1 remediation.

## Go-live decision criteria

The board may reconsider only when all of the following are evidenced:

- Zero open Critical/High broken-access-control or tenant/department isolation findings.
- Green builds, lint, unit/integration/E2E/security/load suites on an immutable release candidate.
- Independent API/web penetration test and data-isolation test closure.
- SSO/SCIM/MFA and least-privilege permission matrix approved by IAM and business owners.
- Transactional/versioned workflows with durable outbox/timers and operator recovery.
- HA topology, capacity results, alerting/on-call/SLOs, encrypted PITR backups and timed restore/failover evidence.
- Approved privacy, retention, audit, incident response, change/release and production support procedures.

## External assessment anchors

The board used the repository as the source of truth and anchored control expectations to current primary guidance:

- [OWASP API1:2023 — Broken Object Level Authorization](https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/)
- [OWASP API3:2023 — Broken Object Property Level Authorization](https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/)
- [OWASP API5:2023 — Broken Function Level Authorization](https://owasp.org/API-Security/editions/2023/en/0xa5-broken-function-level-authorization/)
- [NIST SP 800-207 — Zero Trust Architecture](https://www.nist.gov/publications/zero-trust-architecture-0)
- [CIS Software Supply Chain Security Guide](https://www.cisecurity.org/insights/white-papers/cis-software-supply-chain-security-guide)

These references do not substitute for enterprise policy, legal advice, a live-environment configuration review, penetration testing, or formal certification.

## Final recommendation

**NO-GO.** Approve only a tightly controlled internal pilot with synthetic/non-sensitive data and explicit executive risk acceptance. Do not onboard large-enterprise HR, Finance, Credit or confidential attachments until the 90-day gates are met and independently verified.
