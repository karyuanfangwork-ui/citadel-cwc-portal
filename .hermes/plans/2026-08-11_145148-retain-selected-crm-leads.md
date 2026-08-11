# Retain Selected CRM Leads — Implementation Plan

> Status: Plan only. No database records were modified during discovery.

## Goal

Retain all CRM lead records owned by these three users and archive the remaining active lead records, without changing contacts, accounts, opportunities, or any non-lead CRM data:

- rohani.munir@citadelgroup.com.my
- thasha.shaharis@citadelgroup.com.my
- cristel.erguiza@citadelgroup.com.my

## Discovery Results

Read-only local database inspection on 2026-08-11 found:

- 49 total rows in `crm_leads`.
- 46 active rows (`deletedAt IS NULL`), which are the rows shown by the current lead list API.
- 3 already soft-deleted rows.
- The three requested email addresses exist as CRM users and are lead owners, not lead contact emails.
- Requested owners currently own 27 rows in total:
  - Rohani: 13 total; 11 active and 2 already soft-deleted.
  - Thasha: 12 active.
  - Cristel: 2 active.
- Candidate set for archival: 21 active leads owned by users outside the requested three-owner allowlist.
- Active lead status distribution: 27 NEW, 3 CONTACTED, 3 QUALIFIED, 11 CONVERTED, 1 UNQUALIFIED, and 1 LOST.

The two already-soft-deleted Rohani records will remain untouched and will not be restored or permanently removed.

## Interpretation / Safety Decision

The requested emails are interpreted as the allowed `CrmLead.owner.email` values because the supplied screenshot shows the Owner column and these are internal Citadel addresses. They do not match `CrmLead.contactEmail` in the local data.

The existing application delete path is a soft delete: `DELETE /crm/leads/:id` sets `deletedAt` and writes an audit log. The implementation should use the same retention model rather than hard-deleting rows. This preserves lead history, activities, notes, and any converted-lead traceability.

No contacts, accounts, opportunities, users, or lead-owned records outside `crm_leads` are in scope.

## Existing Code Anchors

- Data model: `backend/prisma/schema.prisma:2626-2684` (`CrmLead`, `deletedAt`, `ownerId`, lead relations).
- List behavior: `backend/src/controllers/crm.controller.ts:481-527`; only `deletedAt: null` records are returned.
- Current single-record delete behavior: `backend/src/controllers/crm.controller.ts:682-692`; soft delete plus `AuditLog` and SSE broadcast.
- Lead routes and permissions: `backend/src/routes/crm.routes.ts:58-65`; list requires `crm:read`, delete requires `crm:delete`.
- Frontend API methods: `frontend/src/services/crm.service.ts:458-479`.
- Lead page and bulk-selection UI: `frontend/pages/CrmLeads.tsx`; `frontend/src/components/crm/LeadsTable.tsx`.

## Proposed Implementation

### Phase 1 — Add a protected, auditable lead-retention operation

Create a backend-only maintenance script or admin service, preferably:

- Create: `backend/src/scripts/retain-crm-leads.ts`
- Test: `backend/src/__tests__/retain-crm-leads.test.ts`

The script must:

1. Load the allowlist as normalized lowercase emails.
2. Resolve the emails to user IDs and fail closed if any requested user is missing.
3. Restrict all queries to the intended tenant or explicitly require a tenant identifier. Do not use unscoped access in the final implementation; current direct discovery queries emitted tenant-scope warnings.
4. Build the candidate set as active `CrmLead` rows whose `ownerId` is not in the resolved allowlist.
5. Exclude already-soft-deleted rows automatically.
6. Produce a dry-run report before any write, including total rows, active rows, already-deleted rows, retained rows by owner, candidate count, status distribution, and IDs/titles/contact emails for candidates. Avoid logging unnecessary sensitive contact data in normal output.
7. Require an explicit `--apply` flag for writes. Without it, the script must be read-only.
8. In a transaction, set `deletedAt` for the exact candidate IDs, create one audit record per lead (or a clearly linked batch audit record if the existing audit model supports it), and verify the affected count.
9. Never hard-delete `CrmLead` rows and never update owner IDs as a substitute for archival.
10. Be idempotent: rerunning `--apply` after completion must produce zero new candidates and no duplicate mutation.

