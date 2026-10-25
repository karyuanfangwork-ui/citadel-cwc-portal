# CWC audit-health release candidate — preparation only

Status at preparation: scoped commit/push authorized; NOT DEPLOYED. This is a scoped handoff, not a production-change authorization. The reviewer chose diagnostic-only legacy verification; the twelve existing `AUDIT_CHAIN_BROKEN` warnings and strict pre-disbursement gate must remain open. No production database reset, migration, seed, reseal, rehash, cleanup, or configuration edit is in scope.

## Proposed release scope

Backend runtime changes:
- `backend/src/credit/services/auditChain.service.ts` — version-3 deterministic metadata hashing; strict verifier includes sequence-gap detection; optional exact legacy diagnostic only. The booking refusal now uses `AppError` so the HTTP middleware returns 409 rather than masking it as a 500, without exposing audit event IDs in the response.
- `backend/src/credit/services/legacyAuditMetadata.ts` — reviewed source-order v2 shapes, diagnostic only.
- `backend/src/credit/jobs/auditRetention.job.ts` and `backend/src/middleware/metrics.ts` — strict aggregate integrity metrics, alert attempt and delivery status, no ID-bearing mail.
- `backend/src/middleware/error.middleware.ts`, `backend/src/middleware/crm-upload.middleware.ts`, `backend/src/routes/crm.routes.ts` — 413 mapping and unchanged CRM file limits. Reverse-proxy `10m` remains unchanged.
- `docker-compose.prod.yml` — optional `AUDIT_ALERT_EMAIL` pass-through with empty default. A production recipient value is NOT provided here and would require a separately approved runtime configuration action.

Tests and diagnostics to include in a scoped commit if explicitly authorized: credit audit service/job tests, credit reconstruction fixture correction, disbursement gate test, upload-limits test, the two request-log classifier files, and `scripts/audit-alerting.md`, `scripts/disk-capacity.py`, `scripts/disk-capacity.md`, `scripts/check-static-assets.py`, `scripts/check-tls-expiry.py`, `scripts/classify_static_404.py` with their synthetic tests. The production-health remediation plan is the evidence record. No Prisma schema or migration file, frontend source file, proxy configuration, or secret file changed for this candidate.

Explicit exclusions: `.gitignore` (unrelated working-tree edit), `docs/superpowers/plans/2026-10-11-email-template-editor-remediation.md` (unrelated untracked plan), `backups/` (restricted production dump), scratch forensics, local build output, and any unlisted user files. Do not stage with `git add .`; enumerate paths after reviewing the final diff. No commit or push has been made.

## Verification already exercised locally

- Focused backend: 6 suites, 52 tests passed; TypeScript build and ESLint passed.
- Python synthetic diagnostics: 15 script tests plus 3 backend-classifier tests passed.
- Separate local PostgreSQL JSONB round-trip test passed; temporary database removed.
- Restricted snapshot analysis: 12 application groups, 13 retained events; exact legacy source-order diagnostic matched all 13, strict verifier matched none. Temporary restore removed; original backup remains mode 0600 and Git-ignored. This does not certify historical completeness.
- Existing production provider accepted one authorized transport-test email; the admin confirmed mailbox receipt. The new alert job itself is not deployed or end-to-end tested.

These results do not substitute for full CI against an isolated database, the running image, alert receipt after deployment, or an authenticated credit journey. The shared local development database must not be used for broad fixture tests.

## Release gates before any production apply

1. Obtain an explicit authorization for the exact scoped commit/push and a separate explicit production deployment/configuration approval. Reviewer acceptance remains diagnostic-only unless changed in a recorded decision.
2. Run full CI on an isolated test database for the exact commit and confirm both image-publishing jobs succeeded for that SHA. Pin backend and frontend image digests. Use prebuilt images; the low-memory production host must not compile both images.
3. Perform a read-only server preflight: checkout/untracked preservation, container dependencies, 6.3 GiB baseline disk headroom versus current measurement, restart/OOM state, and previous image IDs. Stop on insufficient pull headroom or an unhealthy dependency.
4. Take a fresh restricted database backup and verify non-empty archive, checksum and readback before replacing an application container. No schema diff exists, so skip migrations and seeds; check schema status read-only after restart.
5. Do not run `deploy-prebuilt.sh` unchanged: it does not verify backup checksum/restore, pulls both images without separate digest gates, fast-forwards the production checkout without a full untracked-conflict preflight, and uses `curl -k`. Use a reviewed, fail-closed manual/checkpoint procedure instead.
6. If the recipient is approved for production use, set `AUDIT_ALERT_EMAIL` through the secure production configuration mechanism without printing secrets, and verify `EMAIL_DEV_RECIPIENT` is absent. A change to Compose environment may recreate backend; treat it as a deployment action, not an incidental edit.
7. Verify exact backend image ID and compiled markers, no migration or data write, internal/public HTTPS 200, scheduler check result, continued twelve broken-chain signals, strict 409 booking refusal on affected chains, and one approved aggregate alert with mailbox receipt/acknowledgement. Also verify missed-job detection independently of the backend itself. Do not close signals because an email was delivered.
8. Retain previous image references, backup handle and health/restart evidence for rollback. Stop and report any failed gate; do not rerun a partial wrapper blindly or use `audit:reseal`, `audit:rehash`, `prisma migrate reset`, `db push`, seed, or Docker volume prune as a recovery shortcut.

Current authorization: the admin approved step 1 (scoped commit and push to `origin/dev2.0`) only. Production deployment, runtime configuration and database actions remain unapproved. Record the resulting commit SHA and CI evidence separately after the push; do not equate branch delivery with a release.
