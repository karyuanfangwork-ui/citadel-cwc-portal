# Task 19 RLS Parity Report

Date: 2026-07-23
Scope: governed `Request` root (`requests` table) tenant + department row-level isolation.

## Ownership validation

Live pre-enforcement check on local DB:

- Total requests: 37
- Missing `tenant_id`: 0
- Missing `department_id`: 0
- Department/tenant inconsistencies: 0

The migration also performs the same stop-the-line checks before enabling forced RLS:

- fails if any `requests.tenant_id` or `requests.department_id` remains null
- fails if a request references a missing department or a department whose tenant differs from the request tenant
- adds and validates `chk_requests_tenant_id_required`
- adds and validates `chk_requests_department_id_required`

## RLS policy

Migration: `backend/prisma/migrations/20260721000200_tenant_department_rls/migration.sql`

Policy installed on `requests`:

- `ALTER TABLE "requests" ENABLE ROW LEVEL SECURITY`
- `ALTER TABLE "requests" FORCE ROW LEVEL SECURITY`
- policy `request_scope` for all commands:
  - `tenant_id = public.app_current_tenant_id()`
  - `department_id = ANY(public.app_current_department_ids())`
  - same predicate is enforced in `WITH CHECK`

Application claims are transaction-local via `set_config(..., true)` in `backend/src/lib/database-scope.ts`.

## Application DB role

The migration creates/grants `cwc_app_rls` for local/integration verification:

- `NOLOGIN`
- `NOBYPASSRLS`
- granted `USAGE` on schema `public`
- granted `SELECT, INSERT, UPDATE, DELETE` on `requests`
- granted execute on claim helper functions

Local role state verified:

- `requests.relrowsecurity = true`
- `requests.relforcerowsecurity = true`
- table owner: `postgres`
- owner `rolbypassrls = true` in local dev, so direct RLS verification must set role to `cwc_app_rls`
- `cwc_app_rls.rolbypassrls = false`

## Parity behavior covered

Integration test: `backend/src/__tests__/rls-isolation.integration.test.ts`

Covers:

1. Tenant A / department A can read its own named request id.
2. Tenant A / department A cannot read Tenant B / department B even when SQL names Tenant B's request id directly.
3. Tenant A / department A can update its own named request id.
4. Tenant A / department A cannot update Tenant B / department B even when SQL names Tenant B's request id directly.
5. Prisma calls inside `withDatabaseScope()` are constrained by the same DB claims.
6. Claims are transaction-local and do not leak into the next pooled transaction; `cwc_app_rls` with no claims sees zero governed request rows.

## Verification evidence

Commands run:

```bash
npx prisma db execute --file prisma/migrations/20260721000200_tenant_department_rls/migration.sql --schema prisma/schema.prisma
npx jest src/__tests__/rls-isolation.integration.test.ts --runInBand --no-coverage --forceExit
npx jest src/__tests__/rls-isolation.integration.test.ts src/__tests__/execution-scope.test.ts src/__tests__/system-scope.test.ts src/__tests__/department-scope-wiring.test.ts --runInBand --no-coverage --forceExit
npx prisma migrate status
npm run build
npm run lint
npm test -- --runInBand --forceExit
git diff --check
```

Observed results:

- RLS migration SQL replay: script executed successfully.
- RLS focused test: 1 suite / 3 tests passed.
- Adjacent scope regression: 4 suites / 25 tests passed.
- Prisma migrate status: database schema is up to date with 90 migrations.
- Backend TypeScript build: passed.
- Backend lint: 0 errors, 1594 warnings.
- Full backend regression: 174 suites / 2010 tests passed.
- Diff hygiene: passed.

## Current rollout note

This Task 19 implementation enforces the first governed root, `Request`, at the database layer. Other tenant-scoped roots remain protected by existing ORM execution-scope and application policy layers until additional per-root RLS migrations are added.
