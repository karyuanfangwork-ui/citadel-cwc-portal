# Production CRM RM-Allowlist Cleanup Implementation Plan

Date: 2026-08-11
Status: Plan only — no production access or mutation performed

## Objective

Make the production CRM client screen contain only client accounts owned by these three relationship managers (RMs):

- thasha.shaharis@citadelgroup.com.my
- rohani.munir@citadelgroup.com.my
- cristel.erguiza@citadelgroup.com.my

Use the same rules proven locally:

- Resolve owners by normalized email within the explicitly selected tenant.
- Retain active leads, opportunities, accounts, and contacts associated with the three allowlisted owners.
- Soft-archive active records outside the allowlist; do not hard-delete.
- Preserve all related CRM history and relationships.
- Leave already-soft-deleted rows unchanged.
- Do not reassign ownership.
- Require reviewed expected counts and abort on any drift.
- Write one audit record per archived record.
- Produce an immutable before/apply/after report with IDs and counts.

## Important scope interpretation

The Clients screen is account-oriented and its visible population is not equivalent to contacts. The production verification must measure these separately:

1. Visible accounts: `tenantId = selected tenant AND deletedAt IS NULL`.
2. Active accounts: visible accounts with `isActive = true`.
3. Active contacts: `tenantId = selected tenant AND deletedAt IS NULL AND isActive = true`.
4. Visible unified rows: verify against the actual CRM list controller/query, not only a raw table count.

The local result was 11 retained accounts, 0 active contacts, and 0 non-allowlisted visible accounts. These are not production expectations; production counts must be discovered and approved independently.

## Non-negotiable safety gates

Do not proceed to apply unless all gates pass:

- Production environment and tenant ID are explicitly confirmed by the operator; never infer the tenant from a default.
- The three allowlisted users resolve exactly once each within that tenant after lowercasing and trimming email.
- No allowlisted email is missing, duplicated, inactive unexpectedly, or resolved to another tenant.
- A verified database backup exists and its restore test/result is recorded.
- The candidate report has been reviewed and approved by the business owner.
- The live candidate count exactly matches the approved expected count.
- The live candidate ID set and owner-email set match the approved report, not merely the count.
- The apply command includes explicit `--apply`, tenant, expected counts, and an operation/report ID.
- The transaction updates only the intended CRM parent rows and audit rows.
- Any concurrent-change mismatch aborts the transaction.
- No hard-delete SQL, `prisma.delete`, database reset, seed-clear, or demo-removal command is allowed in this operation.

## Phase 0 — Harden and verify the implementation locally

Before production deployment, update and test the cleanup tooling:

1. Make `--tenant` mandatory for all retention scripts; remove or reject local default tenant fallbacks in production mode.
2. Require explicit expected values for apply mode:
   - expected visible accounts
   - expected account archive candidates
   - expected active contacts
   - expected contact archive candidates
   - expected active leads/candidates
   - expected active opportunities/candidates
3. Normalize the three owner emails in one shared module and resolve owner IDs from the selected tenant. Fail closed if any owner is missing or ambiguous.
4. Add a stable operation/report ID to every audit `newValues` payload and snapshot filename.
5. Ensure the account script archives only rows with `deletedAt IS NULL`, and the contact script archives only rows with `deletedAt IS NULL AND isActive = true` unless a separately approved inactive-visible-contact scope is included.
6. Add a concurrent-change guard to account/contact apply, equivalent to the existing lead/opportunity `updateMany` count check. The account script must verify the row is still non-deleted before each update or use a guarded `updateMany`.
7. Use consistent audit fields: `tenantId`, `userId: null`, system actor email, resource type, resource ID, old values, new values, reason, operation ID, and archived timestamp.
8. Add tests for:
   - missing allowlisted owner
   - wrong tenant owner match
   - email case/whitespace normalization
   - count mismatch abort
   - candidate ID drift abort
   - already-deleted rows excluded
   - transaction rollback when an audit insert fails
   - only `deletedAt`/`isActive` changes on contacts/accounts
9. Run locally:
   - focused retention tests
   - `npm run build` from `backend/`
   - `git diff --check`
   - read-only dry-run against the local tenant
   - post-apply idempotency dry-run in the local test dataset

Do not deploy the current scripts unchanged to production because the account/contact scripts currently contain local default expected counts and a default tenant constant. Those must be removed or made unreachable for production execution.

## Phase 1 — Package and deploy the approved tooling

Production must run the exact reviewed code version.

1. Keep unrelated working-tree changes out of the release.
2. Commit the hardened scripts, shared owner-resolution logic, tests, and this plan only after review.
3. Run local tests and `backend` build again against the commit.
4. Push the approved commit to the agreed production branch only after explicit deployment approval.
5. Follow the CWC production deployment procedure:
   - database backup first
   - build backend and frontend separately on the low-memory server
   - do not run builds in parallel
   - verify the compiled backend container contains the new exported script/function marker
   - do not run seed-clear or CRM demo-removal scripts
   - use `RETAIN_ADMIN_CONFIG=true` for any normal seed invocation
