# CWC production health remediation plan

Status: LOCAL IMPLEMENTATION IN PROGRESS — no production remediation authorized or applied. Prepared 2026-10-24 UTC from read-only production checks and repository inspection. Scope: credit audit integrity, host capacity, upload rejection, static-file errors, and certificate renewal. Owners and approvals must be assigned before applying production changes.

## Baseline and evidence limits

- At 2026-10-24 11:50 UTC, public site, public `/health`, and internal backend `/health` returned HTTP 200. Seven Compose containers were running with zero recorded restarts; PostgreSQL, Redis, and ClamAV reported healthy. A read-only database query returned `1`. No authenticated business journey was exercised.
- Root disk: 42 GB used of 48 GB (87%), 6.3 GB available. Memory available: approximately 761 MiB; swap in use: 1.2 GiB. These are point-in-time observations, not a trend.
- The backend daily job reported 12 broken application hash chains on each of 2026-10-18 through 2026-10-24 at 03:00 UTC. Read-only SQL on 2026-10-24 found 13 `credit_audit_events` across 12 applications, 12 open `AUDIT_CHAIN_BROKEN` signals, no duplicate `(application_id, sequence)` positions, and all 13 events at hash version 2 (12 at sequence 1, one at sequence 2). This does not identify the cause; at least 11 of the affected applications have only one event, so a multi-event ordering collision alone cannot explain all 12 failures. Do not infer tampering or a safe reseal from the alert.
- In the preceding 24 hours Nginx logged four oversized-body rejections. The initial sanitized route classification found none matching the CRM import route or another `/api/` path; that classification needs validation against precise sanitized request evidence before attributing them to a feature.
- Frontend Nginx logged 76 missing-file requests in that window, one under `/assets/`. Their user impact is unverified.
- Public TLS certificate expires 2026-12-02 05:34:47 UTC. Expiry monitoring and renewal need verification, but replacement is not presently urgent.
- Local source and production checkout both reported commit `f781ffb6`. Production checkout has unrelated untracked scripts; do not clean or overwrite them. Local working tree has unrelated `.gitignore` edits and another plan; preserve them.

## Governing principles and decision gates

1. Evidence preservation precedes any audit data mutation. An integrity alert is an incident until its root cause and evidentiary impact are reviewed by credit/data and compliance/security owners.
2. Production preflight is read-only. Any production write needs a verified restore-capable backup, immutable before-snapshot, reviewed dry-run, exact candidate set, explicit approval, bounded apply, and independent readback. Stop on drift or ambiguous records.
3. Never run `npm run audit:rehash` on production: `backend/prisma/rehash-audit-chain.ts:66-122` deletes audit events and synthesizes replacements. `npm run audit:reseal` rewrites stored hashes; its availability is not approval or proof that resealing is safe.
4. Do not broaden Nginx limits, prune Docker volumes, delete backups, close warning signals, or change production configuration merely to make a health indicator green.
5. Keep actual production evidence separate from source-level and test evidence. No authenticated credit, upload, or browser journey was performed in the baseline check.

## Work register and dependencies

| ID | Priority | Work and accountable role | Depends on | Exit evidence |
| --- | --- | --- | --- | --- |
| A1 | P0 | Preserve backup, audit rows, migration/deploy evidence — DBA + compliance | None | Verified backup/snapshot counts and checksum, restricted evidence handle |
| A2 | P0 | Classify first break and cause in each of 12 chains — credit engineering + reviewer | A1 | Reviewed per-application classification and reconciliation |
| A3 | P0 | Approve cause-specific data repair or incident exception — data/compliance owner | A2 | Signed decision; no unexplained changes |
| A4 | P0 | If approved, bounded repair and readback — DBA + independent reviewer | A3 | Full chain verification and before/after invariants |
| A5 | P1 | Alert, integrity metric, tests and ownership — backend + operations | A2 | Induced break pages owner; tests and fail-closed gate pass |
| D1 | P1 | Disk-growth inventory and alerting — operations | None | Root-cause inventory and verified threshold notification |
| D2 | P1 | Approved recoverable cleanup if required — operations | D1, backup verification | Free-space and rollback evidence |
| U1 | P1 | Classify oversized requests; reconcile only legitimate feature contract — backend + frontend + operations | None | Route/status evidence and boundary tests |
| F1 | P2 | Classify missing files, verify user-facing asset load — frontend + operations | None | No reproducible broken asset and classified residual probes |
| C1 | P2 | Verify certificate renewal path and alerting — operations | None | Renewal evidence and expiry alert test |
| V1 | P0 release gate | Recheck health, logs, DB and exact affected journeys after any apply — independent operator | Applied item | Timestamped release evidence and rollback decision |

