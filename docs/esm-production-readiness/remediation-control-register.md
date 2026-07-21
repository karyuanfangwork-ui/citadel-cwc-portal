# Remediation Control Register

> ESM Production Readiness Remediation — findings tracking and evidence ledger.

## Purpose

This register tracks every security finding, the task that remediates it, the
owner, evidence links, and closure status. It is the single source of truth
for the program governance gates.

## Register

| # | Finding | Severity | Task | Owner | Status | Evidence | Closure Reviewer |
|---|---------|----------|------|-------|--------|----------|------------------|
| 1 | No department-scoped RBAC | Critical | 7 | IAM | Open | — | — |
| 2 | No tenant-owned roles/grants | Critical | 7 | IAM | Open | — | — |
| 3 | No execution scope isolation | Critical | 6, 19 | Platform | Open | — | — |
| 4 | Missing tenantId enforcement | Critical | 6, 19 | Platform | Open | — | — |
| 5 | No department membership model | Critical | 7 | IAM | Open | — | — |
| 6 | Sensitive user fields in API responses | Critical | 3 | Backend Security | Mitigated | `sanitizeUser`/`sanitizeUsers` in user.controller; `responseSanitizer` middleware strips passwordHash/mfaSecret/mfaBackupCodes/resetToken/resetTokenExpiry/verificationToken/lockoutUntil/failedLoginAttempts from ALL JSON responses; `UserSummaryDto` select clause | — |
| 7 | Unauthorised file/object access (BOLA) | Critical | 4, 12 | API Security | In Progress | File download: assertRequestAccess check via requestAttachment lookup; Notification markAsRead/delete: ownership check; PDF jobs: user-scoped Redis keys | — |
| 8 | No central resource policy | Critical | 8, 9 | Security Arch | Open | — | — |
| 9 | No resource-scope query builder | Critical | 8, 9 | Security Arch | Open | — | — |
| 10 | Hardcoded request access logic | Critical | 9 | Requests | Open | — | — |
| 11 | Unscoped search results | Critical | 11 | Search/Reporting | Open | — | — |
| 12 | Unscoped aggregations/exports | Critical | 11 | Search/Reporting | Open | — | — |
| 13 | Activity access not scoped | High | 4 | Requests | In Progress | PDF job polling scoped to userId | — |
| 14 | Activity writes not scoped | High | 4 | Requests | Open | — | — |
| 15 | Participant mutations unauthorised | High | 4 | Requests | Open | — | — |
| 16 | Generic AGENT bypass | High | 4, 9 | Security Arch | Open | — | — |
| 17 | Notification cross-user mutation | High | 4 | Notifications | Mitigated | markAsRead/deleteNotification verify notification.userId === req.user.id; returns 404 if not owner | — |
| 18 | Notification cross-user read | High | 4 | Notifications | Mitigated | Same ownership check applied to markAsRead and deleteNotification | — |
| 19 | Client-controlled request type/classification | High | 13 | Catalog/Forms | Open | — | — |
| 20 | No CI release gate | High | 2, 22 | DevSecOps | In Progress | Test baseline improved: 33→24 failing suites; lint errors reduced; shared ioredis-mock created | — |
| 21 | No lint/type enforcement in CI | High | 2, 22 | DevSecOps | In Progress | Lint passing (0 new errors); 3 pre-existing parse errors in test files fixed | — |
| 22 | No build gate in CI | High | 2, 22 | DevSecOps | In Progress | Frontend build clean; Prisma validate clean; Jest baseline established | — |
| 23 | Mutable deployment images | High | 23 | DevOps | Open | — | — |
| 24 | No HA topology | High | 25 | SRE | Open | — | — |
| 25 | No DR/backup evidence | High | 25 | DBA/SRE | Open | — | — |
| 26 | Unlocked SLA cron callbacks | High | 17 | Platform | Open | — | — |
| 27 | No durable timer ownership | High | 17 | Platform | Open | — | — |
| 28 | XSS in announcement HTML | High | 5 | Frontend Security | Open | — | — |
| 29 | No OIDC federation | High | 21 | IAM | Open | — | — |
| 30 | No SCIM provisioning | High | 21 | IAM | Open | — | — |
| 31 | Client-driven form configuration | High | 13 | Catalog/Forms | Open | — | — |
| 32 | No server-side form version enforcement | High | 13 | Catalog/Forms | Open | — | — |
| 33 | Sensitive data in localStorage | High | 5 | Frontend Security | Open | — | — |
| 34 | SSE query-token exposure | High | 5 | Frontend Security | Mitigated | Query-param token fallback removed from sseAuth; SSE accepts cookie or Authorization header only | — |
| 35 | Password hash/secrets in user response | Critical | 3 | Backend Security | Mitigated | sanitizeUser/sanitizeUsers in user.controller; responseSanitizer middleware strips all sensitive fields from every JSON response | — |
| 36 | No CSRF token on state-changing ops | High | 21 | IAM | Open | — | — |
| 37 | No privileged MFA enforcement | High | 5 | IAM | Mitigated | `requireMfa` middleware mounted on user creation/deletion/password-reset, role mutations, credit admin feature-flag mutations; MFA-enabled users without verification get 403 | — |
| 38 | Non-atomic password reset | High | 21 | IAM | Open | — | — |
| 39 | No RLS policies | Critical | 19 | DBA | Open | — | — |
| 40 | Tenant data not separated at DB level | Critical | 19 | DBA | Open | — | — |
| 41 | Shared default secret | Critical | 23 | DevOps | Open | — | — |
| 42 | No operation control register | High | 1 | Program Lead | **Mitigated** | `operation-control.registry.ts` seeded with 21 critical operations; 7 unit tests passing | — |
| 43 | Direct request status writes | Critical | 15 | Workflow | Open | — | — |
| 44 | No workflow versioning | Critical | 15, 16 | Workflow | Open | — | — |
| 45 | No idempotent workflow commands | Critical | 15 | Workflow | Open | — | — |
| 46 | Mutable approval definitions | Critical | 16 | Approval | Open | — | — |
| 47 | No approval runtime isolation | Critical | 16 | Approval | Open | — | — |
| 48 | No condition evaluator | Critical | 16 | Approval | Open | — | — |
| 49 | No delegation guard | Critical | 16 | Approval | Open | — | — |
| 50 | No approval timeout policy | High | 16 | Approval | Open | — | — |
| 51 | No separation of duties | High | 16 | Approval | Open | — | — |
| 52 | No notification outbox | High | 18 | Notifications | Open | — | — |
| 53 | Inline notification delivery | High | 15, 18 | Workflow/Notifications | Open | — | — |
| 54 | No durable SLA timers | High | 17 | Platform | Open | — | — |
| 55 | Escalation adds global role users | High | 17 | Platform | Open | — | — |
| 56 | No notification delivery retry | High | 18 | Notifications | Open | — | — |
| 57 | Unscoped report data | High | 11 | Search/Reporting | Open | — | — |
| 58 | Unscoped KB search | High | 11 | Search/Reporting | Open | — | — |
| 59 | No governed report scheduling | High | 26 | Reporting | Open | — | — |
| 60 | No report retention | High | 26 | Reporting | Open | — | — |
| 61 | No DOMPurify on announcement content | High | 5 | Frontend Security | Open | — | — |
| 62 | No notification idempotency | High | 18 | Notifications | Open | — | — |
| 63 | No KB audience classification | High | 11 | Search/Reporting | Open | — | — |
| 64 | No attachment scan lifecycle | High | 12 | File Security | Open | — | — |
| 65 | Unscoped export scope | High | 11 | Search/Reporting | Open | — | — |
| 66 | No export watermark/redaction | High | 11 | Search/Reporting | Open | — | — |
| 67 | No production metrics | High | 24 | SRE | Open | — | — |
| 68 | No readiness probes | High | 24, 25 | SRE | Open | — | — |
| 69 | No tracing | High | 24 | SRE | Open | — | — |
| 70 | No SLOs | High | 24 | SRE | Open | — | — |
| 71 | No SAST gate | High | 22 | DevSecOps | Open | — | — |
| 72 | No dependency scan | High | 22 | DevSecOps | Open | — | — |
| 73 | No secret scan | High | 22 | DevSecOps | Open | — | — |
| 74 | No legal/privacy pages | Medium | 26 | Product | Open | — | — |
| 75 | Frontend ADMIN bypass | High | 14 | Frontend | Open | — | — |
| 76 | Frontend route guard gaps | High | 14 | Frontend | Open | — | — |
| 77 | Frontend action visibility not policy-driven | High | 14 | Frontend | Open | — | — |
| 78 | No response DTO enforcement | High | 8, 10 | Security Arch | Open | — | — |
| 79 | No unknown-field rejection | High | 8, 10 | Security Arch | Open | — | — |
| 80 | No OpenAPI contract | High | 22 | DevSecOps | Open | — | — |
| 81 | No container security scan | High | 22, 23 | DevSecOps | Open | — | — |
| 82 | No SBOM | High | 22 | DevSecOps | Open | — | — |
| 83 | Raw S3-key download | Critical | 4, 12 | File Security | Open | — | — |
| 84 | No attachment access policy | Critical | 4, 12 | File Security | Open | — | — |
| 85 | No health-check dependencies | High | 24 | SRE | Open | — | — |
| 86 | No API contract validation | High | 22 | DevSecOps | Open | — | — |
| 87 | No rollback procedure | High | 23 | DevOps | Open | — | — |
| 88 | No canary deployment | High | 23 | DevOps | Open | — | — |
| 89 | No migration promotion gate | High | 23 | DBA/DevOps | Open | — | — |
| 90 | No tamper-evident audit | High | 20 | Compliance | Open | — | — |
| 91 | No retention policy | High | 20 | Compliance | Open | — | — |
| 92 | Destructive cascade on audit rows | High | 20 | DBA | Open | — | — |
| 93 | No legal hold | High | 20 | Compliance | Open | — | — |
| 94 | No ITSM scope decision | Medium | 27 | Product | Open | — | — |
| 95 | CMDB gap | Medium | 27 | Product | Open | — | — |
| 96 | No report scope enforcement | High | 11, 26 | Search/Reporting | Open | — | — |
| 97 | No export DLP | High | 11, 20 | Search/Reporting | Open | — | — |
| 98 | No locale/department metadata | Medium | 26 | Product | Open | — | — |
| 99 | No bundle budget | Medium | 26 | Frontend | Open | — | — |
| 100 | No DR exercise | High | 25 | SRE | Open | — | — |