6. No schema migration is expected for this cleanup. Still run a read-only Prisma/schema status check and do not run migrations unless the approved release actually contains schema changes.
7. Confirm backend health and recent logs before data discovery.

The scripts may need to be copied into the backend container if the production Dockerfile does not include `backend/src/scripts` at runtime. Prefer packaging them into the approved backend image and invoking the compiled/runtime-supported command. Do not copy an unreviewed local file directly into production.

## Phase 2 — Production preflight and owner resolution

Run read-only commands only.

1. Confirm:
   - production hostname/environment
   - selected tenant UUID
   - deployed git commit/image revision
   - operator and business approver
   - maintenance/change window
2. Confirm database health, disk space, container status, restart counts, and public/internal health endpoints.
3. Resolve the three owner emails within the selected tenant and record only non-secret identifiers:
   - user ID
   - normalized email
   - active status
   - tenant ID
4. Abort if any email is missing, duplicated, cross-tenant, or unexpectedly inactive.
5. Confirm the production CRM list semantics from the deployed controller/API and frontend version. The database cleanup is required for data correctness; a frontend-only filter is not a substitute.

## Phase 3 — Production backup and immutable snapshot

Before any apply:

1. Create a full production PostgreSQL backup using the approved production backup procedure. Store it in the approved protected backup location; do not place credentials or connection strings in reports.
2. Verify the backup:
   - command exit status
   - non-zero file size
   - checksum recorded separately from secrets
   - backup timestamp and database identity
   - restore validation/rehearsal or documented verified restore point
3. Create an immutable cleanup snapshot containing:
   - operation ID and timestamp
   - tenant ID
   - allowlisted emails and resolved owner IDs
   - all visible accounts with ID, name, owner, `isActive`, `deletedAt`, timestamps
   - all active contacts with ID, account ID/name, account owner, contact fields needed for review
   - all active leads and opportunities with owner, status/stage, account/contact IDs
   - all candidate IDs
   - relationship counts for contacts, leads, opportunities, activities, notes, stage history, KYC/borrower/trust/account-request references where present
   - baseline global and tenant-scoped counts
4. Store the snapshot and report outside the mutable application database as a write-once or access-controlled artifact. Redact credentials, tokens, passwords, and connection strings as `[REDACTED]`.

## Phase 4 — Read-only dry-run and business approval

Run each cleanup scope separately and save full JSON output.

### 4A. Leads

Candidate rule:

- tenant matches selected tenant
- `deletedAt IS NULL`
- owner is not one of the three resolved owner IDs

Retain allowlisted active leads. Do not alter already-deleted leads. Dry-run must list lead ID, title, owner email, status, contact/account references, and proposed `deletedAt` action.

### 4B. Opportunities

Candidate rule:

- tenant matches selected tenant
- `deletedAt IS NULL`
- owner is not one of the three resolved owner IDs

Retain allowlisted active opportunities. Dry-run must list opportunity ID, name, owner email, stage, value, and related account/contact references.

### 4C. Contacts

Candidate rule:

- tenant matches selected tenant
- `deletedAt IS NULL`
- `isActive = true`
- the owning account's owner is not one of the three allowlisted owners

This is account-owner-based retention because that is how the current client relationship is represented. Do not infer contact ownership from free-text fields. Dry-run must list contact ID, name/email, account ID/name, account owner, and downstream counts.

### 4D. Accounts / Clients screen

Candidate rule:

- tenant matches selected tenant
- `deletedAt IS NULL`
- account owner is not one of the three allowlisted owners

Include any inactive-but-visible account because the current client list filters on `deletedAt IS NULL` and can display `isActive = false` rows. Dry-run must list account ID, name, owner ID/email, `isActive`, and all relationship counts.

### Approval package

The approval package must contain:

- exact candidate counts for each scope
- exact candidate IDs and owner emails
- retained counts by allowlisted RM
- already-deleted counts left unchanged
- downstream impact totals
- duplicate/demo records excluded from this operation
- records requiring manual review and excluded from automatic cleanup
- proposed execution order
- rollback method

Approval must reference the report hash/operation ID and exact expected counts. A count-only approval is insufficient.

## Phase 5 — Apply order

After approval and a final same-window dry-run:

1. Pause or avoid CRM writes during the short operation window if practical. At minimum, announce that candidate counts are guarded and any concurrent drift will abort.
2. Apply lead retention in one tenant-scoped transaction.
3. Apply opportunity retention in one tenant-scoped transaction.
4. Apply contact retention in one tenant-scoped transaction.
5. Apply account retention in one tenant-scoped transaction.
6. For every scope:
   - re-resolve allowlisted owner IDs
   - re-query candidates
   - compare exact count and exact candidate ID set to the approved report
   - abort on any mismatch
   - update only soft-delete fields (`deletedAt`; contacts also `isActive=false`)
   - insert one audit row per archived record in the same transaction
   - fail and roll back if any update/audit count is unexpected
