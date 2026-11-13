# CWC production health remediation — implementation plan

Status: PLAN ONLY. No application changes, production configuration, data repairs, cleanup, or deployment are authorized by this document.

## Goal and observed baseline

Restore independently verifiable credit audit integrity and an actually delivered/acknowledged critical alert, then triage the lesser proxy/static-asset/AV/disk findings without masking evidence. Source: read-only production health check on 2026-11-01 at approximately 14:56–15:00 UTC; local repository inspection on `dev2.0`. The checked-out repository has unrelated uncommitted changes; preserve them. Check the exact production image/revision and effective mounted config before assuming local source matches running code.

| ID / priority | Observed production evidence | Closure criterion |
| --- | --- | --- |
| A / P0 | Nightly 03:00 UTC audit check reported 12 broken application chains each day Oct 28–Nov 1. Log reports first failing event per application, not total broken events. | Cause and evidence reviewed; no unapproved mutation; strict verification and protected-operation gates preserved. Zero broken chains only after separately approved, provenance-preserving repair; otherwise explicit open incident/degraded verdict. |
| B / P0 | Same five nightly runs: `No valid AUDIT_ALERT_EMAIL configured; critical alert was not delivered`. | Named owner/on-call destination, delivery test, receipt and acknowledgement proven; independent failure monitoring. Provider acceptance alone is not inbox receipt. |
| C / P1 | One Nginx notification SSE upstream timeout Oct 31 at 16:12 UTC. Internal/frontend/public health returned 200. | Correlated route and effective config; authenticated browser stream/reconnect test; no repeating timeout during agreed observation window. |
| D / P1 | 82 frontend missing-file error lines in preceding 24h; five `/assets/*.js` misses plus other JS and favicon/static misses. Attribution to real users versus crawlers is unproven. | Route-class/asset-hash inventory, real current-bundle browser smoke, no current-manifest asset misses; stale-client recovery verified if applicable. |
| E / P1 | ClamAV healthy but daily `installation is OUTDATED` warning. | Pinned, supported image/signature DB and scanner health verified after approved rollout; malware scanning remains fail-closed. |
| F / P1 | Root disk 41/48 GB used (86%, 6.9 GB free), inodes 17%; 767 MiB available RAM, 1.2 GiB of 2 GiB swap used. Zero container restarts/OOM. | Storage attribution and threshold/owner established; capacity trend stable; any cleanup explicitly scoped and verified. |
| G / P2 | Nginx temporary-response/body-buffer warnings; Compose `version` deprecation. | Classify volume and affected route before tuning; optional config cleanup at normal release, no urgent action from count alone. |

All seven containers ran; Postgres/Redis/ClamAV healthy; internal backend/frontend and public `/` and `/health` HTTP 200 with valid TLS. This proves availability, not audit correctness, alert delivery, or all feature paths.

## Decision and safety gates — before work

1. Appoint a credit/compliance incident owner and on-call recipient for A/B; decide severity, reporting/retention obligations and whether affected credit operations require manual hold. The existing `AuditChainService.assertChainIntact` gate must remain active. Do not globally disable audit checks, warning signals or the booking gate to quiet logs.
2. Production discovery is read-only. Before ANY production write (including `.env` edit, container restart, email test, backup creation, audit reseal, signal close, image pull, prune), obtain action-specific approval. For data repair, require a fresh restricted database backup, checksum, isolated restore/readback and reviewed transaction plan. Keep original event-level evidence outside the mutable DB with restricted access; never print customer identifiers, hashes, addresses, tokens, request URLs or credentials in chat/CI logs.
3. A verified hash after recomputation is not proof that no event was deleted or altered. A singleton application cannot have an inter-event ordering collision. Never use `npm run audit:rehash` without `--verify`: `backend/prisma/rehash-audit-chain.ts` otherwise deletes all audit events and synthesizes replacements. Never use `npm run audit:reseal` as a diagnostic; its default mode changes hashes. Even its `--dry-run` computes a hypothetical rewrite, not provenance proof.
4. Keep independent approvals for local code changes, push/CI, production config activation, service rollout, and database repair. No seeds, `db push`, migration resolution, broad pruning, log deletion or alert closure as a side effect of this plan.