### Phase 0 — A1: forensic preservation and read-only inventory

- Take a database backup before touching production; verify non-empty output, checksum, storage location, and a restore rehearsal against an isolated environment. Preserve the original 13 audit rows with IDs, timestamps, hash/hash version, sequence, actor, action, state, and metadata in restricted storage; publish only aggregate/redacted findings.
- Record deployed revision, migration ledger status, any historical reseal attempts, and creation/edit provenance. Compare the 12 open `early_warning_signals` to affected application IDs without exposing IDs in the general report.
- Run verifier on an isolated restored copy with the deployed implementation. Never run an unreviewed production CLI that might create warning signals or rewrite data. `backend/src/credit/jobs/auditRetention.job.ts:41-129` both checks and creates signals; it is not purely read-only.
- Stop gate: backup/restore or candidate identity cannot be verified. Do not proceed to repair.

### Phase 1 — A2/A3: establish cause and select a repair branch

- For each application, record first failing event and sequence, stored and recomputed hashes, expected predecessor, source hash formula, schema/migration history, and whether any event is missing. Compare all 13 rows against original snapshot and business event history. `verifyChain` is in `backend/src/credit/services/auditChain.service.ts:182-213`; versioned `computeHash` is at `:35-73`.
- Diagnose one-event chains independently of sequence ordering. The historical ordering migration (`backend/prisma/migrations_archive/20260810120000_credit_audit_sequence/migration.sql`) documents an older multi-event defect; it is not proof of the current production cause.
- Branch 1: deterministic historical hash/serialization defect proven from source and independent original evidence. Build exact-row dry-run, prove unchanged event identity/actor/metadata/timestamps on isolated copy, and obtain written approval before any bounded hash-only apply. Assess legal acceptability of resealing and preserve original hashes.
- Branch 2: missing/unauthorized alteration or unresolved cause. Preserve incident state; do not recompute hashes to hide the gap. Let compliance/security decide reconstruction, disclosure, exception, and affected-workflow containment.
- `backend/prisma/reseal-audit-chain.ts:44-89` offers a dry-run and an in-place rewrite; neither is a substitute for classification and approval. `backend/src/credit/services/disbursement.service.ts:124` already calls the integrity assertion before booking; verify this gate in tests and in the reviewed production path without initiating a real disbursement.

### Phase 2 — A4/A5: controlled correction and preventive controls

- If an approved correction exists, fresh backup and compare-and-swap candidate set immediately before apply; stop on row drift. Restrict writes to reviewed columns and IDs, preserve originals externally, run transactionally where possible, verify all application chains after apply, and compare row counts plus all non-approved fields before/after. Use compensating restore from the snapshot if an invariant fails; do not attempt broad rehash.
- Confirm the next scheduled 03:00 UTC check reports intact chains and only then close verified signals with an accountable resolver. Confirm no new signal is created on the following run. The current job deduplicates open critical signals at `auditRetention.job.ts:103-126`.
- Improve `RetentionReport.totalBrokenEvents`: it currently sums every event in a broken application (`auditRetention.job.ts:77-81`), not only failed events. Name and test the intended metric, keep per-application first failure and safe aggregate monitoring, and wire critical alert delivery/acknowledgement rather than relying only on a log at 03:00.
- Add unit/integration tests for one-event version-2 mismatches, version-1 legacy events, timestamp ties, missing and altered events, signal deduplication, failed job alerting, and pre-disbursement refusal. Existing targets: `backend/src/credit/__tests__/auditChainOrdering.test.ts`, `auditChainEscalation.test.ts`, `backend/src/credit/services/__tests__/auditChain.test.ts`. Run against a separate test database, not production or the restored dev database. Verify backend build and affected/full tests before release.
- Exit: reviewed original/after evidence, zero unexplained broken chains, zero duplicate warnings, tested alert, and fail-closed booking gate.