7. Do not reparent or delete child records. Do not archive allowlisted records. Do not mutate account ownership.
8. Save the apply output and transaction timestamps alongside the immutable snapshot.

Recommended execution command shape (illustrative; use the deployed script's final CLI exactly):

```text
retain-crm-leads --tenant <PRODUCTION_TENANT_ID> --apply --expected-candidates <APPROVED_LEAD_COUNT>
retain-crm-opportunities --tenant <PRODUCTION_TENANT_ID> --apply --expected-candidates <APPROVED_OPPORTUNITY_COUNT>
retain-contacts-by-rm --tenant <PRODUCTION_TENANT_ID> --apply --expected-active <APPROVED_ACTIVE_CONTACT_COUNT> --expected-candidates <APPROVED_CONTACT_COUNT>
retain-accounts-by-rm --tenant <PRODUCTION_TENANT_ID> --apply --expected-visible <APPROVED_VISIBLE_ACCOUNT_COUNT> --expected-candidates <APPROVED_ACCOUNT_COUNT>
```

Never copy the local tenant UUID or local expected counts into production without replacing them with the approved production values.

## Phase 6 — Post-apply verification

Run immediately after apply and again after the normal application refresh/cache interval.

### Database verification

- zero active lead candidates outside the allowlist
- zero active opportunity candidates outside the allowlist
- zero active contacts whose owning account is outside the allowlist
- zero visible accounts outside the allowlist (`deletedAt IS NULL`)
- every visible account owner email belongs to the three allowlisted emails
- allowlisted records remain visible and unchanged
- previously deleted records remain deleted and unchanged
- archived row counts equal approved counts
- audit row counts equal archived row counts, with correct operation ID
- no account/contact/lead/opportunity foreign-key or relationship count loss
- activities, notes, opportunity stage history, KYC, borrower profiles, trust products, and account-request links unchanged unless explicitly included in the approved scope
- second dry-run returns zero candidates for each completed scope

### API/UI verification

1. Check the CRM client API response using an authenticated production account with the same permissions as the user.
2. Open the Clients screen and hard-refresh it.
3. Verify the Team Clients/default list shows only retained accounts and only the three allowlisted owner names. The exact visible owner names may be only Rohani and Cristel if Thasha has zero assigned accounts; that is correct and must be reported rather than inventing a Thasha client.
4. Verify Active tab count, Team Clients count, search, pagination, export, and refresh behavior.
5. Verify a retained client can still open and its related opportunities/activities/notes remain visible.
6. Verify an archived non-allowlisted account/contact is not shown in the default list but remains recoverable through approved historical/admin views.

### Operational verification

- internal backend health: HTTP 200
- external HTTPS health: expected success
- container status/restart count normal
- recent backend/nginx/postgres logs have no continuing Prisma, FK, 5xx, or transaction errors
- classify any pre-apply log noise separately from errors continuing after the final apply/restart

## Rollback procedure

Primary rollback is a targeted transactional restore, not a hard delete:

1. Stop immediately if any verification gate fails.
2. Do not run a second cleanup with guessed counts.
3. Use the immutable apply report to identify only records archived by this operation ID.
4. In a tenant-scoped transaction, restore only those rows:
   - accounts: set `deletedAt = NULL`; restore original `isActive` from snapshot
   - contacts: set `deletedAt = NULL`; restore original `isActive` from snapshot
   - leads/opportunities: set `deletedAt = NULL` only for rows archived by this operation
5. Write compensating audit records for every restoration.
6. Re-run all post-apply checks and verify the restored ID set exactly matches the operation report.
7. If targeted rollback cannot safely restore state, take the application offline and restore the verified database backup using the production restore runbook. Record the reason and exact backup identifier.
8. Recheck application health, schema state, logs, and the client screen after rollback.

No permanent purge is part of this plan. Hard deletion requires a separate retention policy, approval, dependency analysis, backup, and rollback review.

## Separate follow-up work

Do not combine these with the RM allowlist cleanup without a new review:

- duplicate/demo account merging
- sparse or suspicious manual records
- reassignment of accounts to Thasha
- hard deletion/purge
- deleting leads/opportunities merely because their parent account is archived
- UI redesign or changing client ownership semantics

## Completion evidence required

The production change is complete only when the handoff contains:

- deployed commit/image revision
- confirmed production tenant ID (non-secret)
- approved report hash/operation ID
- backup identifier and verification result
- before, apply, and after report paths
- exact counts archived and retained by scope
- audit verification result
- relationship-preservation result
- second-run idempotency result
- API/UI verification result
- rollback status and any exceptions

No production execution, commit, push, SSH command, Docker build, or database mutation is authorized by this plan alone.
