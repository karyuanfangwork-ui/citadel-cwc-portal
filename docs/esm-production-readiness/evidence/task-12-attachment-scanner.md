# Task 12 — Governed attachment scanner evidence

Date: 2026-07-22
Scope: local integration environment only; this is not production deployment evidence.

## Implemented boundary

- Upload registration derives tenant, department and parent ownership from the request and persists `PENDING_SCAN` with immutable object identity, SHA-256 content hash, unique scan job ID and one-time callback binding.
- BullMQ dispatch and worker execute under explicit tenant-aware system scope.
- A periodic idempotent reconciler redelivers persisted `PENDING_SCAN` registrations after database/Redis crash windows and retries `PENDING_DELETION` object cleanup.
- ClamAV integration uses the daemon `INSTREAM` protocol; only the exact `stream: OK` response is clean, while malformed responses, oversized responses and scanner errors fail closed.
- Bound callbacks validate attachment ID, scan job ID, content hash, nonce, expiry and timestamp, with compare-and-set replay defense.
- Internal BullMQ results use a separate immutable job/content binding, so queue delay does not inherit the external callback credential's 15-minute expiry.
- Downloads require `CLEAN`, unexpired active retention and parent-request policy authorization.
- `INFECTED` objects use a retry-safe two-phase quarantine transition: deterministic copy, persisted quarantine evidence, source deletion and persisted deletion evidence. Exhausted quarantine retries are durably marked `QUARANTINE_FAILED` and retained as failed BullMQ jobs.
- Migrations `20260722102000_attachment_scanner_contract` and `20260722113000_attachment_request_scope_quarantine_recovery` enforce non-null ownership, composite request/tenant/department integrity and valid pending/completed quarantine evidence.
- Local and production Compose definitions use ClamAV 1.4.3 pinned to digest `sha256:75fb5fd95fcbe1d7e6d240c369c1572b686ee2c95949d1042b5148de8eddebb4`.

## Verification evidence

- Local ClamAV container: running and healthy.
- Live provider smoke through `clamAv.service.ts`:
  - clean payload → `CLEAN`
  - EICAR payload → `INFECTED`, signature `Eicar-Test-Signature`
- End-to-end local EICAR lifecycle via `npm run smoke:attachment-scanner`:
  - result `INFECTED`
  - quarantine evidence persisted
  - original object deleted
  - infected download denied with not-found concealment
  - smoke records and objects cleaned afterward
- Focused attachment, callback, worker, reconciliation, queue, ClamAV and operation-control suites: 8 suites, 52 tests passed.
- Full backend regression: 168 suites, 1,967 tests passed.
- Backend TypeScript build: passed.
- Prisma schema validation: passed.
- Local database: all 83 migrations applied; schema up to date.
- Focused ESLint: 0 errors, 6 pre-existing-style `no-explicit-any` warnings.
- Local and production Docker Compose configuration validation: passed.
- `git diff --check`: passed.

## Remaining release gate

Production remains undeployed. Production acceptance must independently verify ClamAV health, Redis worker consumption, object-store quarantine permissions, EICAR handling, monitoring/alerts and rollback behavior before the Task 12 checkbox is closed for release governance.
