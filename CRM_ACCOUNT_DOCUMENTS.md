# CRM Client Account Documents

Deployment prerequisite: the existing production `/api/` proxy uses a 10 MB request-body limit, which includes multipart overhead. Before release, approve an account-document-specific proxy limit (at least 51 MB for five 10 MB files plus overhead) or upload one file at a time with at least 11 MB allowed. This implementation does not change proxy limits for other workflows.

CRM client account documents are private PDFs stored in the application's existing S3-compatible object storage. PostgreSQL stores metadata only; PDF bytes are not stored in the database.

## API

- `GET /api/v1/crm/accounts/:id/documents` — paginated list (`crm:read`)
- `POST /api/v1/crm/accounts/:id/documents` — multipart upload using the `documents` field (`crm:write`)
- `GET /api/v1/crm/accounts/:id/documents/:documentId/download` — authenticated attachment download (`crm:read`)
- `DELETE /api/v1/crm/accounts/:id/documents/:documentId` — soft delete and best-effort object removal (`crm:write`)

All operations enforce the existing CRM account owner/team visibility scope and match document account and tenant metadata. Storage keys, content hashes, bucket details, and credentials are never returned by the API.

## Storage and validation

The feature reuses `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, and the existing path-style setting. Objects use opaque keys in the form `crm/accounts/{accountId}/{UUID}.pdf` and must remain private.

Each file must have a `.pdf` extension, `application/pdf` MIME type, a valid PDF signature, nonzero content, and a maximum size of 10 MB. A request can contain up to five files, but there is no per-account document-count limit. SHA-256 content hashes prevent practical duplicate submissions to the same active account.

## Deployment readiness

Before a future production deployment:

1. Take and verify a PostgreSQL backup.
2. Confirm the existing S3 credentials permit private `PutObject`, `GetObject`, and `DeleteObject` operations for the `crm/accounts/` prefix.
3. Apply `20261102000000_add_crm_account_documents` during the normal migration window; it only creates a new table, indexes, and foreign keys.
4. Deploy the backend before or together with the frontend, then verify upload, list, download, and delete using an authorized test account.

Rollback can restore the previous application images without affecting existing CRM tables. Uploaded account objects and the additive metadata table should be retained during rollback for recovery; removal requires a separately approved reconciliation process.

## Known limitation

Focused automated verification totals: 21 backend tests pass (service, operation inventory, and controller audit/download contract); 10 frontend tests pass. Controller tests required localhost permission outside the sandbox; frontend tests required unrestricted temporary-file renames. Full end-to-end integration and browser visual verification have not been run.

Local verification: backend build, Prisma schema validation, focused service/route tests, focused frontend tests, and frontend production build pass. Backend lint completes with warnings and zero errors. Full frontend `tsc --noEmit` reports existing errors in `CrmOpportunities.tsx`, `DashboardWidgets.test.tsx`, and `ApplicationPartiesWorkspace.tsx`; these files are outside this change. Prisma client regeneration reports a Windows engine DLL rename lock even outside the sandbox; regenerate the client in the deployment build environment. The migration has not been applied, and a real database/S3 integration run remains a release prerequisite.

Malware scanning, quarantine, scan statuses, and scan reconciliation are not implemented for account documents in this approved scope. Existing Lead Document scanning behavior is unchanged.
