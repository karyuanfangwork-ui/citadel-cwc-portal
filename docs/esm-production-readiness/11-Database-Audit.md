# Database Audit

## Verdict

**Partial — Critical isolation/integrity gaps — P0/P1 — Not production-ready.** The PostgreSQL/Prisma schema is extensive and indexed, but tenant enforcement is split between nullable ORM types, migration check constraints and an application allow-list. There is no RLS or tenant-safe composite relational integrity, cross-tenant RBAC is global, transaction boundaries are inadequate, and enterprise backup/PITR/HA evidence is absent.

## Quantitative baseline

| Measure | Current count | Assessment |
|---|---:|---|
| Prisma models | 188 | Very broad shared schema |
| Enums | 84 | Strong state typing, but migration-heavy |
| Migrations | 76 | Meaningful history; drift must be checked |
| Explicit indexes | 368 | Good baseline; workload validation still required |
| Composite unique constraints | 48 | Several identifiers remain globally unique |
| JSON fields | 48 | Flexibility with reporting/constraint debt |
| Models with `tenantId` | 30 | Central extension scopes only 28 |
| Models with `deletedAt` | 13 | Inconsistent lifecycle/retention strategy |
| `onDelete: Cascade` relations | 132 | Audit/retention review required |
| `onDelete: Restrict` relations | 1 | Weak protection for regulated history |

## Required database matrix

| Area | Current implementation | Status | Risk | Priority | Effort | Ready |
|---|---|---|---|---|---|---|
| Schema design | Rich normalized roots plus 48 JSON fields | Partial | Medium | P2 | Ongoing | Conditional |
| Indexes | 368, including tenant composites | Partial | Medium | P1 | Medium | Conditional |
| Constraints | PK/FK/unique/check mix | Partial | High | P1 | Large | No |
| Foreign keys | Broad but not tenant-composite | Fail | High | P1 | XLarge | No |
| Soft delete | 13 models only | Fail | High | P1 | Large | No |
| Audit columns | created/updated common; immutable audit uneven | Partial | High | P1 | Large | No |
| Tenant isolation | App extension + checks | Fail | Critical | P0 | XLarge | No |
| Department isolation | No universal department key/RLS | Fail | Critical | P0 | XLarge | No |
| Transactions | Selected, but workflows/password reset incomplete | Fail | High | P1 | Large | No |
| Locking/concurrency | Limited optimistic/pessimistic control | Fail | High | P1 | Large | No |
| Performance | Index base good; unbounded/in-memory aggregates remain | Partial | High | P1 | Medium | No |
| Backup | Logical dump script, local retention | Partial | High | P0 | Large | No |
| Restore | Verification script can skip actual restore | Partial | High | P0 | Medium | No |
| PITR/replication/HA | No repository evidence | Missing | Critical | P0 | XLarge | No |

## Findings