### Phase 2 — Add regression coverage

Add tests covering:

- All three allowlisted users are resolved case-insensitively and with trimmed input.
- Missing allowlist user causes a fail-closed error and no writes.
- Active leads owned by allowlisted users are retained.
- Active leads owned by other users become soft-deleted.
- Existing soft-deleted rows are unchanged.
- Converted, lost, and open leads are all handled according to owner, not status; no status-based accidental deletion.
- Related activities/notes/opportunity conversion references are preserved.
- Dry-run performs no update or audit writes.
- Apply is idempotent.
- Tenant scope is present in every read/write query.

If the operation is exposed through HTTP instead of a one-off script, add an admin-only endpoint with `crm:admin` (not merely `crm:delete`) and an explicit confirmation token or request body containing the allowlist and expected candidate count. The endpoint must return a dry-run preview before apply.

### Phase 3 — Operational execution

1. Confirm the intended tenant/environment. The screenshot says local environment, so local execution should be verified first; production must not be inferred from local data.
2. Export a CSV/JSON snapshot of all 49 lead rows with IDs, owner email, status, `deletedAt`, timestamps, relation IDs, and conversion fields. Store it outside the repository and do not commit it.
3. Run the new command in dry-run mode and compare its candidate count with the expected 21 active non-allowlisted rows.
4. Review any exception candidates, especially converted leads and leads with activities/notes.
5. Obtain explicit approval for the destructive-looking operation even though it is reversible soft deletion.
6. Run `--apply` once in a transaction.
7. Re-run dry-run and verify:
   - 46 active rows become 25 active rows.
   - The 25 active retained rows are owned only by the three allowlisted emails.
   - The 21 candidates now have non-null `deletedAt`.
   - The original 3 soft-deleted rows remain unchanged.
   - Audit records exist for all 21 mutations.
   - No contacts, accounts, opportunities, activities, notes, or users changed.
8. Refresh `/crm/leads` and confirm the UI shows only the retained active leads. Use the CRM lead list API as the authoritative UI-facing check, not only a database count.

## Files Likely to Change

- Create: `backend/src/scripts/retain-crm-leads.ts`
- Create: `backend/src/__tests__/retain-crm-leads.test.ts`
- Modify only if needed for shared command registration: `backend/package.json`
- Modify only if an admin UI preview is requested: `backend/src/routes/crm.routes.ts`, `backend/src/controllers/crm.controller.ts`, `frontend/src/services/crm.service.ts`, and `frontend/pages/CrmLeads.tsx`

No Prisma schema migration is expected because `CrmLead.deletedAt` and the existing soft-delete behavior already exist.

## Verification Commands

From `backend/`:

- `npm test -- --runInBand src/__tests__/retain-crm-leads.test.ts`
- `npm run build`
- `npx tsx src/scripts/retain-crm-leads.ts --tenant <tenant-id> --dry-run`
- `npx tsx src/scripts/retain-crm-leads.ts --tenant <tenant-id> --apply --expected-candidates 21`
- Re-run the dry-run command after apply.

Also run `git diff --check` and verify the working tree before and after execution. Do not commit, push, or run against production without separate approval.

## Risks and Controls

- Wrong interpretation of the three emails: require confirmation that they identify owners, not contact persons; discovery supports the owner interpretation.
- Wrong tenant/environment: require explicit tenant and environment checks; fail closed if ambiguous.
- Accidental hard deletion: use only `deletedAt` updates and transaction rollback on failure.
- Loss of auditability: write audit records and retain the pre-operation snapshot.
- Partial execution: transaction plus post-apply count and ID-set verification.
- Converted lead impact: preserve converted rows physically; archive only according to owner allowlist and verify opportunity references remain intact.
- Sensitive data exposure: keep snapshots and dry-run output access-controlled, minimize contact-field logging, and never commit exports.

## Open Confirmation Required Before Implementation

1. Confirm the three emails are the lead-owner allowlist.
2. Confirm the desired action for the 21 non-allowlisted active leads is reversible soft deletion/archival, not permanent deletion and not reassignment.
3. Confirm this applies only to the local environment first, or provide the explicitly approved target tenant/environment.
4. Confirm whether the two already-soft-deleted Rohani-owned leads should remain deleted (recommended: leave unchanged).
