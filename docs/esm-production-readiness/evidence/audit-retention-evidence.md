# Task 20 — Audit, Retention, and Export Evidence

Date: 2026-07-23

## Scope

Task 20 hardens platform audit, retention, and export evidence for Citadel Workplace Connect.

Implemented controls:

- Append-only platform audit evidence table: `platform_audit_events`.
- Tenant/department-scoped audit events.
- Hash-chained evidence with old/new value hashes and previous event hash.
- DB trigger denying direct UPDATE/DELETE of audit events.
- Transaction wrapper for privileged mutations: mutation and audit append commit or roll back together.
- Legal-hold-aware retention decision service.
- DLP/export audit event helper.
- Legacy `auditLog()` upgraded from best-effort compatibility write to mandatory platform-chain append plus legacy row write.

## Model and cascade classification

| Model / evidence root | Owner | Data class | Retention behavior | Legal hold behavior | Delete/FK behavior |
| --- | --- | --- | --- | --- | --- |
| `PlatformAuditEvent` / `platform_audit_events` | Compliance + Data Governance | Immutable audit/evidence | Retained as append-only evidence; retention actions are recorded as audit events rather than destructive mutation | `RetentionPolicyService.evaluateRetentionAction()` returns `BLOCKED_LEGAL_HOLD` and records `RETENTION_BLOCKED_LEGAL_HOLD` evidence | Tenant and department references are `Restrict`. Actor is denormalized (`actorId`, `actorEmail`) with no User FK so user deletion/anonymization cannot mutate append-only rows. DB trigger rejects UPDATE/DELETE. |
| `AuditLog` / `audit_logs` | Platform compatibility / existing admin audit queries | Legacy query log | Compatibility copy of audit event for existing routes and tests | Protected by the platform-chain source of truth; legacy table remains query-compatible | Existing cleanup semantics preserved so legacy tests and admin workflows are not broken. |
| Privileged platform mutations using `PlatformAuditChainService.runPrivilegedAuditedMutation()` | Mutating service owner + Compliance | Business state + audit evidence | Mutation cannot commit without an audit event | Caller supplies legal-hold/retention checks before destructive action | Wrapped in one Prisma transaction. Audit append failure rolls back the privileged mutation. |
| DLP/export evidence via `RetentionPolicyService.recordDlpExportAudit()` | Compliance + Data Governance | Export evidence / DLP control | Records immutable `DLP_EXPORT` event with export id, purpose, record count, and content hash | Export evidence remains append-only regardless of later subject retention state | Stored in `platform_audit_events`; direct tampering rejected by trigger and detected by chain verification. |

## Hash-chain design

`PlatformAuditChainService.appendEvent()` computes SHA-256 over a canonical JSON payload containing:

- `tenantId`
- `departmentId`
- `actorId`
- `actorEmail`
- `action`
- `resourceType`
- `resourceId`
- `correlationId`
- `oldValueHash`
- `newValueHash`
- `metadata`
- `previousHash`
- `hashVersion`

`verifyChain()` replays ordered events for a tenant/resource scope and reports:

- total events checked
- valid / invalid
- first invalid event id
- expected hash
- actual hash

## Verification

Commands run from `backend/`:

- `npx prisma validate` — passed.
- `npx prisma generate` — passed.
- `npx prisma migrate status` — database schema up to date with 91 migrations.
- Focused/adjacent regression:
  - `npx jest src/__tests__/request.test.ts src/__tests__/announcement.test.ts src/__tests__/request-create-policy.integration.test.ts src/services/__tests__/audit-retention.integration.test.ts --runInBand --no-coverage --forceExit`
  - 4 suites / 45 tests passed.
- Task 20 + scope/credit audit regression:
  - `npx jest src/services/__tests__/audit-retention.integration.test.ts src/__tests__/execution-scope.test.ts src/__tests__/tenant-isolation-completeness.test.ts src/credit/services/__tests__/auditChain.test.ts --runInBand --no-coverage --forceExit`
  - 4 suites / 43 tests passed.
- Full backend regression:
  - `npm test -- --runInBand --forceExit`
  - 175 suites / 2013 tests passed.
- Backend build:
  - `npm run build`
  - passed.
- Backend lint:
  - `npm run lint`
  - 0 errors, 1603 warnings.

## Notes

- The platform chain is the tamper-evident source of truth. `audit_logs` remains for compatibility with existing admin audit queries.
- Actor identifiers are intentionally denormalized evidence. A User FK would allow user deletion/anonymization to trigger an UPDATE on `platform_audit_events`, violating the append-only invariant.