## Phase 0 — Preserve and diagnose P0 integrity (no mutation)

Owner: credit platform engineer + independent compliance reviewer. Dependencies: decision/incident owner above.

0.1. Record UTC time, production container image IDs/revisions, production checkout status, running backend version/compiled verifier markers, scheduler configuration, migration status read-only, container health/restarts/OOM, and a restricted copy of relevant Docker log windows (not stale `/app/logs/`). Reconfirm the nightly run counts and first-failure timestamps. Protect the evidence bundle with checksums/access controls; no raw evidence in tickets or chat.

0.2. After backup authorization, make and verify a complete point-in-time backup and test restore in isolation. In a read-only transaction against the live DB (or isolated restored copy), inventory `credit_audit_events` by application: event count, `sequence` min/max and gaps/duplicates, `hash_version` distribution, created-at ties, first failing position, prior/next stored hashes and timeline relationships. Inventory `early_warning_signals` for open `AUDIT_CHAIN_BROKEN` per affected application, plus overall application/event totals. Use restricted ID-level artifacts and aggregate-only public findings. Compare first failing positions against migration history and deployed version, including the sequence backfill and v2 metadata ordering; check the specific documented legacy shapes only. Compare strict `verifyChain` to diagnostic `verifyChainWithLegacyCompatibility` without changing the production gate.

0.3. Classify each application: (a) proven historical serialization/order mismatch with intact identities and timeline; (b) sequence gap/deletion, unexplained mutation or unsupported hash version; (c) insufficient evidence. Review new post-fix writes separately; a clean new event does not validate older events. Branch B/C to incident containment and forensic review, never automatic reseal. Document independent compliance sign-off and exact candidate IDs for any branch-A repair.

Relevant code: `backend/src/credit/services/auditChain.service.ts:10-29,127-179,197-281`, `backend/src/credit/services/legacyAuditMetadata.ts:1-55`, `backend/src/credit/jobs/auditRetention.job.ts:44-132`, `backend/prisma/schema.prisma:5163-5192,6434-6460`, and the archived sequence migration. The verifier currently orders by `sequence`, checks contiguous positions and selects per-event hash version. `backend/prisma/reseal-audit-chain.ts` changes hashes and hash_version to v2, so it is NOT an approved generic repair for v3 or unexplained breaks.

Exit gate: restricted forensic report enumerates exact source evidence, hypotheses tested, cause classification per application, open signals, and disposition; no integrity claim until this passes.

## Phase 1 — Alert delivery and escalation (P0, independently of any chain repair)

Owner: production operations + compliance/on-call. Resolve recipient and paging channel as an explicit decision, not an invented address.

1.1. Confirm, without printing values, whether `AUDIT_ALERT_EMAIL` is present and syntactically valid in the *running backend*, and whether the configured Resend provider path works. Compose already maps `${AUDIT_ALERT_EMAIL:-}` in `docker-compose.prod.yml:85-89`; code sets `credit_audit_alert_delivery_success=0` and logs an error if absent (`auditRetention.job.ts:169-187`). Configure only the approved destination via the approved secrets/config process and a separately approved narrowly scoped backend replacement. Avoid displaying full `docker compose config` because it can expand secrets.

1.2. Add/verify an external, restricted monitoring rule for `credit_audit_broken_applications > 0`, `credit_audit_check_success == 0`, `credit_audit_alert_delivery_success == 0` following an attempted alert, and missed scheduler run/freshness. `/metrics` is unauthenticated in `backend/src/app.ts:207-211`; do NOT expose it publicly to satisfy monitoring. Verify the actual scrape network ACL, rule owner, receiver and retry/escalation. Distinguish provider-accepted, inbox-received and human-acknowledged states.

1.3. After authorization, perform a synthetic test through an isolated/staging job or approved production delivery mechanism that does not create/alter audit events or expose identifiers. Confirm recipient receipt and acknowledgement, not merely `sendEmail=true`; check protected-operation gates still reject a broken chain. If config-only rollout is selected, verify image ID and all unchanged runtime surfaces.