### Phase 3 — D1/D2: disk capacity

- Read-only inventory: `df` and inode usage, Docker images/build cache/container JSON logs, DB and upload volumes, backup sizes/ages, and growth trend. Identify what accounts for 42 GB used. Record an explicit free-space response threshold with owner and escalation.
- Draft and review an allowlist of disposable artifacts; verify rollback/restore first. Never delete PostgreSQL data or Docker volumes, active images, unverified backups, or unrelated server files. Execute cleanup separately under approval if needed and compare before/after disk, service health, and Docker state.
- Add disk, inode, available-memory, and swap alert tests. Do not conflate one-time swap usage with current OOM (all observed containers reported `oom=false`).

### Phase 4 — U1: request-body and upload limits

- Correlate the four rejections with sanitized method, route category, response code, timestamp, and authorized user journey; check if they were scanner traffic or legitimate uploads. Current proxy `client_max_body_size 10m` is at `nginx/conf.d/default.conf:77-93`. Shared upload Multer sets 10 MiB per file at `backend/src/middleware/upload.middleware.ts:105-112`, while CRM import allows 50 MiB at `backend/src/routes/crm.routes.ts:139-156`.
- If a legitimate CRM import is blocked, choose and document the supported maximum, multipart overhead, memory risk on a 2 GB host, route-specific proxy setting (not a global increase), frontend precheck/copy, and consistent API error mapping. If all four are probes, retain the defensive limit and improve classification only.
- Tests: accepted file just below bound, boundary/multipart overhead, oversized 413, non-import limit unchanged, and an authorized browser/API journey in staging. Never upload customer data for smoke tests.

### Phase 5 — F1/C1: static files and TLS

- Classify the 76 missing-file requests by sanitized extension/path class, status, referrer category, and user agent; identify whether `/assets/` references a stale Vite hash. Verify deployed asset presence, `index.html` freshness, and clean-browser load. `frontend/nginx.conf:12-21` defines SPA fallback and immutable static caching; change it only for reproduced defects, with a cache/asset regression test.
- Check certificate-renewal job and Nginx serving certificate. `docker-compose.prod.yml:168-173` schedules Certbot renewal; prove renewal outcome and configure an alert before expiry. Do not claim renewal success from current certificate validity alone.

## Verification and release/rollback gate

- Before code deploy: targeted audit and upload tests, backend TypeScript build, frontend build for changed UI, and Nginx config validation for any proxy change. Use the normal backend Jest command; keep integration tests isolated from the development/production DB.
- Before production apply: owner approval, backup with checksum and restore test, exact reviewed candidate IDs/counts, production checkout and dependency health, rollback path, and preservation of unrelated working-tree files.
- After each apply: container status/restarts/OOM; internal and public `/health`; read-only DB check; relevant authenticated feature smoke through approved credentials; audit-chain verification; warning signal counts; recent API/Nginx/frontend logs; disk headroom; and TLS expiry. Classify old errors separately from post-change errors.
- Stop/rollback on candidate drift, failed backup, newly broken chains, changed event provenance, failed protected workflow, 5xx, unhealthy dependency, or disk/certificate regression. Data rollback requires a targeted reviewed procedure; indiscriminate full restore can overwrite legitimate intervening writes.

## Open decisions

- Who is the incident owner and independent compliance reviewer for the 12 affected applications?
- Is credit/disbursement actively used in this production tenant, and should affected applications be operationally held beyond the existing pre-disbursement gate during investigation?
- What is the authorized, evidence-preserving correction for each failure class? No default reseal is approved.
- What upload maximum is supported for CRM import versus ordinary attachments, given host memory and proxy overhead?
- What disk alert thresholds, retention policy, and on-call delivery channel are operationally owned?

## Definition of done

A1–A4 require exact-chain forensic classification and reviewed closure or a formally documented unresolved incident; A5 requires alert and regression proof. D1/D2 require measured headroom and verified alerting. U1/F1 require demonstrated legitimate journeys or documented benign probe classification. C1 requires renewal monitoring evidence. V1 requires a fresh, independently reviewed production check. A green `/health` alone closes none of these tasks.