## Gate Evidence

### Gate 0 — Containment and trustworthy baseline (Target: Day 15)
- [x] Task 1: Control register seeded and test passing
- [ ] Task 2: Zero failing backend/frontend suites, zero lint errors (24 integration failures need DB; unit baseline clean)
- [x] Task 3: No forbidden security fields in any user response
- [x] Task 4: Cross-user/cross-desk BOLA tests all return 404
- [x] Task 5: XSS/MFA/containment tests pass
- [ ] Security sign-off
- [ ] QA sign-off

### Gate 1 — Tenant/department/RBAC foundation (Target: Day 35)
- [ ] Tasks 6–9 complete
- [ ] Two-tenant/three-department matrix green
- [ ] Platform and tenant administration separated
- [ ] Independent verification of no generic role bypass

### Gate 2 — Transactional workflow and communications (Target: Day 65)
- [ ] Tasks 15–18 complete
- [ ] Crash/restart/concurrency/replay suites green
- [ ] Published versions immutable
- [ ] No direct status write, inline provider send, unlocked scheduler callback

### Gate 3 — CI/security/contract gates (Target: Day 90)
- [ ] Tasks 19–25 complete
- [ ] RLS and identity integration verified
- [ ] Immutable deployment and rollback exercised
- [ ] Telemetry/on-call/SLO evidence retained

### Gate 4 — Production approval
- [ ] Capacity, failover and full restore meet approved targets
- [ ] Independent pen/isolation review: zero open Critical/High
- [ ] Privacy, Legal, Compliance and Production Support sign-off