Tests: `cd backend && npm test -- --runTestsByPath src/credit/jobs/__tests__/auditRetention.job.test.ts --forceExit`; add tests for missing/invalid recipient, send failure, failed check, deduped signal, failed persistence, and metric semantics if code changes. Do not test delivery by inserting synthetic production credit evidence.

Exit gate: no nightly `No valid AUDIT_ALERT_EMAIL` after activation, receipt/acknowledgement recorded, monitor fires on a simulated failure, historical open alerts remain open until reviewed.

## Phase 2 — Conditional, separately approved integrity repair (P0, NOT automatic)

Dependency: Phase 0 forensic classification and backup/isolated restore; Phase 1 alert path operational.

2.1. If and only if a proven historical encoding/order defect affects a bounded set, write a reviewed immutable candidate report: exact event IDs, existing/new hash values kept in restricted evidence, expected before/after identity counts, actor/action/state/metadata/timestamps, sequence positions, application IDs, hash versions and unchanged row IDs. Dry-run an idempotent, allowlisted repair against the isolated restore; assert candidate set/count equals signed manifest and abort on drift. Update only necessary hash/hash_version fields with the transaction-scoped maintenance bypass where justified; preserve the previous hashes and no fabricated events. Prefer an exact-cause correction over the broad `reseal-audit-chain.ts` default-v2 rewrite. No production apply until compliance and operator approve the manifest and rollback method.

2.2. Apply during a change window with write concurrency controlled for the affected chains; revalidate live counts and IDs immediately before one bounded transaction. Verify strict `AuditChainService.verifyChain` for every application, compare event identities and business fields to the backup, inspect open EWS and protected-operation behavior. Keep prior hashes and backup for targeted reversal, not automatic full-DB restoration. Only the incident owner may close signals after independent verification and documented acknowledgement; a passing hash alone is insufficient to close provenance concerns.

2.3. If cause is unexplained alteration/deletion, keep chain failures and operations blocked, retain alerting and investigate source systems/DB audit logs/backups. Do not recompute to manufacture validity.

Tests (local isolated DB): `cd backend && npm test -- --runTestsByPath src/credit/services/__tests__/auditChain.test.ts src/credit/services/__tests__/auditChainVersion3.test.ts src/credit/__tests__/auditChainOrdering.test.ts --forceExit`; targeted tamper, missing-sequence, legacy-v2-only, v3 and immutable-trigger regression; run full backend test/build/lint before any approved release. Do not point tests at shared dev or production DB.

Exit gate: either zero broken chains with provenance review, unchanged identities/business fields, strict gate and alert delivery verified; OR incident remains explicitly DEGRADED with documented block and owner.

## Phase 3 — Proxy/SSE and frontend missing-file triage (P1)

3.1. Compare *effective* production Nginx config (`nginx -T`, sanitizing output) to `nginx/conf.d/default.conf:62-92`, exact route `backend/src/routes/notificationSse.routes.ts:8-15` and client `frontend/src/context/NotificationContext.tsx:31-32,86-121`. Local source has a dedicated 86400s no-buffer SSE location; the single timeout could reflect old mounted config, an exceptional long-lived stream or another mismatch. Correlate timeout timestamp, request method/route class and upstream timing without copying tokenized URLs or IPs. Only if persistent mismatch is proven, change proxy config/test and plan approved Nginx reload. Test reconnect, receipt/replay and lack of duplicate toast using an authorized browser session; no credential collection in chat. Observe before/after 24h timeout rate, not one green `/health`.

3.2. Aggregate 404s by sanitized route class, HTTP method, referer-present flag, user-agent/crawler class and *current-versus-older* Vite asset hash without leaking URLs. Compare live HTML manifest and actual files in frontend container with cache headers. `frontend/nginx.conf:12-20` gives a year of immutable caching to ALL `.js/.css/.ico`, not only fingerprinted assets; check whether nonhashed/static requests or stale clients account for misses. Five `/assets/*.js` misses were observed but current-bundle failures have not been established. Inspect `frontend/index.html:7,19-23` and built output, then test fresh and cached-tab navigation, CSS/JS/favicon, deep links, and mixed-version deploy. If stale clients are proven, use no-cache/revalidation for HTML/nonfingerprinted resources and immutable caching only for hashed assets; consider a bounded prior-asset retention or refresh-on-chunk-error policy with tests. Do NOT turn missing JS into SPA HTML 200 or suppress Nginx errors merely to quiet logs.