## Local implementation checkpoint (2026-10-24; not production evidence)

- A5 partial: `auditRetention.job.ts` now reports first failing events rather than counting all events in affected chains, exports aggregate chain/check-success metrics, reports failed checks, and no longer directs operators to reseal. `verifyChain` checks contiguous sequence positions; unit tests cover gaps, v1/v2, signal deduplication and pre-disbursement refusal. Operator-owned paging, acknowledgement and isolated restored-DB verification remain open. A missing entire chain still cannot be detected from audit rows alone; reconcile against independent application/business history in A2.
- D1 partial: `scripts/disk-capacity.py` provides a read-only host probe and synthetic threshold tests. The later forensic checkpoint records a point-in-time production inventory; approved thresholds, trend and tested alert delivery remain open. D2 is not started.
- U1 partial: `backend/scripts/classify_oversized_requests.py` outputs sanitized 413 classifications. Backend upload 413 mapping and direct-backend boundary tests were added without increasing the proxy limit. The later checkpoint classifies the four observed rejections; supported CRM maximum, proxy/browser journey and owner decision remain open.
- F1/C1 partial: local build-asset and served-TLS expiry probes with synthetic tests exist. The later checkpoint covers current logs and a public unauthenticated asset load; authenticated journey, actual renewal outcome and live expiry notification test remain open.
- A1/A2 have the limited forensic evidence below; A3/A4 and V1 remain gated as above. No production audit data, cleanup, proxy config or certificate changes were made.

## Authorized forensic checkpoint (2026-10-24 UTC; no production repair)

- The admin authorized only backup, isolated restore, and read-only investigation. A restricted custom-format production backup was streamed to local `backups/prod_forensic_20261024T120847Z.dump` (2,642,093 bytes, mode 0600; SHA-256 `d713733d4621fa28d8b9cf9c0eb8faaf8d3532d30ae760bd69ddc68f823c70f1`). The archive listing was readable and an isolated local database restore returned 13 audit rows, 12 signals, and 17 applications. Production read-only counts agree on 13 events/12 affected apps/12 open signals; no duplicate sequence positions or duplicate open signals. Restricted backup contains the original rows; do not distribute it or commit it. The earlier checkpoint's “no backup rehearsal” limitation is superseded by this evidence.
- Offline recomputation against the restored rows found a first-event hash mismatch at sequence 1 in all 12 affected groups. Eleven first-event hashes matched exactly one alternative order of the three top-level JSON metadata keys; one group with nested metadata did not match the tested top-level permutations. This is evidence consistent with a JSON serialization-order defect, not proof of the entire historical cause or authority to rewrite stored hashes. Reconcile source/write provenance and the unmatched group independently; neither chain ordering nor a blanket reseal explains the finding by itself.
- Read-only host inventory: root remains 87% used with 6.3 GiB available; `/var/lib/containerd` accounts for roughly 35 GiB and `/var/log` roughly 1.3 GiB. Docker reports 20 images (35.72 GB logical, 12.64 GB marked reclaimable) and 22.04 GB build cache (2.624 GB marked reclaimable); logical Docker totals overlap. No allowlist or cleanup approved. Inodes were 17% used, and available memory about 647 MiB at the preflight sample.
- Sanitized Nginx inventory found four `POST` 413 responses on non-API routes, none on CRM import; caller legitimacy is unverified, so retain the 10m proxy limit. Frontend logs had 76 parsed 404 responses, including one `/assets/` icon request; a fresh unauthenticated browser load retrieved current JS, CSS, and favicon with HTTP 200. No authenticated journey was attempted.
- Certbot's recent log said the certificate was not due and no renewal was attempted. The public serving certificate still expires 2026-12-02 05:34:47 UTC. A valid current certificate does not prove future renewal; expiry alert delivery remains untested.
- The admin named themselves the incident owner and independent reviewer, and provided an out-of-repository operations mailbox as the alert destination. Independence must be from the investigator/repair executor, with a documented review of original evidence and an explicit decision; self-review of one's own analysis or repair would not satisfy that gate. A3/A4 and any warning-signal closure remain blocked pending complete cause classification and a recorded decision. No alert was sent or configured in production at this checkpoint; delivery acknowledgement still needs an operational procedure.
- The temporary isolated local restore database was removed after investigation (zero matching databases on readback); the restricted dump above remains for an approved independent review. No existing development or production database was replaced.