| ID | Current implementation | Expected enterprise implementation | Business impact | Security impact | Risk | Priority | Effort | Owner |
|---|---|---|---|---|---|---|---|---|
| DB-01 | Prisma allow-list has 28 of 30 tenant models | Generated exhaustive scope or RLS; fail closed | Cross-tenant policy/catalog corruption | Isolation bypass | Critical | P0 | Medium | Backend/DB |
| DB-02 | No PostgreSQL RLS | DB-enforced tenant policy with transaction-local identity | One code defect exposes whole tenant | Defense-in-depth absent | Critical | P0 | XLarge | DBA/Security |
| DB-03 | Queries pass through without tenant context | Explicit privileged system context; deny missing context | Jobs/scripts can operate globally accidentally | Cross-tenant access | Critical | P0 | Large | Platform/DB |
| DB-04 | Child FKs reference ID only | Composite `(tenant_id,id)` keys/FKs or enforced triggers | Cross-tenant relation corruption | Lateral data binding | High | P1 | XLarge | Database Architecture |
| DB-05 | Roles/permissions are global | Tenant-owned RBAC with platform catalog separation | Tenant autonomy impossible | Cross-tenant privilege escalation | Critical | P0 | Large | IAM/DB |
| DB-06 | Department is free-form/string/desk logic | Department root and membership/resource FKs | Future desks require code-specific controls | No database boundary | Critical | P0 | XLarge | Enterprise Architecture |
| DB-07 | Prisma `tenantId` often optional while DB adds checks | Align schema/migration/runtime nullability | Runtime/test drift and failed writes | Controls may be assumed but absent | High | P1 | Medium | DBA |
| DB-08 | Email, asset tags/serials, entity codes partly global unique | Tenant-scoped unique keys where business permits | Tenants cannot reuse identifiers | Existence inference | High | P1 | Large | DBA/Product |
| DB-09 | 132 cascades; only one Restrict | Record-specific retention and soft-delete/anonymization | Evidence can disappear with parent | Audit destruction | High | P1 | Large | DBA/Compliance |
| DB-10 | Only 13 soft-delete fields | Lifecycle standard by data class | Inconsistent restore/retention | Hidden hard deletion paths | High | P1 | Large | Data Governance |
| DB-11 | Core audit not immutable/hash chained | Append-only/WORM or signed audit with restricted delete | Disputed changes | Tampering risk | High | P1 | Large | Compliance/Security |
| DB-12 | Workflow changes use multiple transactions | Atomic state/history/outbox transaction | Partial workflows | Missing forensic record | High | P1 | Large | Backend/DB |
| DB-13 | Password reset single-use not conditional/transactional | Atomic `usedAt IS NULL` update + password/session changes | Race and unpredictable account state | Account takeover window | High | P1 | Small | Identity/DB |
| DB-14 | Round robin/read-then-write and transition races | Row locks/atomic increment/optimistic version | Uneven assignment/double decision | Integrity issue | High | P1 | Medium | Backend/DB |
| DB-15 | 48 JSON fields include business data | JSON schemas/checks or normalized facts for governed data | Poor analytics/data quality | Validation bypass | Medium | P2 | Large | Domain/DB |
| DB-16 | Report average loads all resolved rows | SQL aggregate/materialized facts | Memory/time growth | DoS potential | High | P1 | Medium | Data Engineering |
| DB-17 | Logical dump is local and unencrypted; S3 failure warns | Encrypted immutable off-site backups and monitored failure | Restore uncertainty | Backup theft/loss | High | P0 | Large | DBA/SRE |
| DB-18 | No WAL/PITR/replica/failover evidence | Defined RPO/RTO, PITR, replicas and rehearsed failover | Extended outage/data loss | Availability/compliance | Critical | P0 | XLarge | SRE/DBA |
| DB-19 | Restore script may skip DB restore and still succeed; zero rows warn | Mandatory isolated restore, integrity/app checks, timed evidence | False backup assurance | Control failure | High | P0 | Medium | DBA/QA |
| DB-20 | CI uses `db push`, production tooling can mark failed migrations applied/fallback to push | Reviewed immutable migrations, expand-contract, staging rehearsal, no false resolve | Schema drift/outage | Constraint bypass | Critical | P0 | Large | DevOps/DBA |

## Tenant and department target design

1. Every tenant-owned table has non-null `tenant_id`; every department-owned table additionally has `department_id` or an immutable ACL relation.
2. Primary/alternate keys and FKs include tenant where feasible. Cross-tenant links require a dedicated, audited platform construct.
3. RLS policies use transaction-local claims set by a narrowly privileged connection layer. Application roles cannot disable RLS.
4. Platform jobs declare an explicit tenant scope and iterate tenants; “no context” is an error, not global access.
5. Roles, workflows, policies, templates, SLA rules, reports, notifications, files and audit events are owned by tenant/department.
6. Migrations backfill, validate, then enforce NOT NULL and composite constraints with online-safe procedures.

## Performance and capacity gates

- Capture top queries with production-like cardinality; verify query plans for list/search/report/queue paths.
- Define connection budgets for each API/worker replica and managed pooler behavior.
- Add keyset pagination for high-volume chronological tables.
- Partition/archive audit, notification, activity and event tables by policy.
- Replace application-memory aggregates and N+1 patterns with governed read models.
- Run lock/contention tests for approvals, assignment, counters and workflow transitions.

## Backup/restore acceptance

Production approval requires documented and demonstrated RPO/RTO; encrypted automated database and object backups; PITR; immutable/off-site copies; monitored job failure; quarterly restore/failover drills; attachment/DB consistency reconciliation; key escrow/rotation; and a signed evidence record showing a full application boot and representative data access after restore.