3.3. Test `nginx -t`, frontend build (`cd frontend && npm run build`) and focused frontend tests (`npm test -- --run`) before release, plus public/browser smoke and log delta after approved rollout. Route-asset correctness is independent of crawler noise and icon probes.

Exit gate: actual logged classes explained, current manifest assets load; any SSE change has demonstrated impact and reconnect/notification behavior verified.

## Phase 4 — ClamAV and capacity (P1)

4.1. For ClamAV, record *installed engine* and signatures versions/age from the container (no secrets), current pinned digest in `docker-compose.prod.yml:35-48`, vendor-supported replacement digest and compatibility with backend scan client, CPU/RAM and database volume persistence. Determine whether warning is engine-version-only or signature freshness. Rehearse pull/startup/health and benign + known test-signature detection in isolation; ensure infected/timeout/unavailable scans remain fail-closed and jobs drain. Obtain separate approval before pin update/image pull/container replacement; preserve rollback image/digest and compare scanner health/queue backlog after rollout. Never disable scanning to clear an outdated warning.

4.2. For disk, collect read-only `df -h /`, `df -i /`, `du -x` by `/var/lib/docker`, `/var/lib/containerd`, `/var/log`, `/var/www`, `docker system df -v`, `docker builder du`, journald usage, upload/DB/backups volume sizes and Docker log sizes; repeat readings for growth. Do not double-count logical Docker reclaimable bytes. Define an operator-owned capacity threshold and alert before claiming urgency. Any cache cleanup requires a separate reviewed scope (age filter, expected affected objects, preservation of running and rollback images, DB/uploads/backups); perform only after approval. Compare real free space and health/restart/OOM/image identity after action. Do not prune volumes/images, wipe logs/backups or broaden a zero-result prune automatically.

4.3. Nginx response buffering warnings: quantify by route class/body size, confirm only temp-buffer behavior and disk impact, then decide if a narrow tuning change is warranted. Compose `version` deprecation is a minor config maintenance change; keep outside incident mitigation.

Exit gate: supported/healthy scanner with current signatures, no scan bypass; disk headroom/trend and alert owner documented; no data loss from any cleanup.

## Ordered delivery and release gates

P0 incident ownership + read-only evidence → approved backup/restore → cause classification → separately approved alert activation → optional exact-cause integrity repair → P1 SSE/static/AV/disk work → P2 hygiene. Alert delivery can be activated before chain repair, but cannot be marked complete until a human receives and acknowledges a test. Preserve unrelated local edits and production-local checkout files. Do not deploy code just because the plan exists.

For each separately approved release: exact SHA/diff and CI for that SHA, immutable backend/frontend digest mapping, read-only host/dependency preflight, backup gate for any risky step, no schema migration or seed unless actually required and approved, targeted service replacement (avoid low-memory host builds), and prior image reference for rollback. Verify container image ID/restart/OOM, internal/public HTTPS/TLS, strict audit verifier and booking gate, scheduler run, metrics/alert receipt, Nginx/SSE and current assets as affected, DB migration status read-only, and timestamped 1h/24h log delta. Do not call overall health GREEN if historical broken chains remain; classify separately as available but integrity-degraded.

## Open decisions / ownership

- Compliance: incident severity, affected-operation holds, forensic evidence retention and who can approve/execute/review any hash repair.
- Operations: recipient/on-call rotation and independent monitoring receiver; provider delivery versus human acknowledgement standard.
- Product/operations: acceptable SSE reconnect behavior and asset-cache recovery for stale tabs; storage low-watermark and cleanup boundaries.
- Release owner: approved exact SHA, whether config-only activation precedes code/AV updates, backup location/restore verifier and rollback window.

Definition of done is per finding above, with an evidence link, UTC timestamps, owner and reviewer. The plan itself does not assert a cause for the 12 broken chains, browser impact from the 404s, or success of any corrective action.