### A2 supplemental reviewer evidence (isolated restore; 2026-10-24 UTC)

- Re-restored the checksum-verified dump into a new temporary local database (13 events/12 application groups) and inspected only redacted structure and hash comparisons. All 12 first failures are at sequence 1, with no sequence duplicates. The 11 single-event groups contain `AML_RESCREEN_QUEUED`; their stored hashes match the original `{ provider, reason, rescreenIntervalDays }` insertion order exactly, rather than the JSONB readback order `{ reason, provider, rescreenIntervalDays }`.
- The remaining two-event group starts with `EVIDENCE_MAPPING`. Its stored first hash matches exactly when metadata follows the source's `{ sourceSummary, mappings, version }` order and each mapping follows the validator's nine-field order; JSONB readback has reordered both top-level and nested keys. Its sequence-2 `AML_RESCREEN_QUEUED` hash matches the source-order metadata and the stored sequence-1 hash as predecessor. Thus all **13 stored hashes** can be reconstructed from the checked-in write-site field order, including the previously unexplained group; this is stronger evidence of serialization-order drift than a top-level-only permutation.
- Deployed revision `f781ffb6` computes v2 hashes with `JSON.stringify(metadata)` before `creditAuditEvent.create`, while verification hashes persisted JSONB metadata read back from Prisma. The two orderings can differ; the observed source-order reconstructions fit this mechanism without rewriting a row. The script history includes the earlier sequence-order migration, but an ordering collision cannot cause a first-event mismatch. The prior checkpoint's “one group unresolved” description is superseded by this source-order match, not a repair approval.
- Independent business-record cross-check: all 12 affected applications predate their first retained audit event. All 12 have an AML re-screen check; 11 have a corresponding sole audit event and the twelfth has an AML audit event at sequence 2. The affected applications have no credit decision rows. Five of the 17 applications have no audit event at all. These facts do not prove there were never missing historical events: the audit table alone cannot detect an entirely deleted chain or reconstruct pre-instrumentation history. Creation/deploy provenance and archival/log evidence should be reviewed before A3.
- This finding is for the admin's independent review of the investigator's work, not a signed decision. No hash rewrite, warning closure or production code deployment is approved. The temporary second restore was removed after verification (zero matching databases); the mode-0600 backup remains the restricted original-evidence handle.

### Local preventive rectification (not deployed; no production DB write)

- `AuditChainService.appendEvent` now writes version-3 hashes using recursive deterministic JSON-key ordering after JSON-value normalization. Version-1 and version-2 hash formulas remain unchanged; unsupported versions fail closed. No schema migration or historical-row rewrite is involved.
- An explicit `verifyChainWithLegacyCompatibility` diagnostic recognizes only the two reviewed version-2 event shapes (`AML_RESCREEN_QUEUED` and `EVIDENCE_MAPPING`) with exact source-order field reconstruction; unexpected keys, action/actor/state shapes, values and hash mismatches remain failures. The normal `verifyChain`, scheduled integrity job, and pre-disbursement assertion remain strict and do **not** accept the compatibility result automatically. This prevents an unreviewed deployment from silently clearing alerts or lifting the booking gate.
- Synthetic unit tests cover nested v3 determinism, unknown versions, strict versus diagnostic behavior, altered/extra fields, a two-event legacy chain, and a mixed v2/v3 chain. A PostgreSQL JSONB write/read round trip ran against a separately created local `help_center_audit_test` database (no production or dev DB replacement), then the test database was removed. The new implementation was also exercised read-only against a checksum-verified isolated restore: 12 groups, 13 events, 0 strict matches, 13 exact legacy-source-order matches, 0 unmatched. That restore was removed after the probe. These results do not establish that no entirely missing chain exists.
- Deployment, production alert routing/acknowledgement, historical-chain policy acceptance, signal closure, and any data repair remain separate review/approval gates. Do not run `audit:reseal`, `audit:rehash`, `migrate reset`, `db push`, or destructive cleanup on production as part of this local change.

### A2 historical provenance follow-up (isolated restore; not a completeness proof)

- All 17 credit applications in the protected snapshot were created on 2026-06-09, all use the demo seed's `CA-2026-` numbered pattern, and all 17 number-to-state pairs match `creditDemoSeed.ts:588-609`. That seed creates applications directly with Prisma at `:639-682` without an initial audit append. It later skips the initial DRAFT state in its optional audit seeding loop at `:979-984`. Direct seed creation is consistent with the absence of an initial creation event, but the audit seeding loop could create transition events if it actually ran; the snapshot does not prove why five applications have no retained row or whether other events were ever removed.
- `EVIDENCE_MAPPING` was introduced in source history on 2026-06-19; the retained mapping event is dated 2026-06-25. All twelve retained AML re-screen events and matching bureau-check records are dated 2026-10-01. One warning signal opened 2026-09-03 and eleven opened 2026-10-01. These dates and counts are consistent with the source write paths and nightly detection, but are not an independent record of every historical action or past reseal attempt.
- The five applications with no audit row are **consistent with direct seed creation**, not automatically tampering, but their historical event completeness remains unverified. Keep this scope distinction in any reviewer decision: the exact 13 retained hashes can be explained and diagnosed without rewriting them, while historical completeness beyond the retained snapshot cannot be certified solely from the audit table.

### A3 reviewer decision record — diagnostic-only decision

- Alternative considered but **not approved**: accept exact source-order legacy-v2 verification operationally for the reviewed event shapes. No original hash would change, but runtime acceptance would require a separate reviewer decision; unknown shapes, changed values, missing positions or new unexplained failures would still fail closed.
- On 2026-10-24, the admin/independent reviewer selected **“Keep diagnostic-only; leave scheduled and booking gates strict”** after being told that all 13 retained hashes match source-order metadata but that the snapshot cannot prove no older event was removed. This is a scoped operational decision, not certification of historical completeness or approval of a hash rewrite. `verifyChainWithLegacyCompatibility` remains an opt-in diagnostic only. The 12 warnings and strict pre-disbursement refusal remain in place; no data repair, warning closure, deployment approval or production apply was granted. Before any future runtime acceptance, record a new explicit decision and evidence review.

### Local alert preparation (not activated)

- `runAuditRetentionCheck` now attempts one aggregate email per broken-chain run and an integrity-unknown email when the check fails. Recipient is opt-in `AUDIT_ALERT_EMAIL`; an empty/invalid address or failed `sendEmail` is logged and sets `credit_audit_alert_delivery_success` to zero without changing the integrity result. The existing `credit_audit_broken_applications` and `credit_audit_check_success` metrics remain strict. Messages omit application IDs, event IDs, metadata, and stored hashes. The Compose file passes through the optional variable but does not set a production value.
- `scripts/audit-alerting.md` records the activation and acknowledgement procedure. At this local-preparation checkpoint no message had been sent; see the later transport test below. Mailbox receipt and acknowledgement, a backup operator and an external heartbeat remain unverified. The local email-path tests do not close the A5 operational gate; no production environment value or credential was changed.

### Authorized transport test (2026-10-25 UTC; receipt confirmed by admin)

- The admin explicitly authorized one production-provider test email to the approved operations mailbox (address kept out of the repository) and agreed to confirm receipt. The existing compiled backend sender was present, provider configured, sender configured, and development redirect absent; only configuration booleans were inspected, not secret values. A single message with subject `[TEST] CWC audit alert transport` was submitted; `sendEmail` returned `providerAccepted: true` at 03:51:43 UTC. That return alone proved only provider acceptance; the separate receipt confirmation below establishes mailbox arrival. The test did not exercise the new, undeployed audit alert job.
- The admin subsequently confirmed receipt of the exact test message. This verifies the existing provider-to-mailbox transport only; it is not proof that the new audit alert path, scheduler, failure fallback, or independent missed-job detection works. `AUDIT_ALERT_EMAIL` is not configured in production, no new code was deployed, and no production database operation was made. Operational alerting and escalation remain open.
