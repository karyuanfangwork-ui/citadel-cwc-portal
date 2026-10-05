# Credit Production Configuration Readiness — Implementation Plan

Date: 2026-09-30
Status: Local governance implementation is complete for readiness diagnostics, baseline reconciliation, required-field rule sets, rating-band sets, and scorecard provenance/selection. Verification snapshot (2026-10-05): Prisma Client generation and schema validation pass; backend and frontend builds pass; focused backend tests pass 21 unique suites/139 tests; focused frontend tests pass 5 files/12 tests; backend lint exits 0 with existing warnings. Full backend suite, migration application/runtime readback, staging smoke, and production rollout remain gated. No migration has been applied and no production configuration/data has changed.
Owner: Credit Product / Credit Engineering / Production Operations
Priority: P0 for restoring governed scoring readiness; P1 for legacy-engine cleanup

## 1. Goal

Resolve production credit configuration health failures without weakening production scoring controls or inventing lending policy. Make the approved required-field rules, rating bands, and scorecard version operable through auditable maker-checker lifecycles; make readiness failures visible and accurate; then activate only values approved by the credit-policy owner.

Production scoring must continue to fail closed until there is exactly one valid approved scorecard version and a complete ACTIVE rating-band set. The `/health` liveness endpoint is not a credit-methodology readiness signal.

## 2. Scope and guardrails

In scope:

- Required-field rule lifecycle and governance controls.
- Rating-band set lifecycle, maker-checker separation, validation, and audit.
- Scorecard version provenance, approval, activation, and scoring readiness.
- Readiness diagnostics that distinguish production scoring blockers from legacy/unwired warnings.
- A safe reconciliation workflow for the existing inactive/DRAFT candidate records.
- Regression, staging, and production verification gates.

Out of scope:

- Choosing or changing lending policy without credit-policy-owner approval.
- Activating configuration by SQL, running broad seed scripts, or treating a green health check as policy approval.
- Automatically rescoring, migrating, or changing any of the 17 existing production applications.
- Populating `RiskFactorMatrix` merely to clear its warning; that is a legacy engine with no runtime caller found in the current source trace.
- Rewriting the nine-factor application score engine or changing its rating thresholds as part of configuration readiness.

Safety rules:

1. Production remains read-only until a separately approved implementation and rollout.
2. Back up the production database before any configuration write; use the existing backup procedure and preserve the artifact and checksum.
3. Do not use Prisma seed or `seedBands()` to activate policy. Do not set `isActive`/`status` through direct SQL.
4. Never silently substitute hardcoded policy in production scoring. Keep fail-closed behavior.
5. Preserve the existing DRAFT records for review. Do not create duplicate candidate sets or attribute a human maker to system-created records without evidence.
6. Do not rescore existing applications without a separately approved, application-scoped plan and borrower/business communication decision.

## 3. Verified production baseline

Read-only production inspection on 2026-09-30 found:

- 80 active `CreditPolicyParameter` records and 11 active `REQUIRED_DOCUMENT` rules.
- Four `REQUIRED_FIELD` candidates (`productType`, `requestedAmount`, `currency`, `purpose`), all `isActive=false`.
- Ten rating-band rows named `Draft Canonical Rating Bands v1`, all `status=DRAFT`, version 1.
- One `Draft Canonical Credit Scorecard v1`, inactive, with a single v1 scorecard version that is inactive and has no recorded approval.
- Zero `RiskFactorMatrix` rows.
- 17 credit applications across states, including `SUBMITTED`, `CREDIT_ASSESSMENT`, and `UNDERWRITING`.
- Zero `CreditScoreRun` rows and zero `BorrowerRiskRun` rows.
- The backend logged four `CREDIT_CONFIG_HEALTH_FAILED` entries at startup on 2026-09-29 for required fields, rating bands, legacy risk-factor taxonomy, and published scorecard version. The health check is read-only and does not block server boot.

Code-path findings:

- `backend/src/credit/services/configHealth.service.ts` counts active required fields, ACTIVE rating bands, active legacy factor weights, and active scorecard versions. It logs each missing check at error severity, including the legacy engine check.
- `backend/src/credit/services/creditRuleEngine.service.ts` uses `DEFAULT_FIELD_RULES` when no active required-field rows exist. This is a fallback, not proof that the admin-owned database configuration is ready.
- Application and borrower scoring require an active scorecard version. `backend/src/credit/services/ratingResolution.service.ts` fails closed in production when no active rating bands exist.
- `backend/src/credit/services/riskEngine.service.ts` falls back to `DEFAULT_WEIGHTS`; the current repository has no runtime caller of `createBorrowerRiskRun()` beyond its definition. Do not treat that warning as equivalent to the active application scoring blockers.
- Required-rule CRUD accepts `isActive` updates under `credit:admin` without a maker-checker lifecycle (`creditRuleConfig.routes.ts`, `creditRuleConfig.controller.ts`, `creditRuleConfig.validator.ts`).
- Rating-band lifecycle routes exist, but all mutations share `credit:admin`; the service does not record/check a distinct maker identity, and `_makerId` is unused in `submitBandSetForApproval()` (`ratingBandConfig.routes.ts`, `ratingBand.service.ts`). Existing versioned scorecard activation has stronger approver-separation checks, but the generated candidate version has no creator attribution.
- The baseline generator exists at `backend/prisma/scripts/generate-credit-config-baseline.ts`. Do not assume its apply mode is safe for partial state: its rating-band branch creates a complete set if the exact expected row count is not present. Use dry-run and improve partial-set reconciliation before any future apply.

## 4. Priorities and dependency order

| Priority | Workstream | Exit gate |
|---|---|---|
| P0 | A. Establish a credit-methodology release gate and precise readiness report | Missing scorecard/bands remains fail-closed; operator sees actionable blockers separately from warnings |
| P0 | B. Govern required-field configuration | A distinct authorized reviewer approves an immutable/versioned candidate before activation; no direct activation bypass |
| P0 | C. Govern rating-band sets | Complete validated set, distinct maker/checker evidence, atomic audited activation, ACTIVE-only reads |
| P0 | D. Reconcile and govern scorecard version | Human review/provenance is recorded; distinct approver activates exactly one effective version |
| P0 | E. Controlled staging and production rollout | Backup, readback, end-to-end scoring smoke, no unintended historical changes, all blockers clear |
| P1 | F. Retire/misclassify legacy risk-matrix health warning | Health report no longer presents an unwired fallback as a live application-scoring blocker; legacy engine disposition documented |

Dependencies: A informs B–D; governance hardening in B/C must land before any corresponding production activation; B–D all require the policy-owner decision in section 10; E depends on all selected configuration lifecycles and staging acceptance; F is independent of active application scoring but should land before claiming the health report is fully green.

## 5. Workstream A — Readiness model and operational visibility (P0)

Likely files:

- `backend/src/credit/services/configHealth.service.ts`
- `backend/src/credit/routes/credit.routes.ts`
- New read-only controller/route near `backend/src/credit/controllers/` and `backend/src/credit/routes/`
- Route-discovery mount map and operation-control registry, if required by the current route-parity checks
- `backend/src/credit/services/__tests__/`

Tasks:

- [ ] Replace the bare `{name, ok, detail}` mental model with explicit severity/readiness scope (for example, `BLOCKING` for missing effective scorecard/bands; `WARNING` for unwired legacy taxonomy; `INFO` for inactive drafts).
- [ ] Keep the check read-only. It must never activate, seed, mutate, or backfill configuration.
- [ ] Report active/effective row counts, lifecycle state counts, effective-date validity, scorecard ambiguity (>1 effective version), and whether a full 0–100 band set validates. Do not expose weights or borrower/application PII from a health endpoint.
- [ ] Add an authenticated admin/read permission endpoint for detailed configuration readiness. Keep public `/health` a liveness check and do not put policy details on an unauthenticated route.
- [ ] Ensure health logging uses warning severity for an unused legacy engine and blocking/error severity only for currently exercised production scoring prerequisites.
- [ ] Add structured evidence to logs: check code, subsystem, count/state, and remediation reference; avoid repeated noisy stack traces for expected empty draft states.

Acceptance:

- No active scorecard or ACTIVE bands returns a clear blocking readiness result, while application boot and `/health` remain healthy.
- The legacy risk matrix absence is not misrepresented as a missing active application-scorecard policy.
- Tests prove readiness reads are side-effect-free and correctly distinguish empty, draft-only, active, expired, and ambiguous configuration.

## 6. Workstream B — Required-field governance (P0)

Likely files:

- `backend/prisma/schema.prisma` and a new additive migration if lifecycle/audit fields are needed
- `backend/src/credit/validators/creditRuleConfig.validator.ts`
- `backend/src/credit/controllers/creditRuleConfig.controller.ts`
- `backend/src/credit/routes/creditRuleConfig.routes.ts`
- New/updated required-rule service and tests under `backend/src/credit/services/`
- Credit admin UI/service/types under `frontend/` only if the existing screen does not support the complete workflow

Tasks:

- [ ] Inventory all existing rule callers, scope precedence, duplicate handling, and fallback behavior before altering the contract.
- [ ] Replace direct `isActive` toggling with a governed rule-set lifecycle: draft → submitted → approved → active/superseded. A set-level version/entity is preferred so the four rules activate as one atomic policy unit; do not activate partial required fields accidentally.
- [ ] Persist creator/submission/approval/activation actor IDs and timestamps, effective dates, version, and reason. Require maker/checker identity separation in the service (not only UI).
- [ ] Append an audit event in the same transaction as state transition. Include set/version, old/new lifecycle state, actor, effective date, and a safe summary of changed rule keys.
- [ ] Preserve scoped rule resolution and documented wildcard behavior. Validate that the approved set covers every intended product/lane/borrower type; prevent accidental scope gaps and conflicting duplicates.
- [ ] Keep `DEFAULT_FIELD_RULES` fallback behavior until the governed set is activated; after activation, add explicit observability to show whether a result used governed rules or defaults.
- [ ] Add tests for unauthorized access, self-approval, partial-set activation, effective-date boundaries, duplicate/scoped rules, rollback atomicity, and compatibility fallback.

Acceptance:

- No mutation route or service can set an unreviewed rule set active.
- The complete approved rule set is read atomically; users cannot observe a half-activated set.
- Tests prove the default fallback is explicit and remains distinguishable from governed production configuration.

## 7. Workstream C — Rating-band governance (P0)

Likely files:

- `backend/prisma/schema.prisma` and additive migration for a band-set identity and actor provenance, if required
- `backend/src/credit/services/ratingBand.service.ts`
- `backend/src/credit/controllers/ratingBandConfig.controller.ts`
- `backend/src/credit/routes/ratingBandConfig.routes.ts`
- `backend/src/credit/validators/ratingBandConfig.validator.ts`
- Existing rating-band service, route RBAC, lifecycle, and validator tests

Tasks:

- [ ] Represent a band set as a first-class versioned unit or add equivalent immutable set identity to every band. Do not rely on callers supplying arbitrary row-ID arrays as the only set boundary.
- [ ] Record creator/submitting actor, approver, activator, timestamps, effective dates, and set version. Existing generated rows have no demonstrated human maker; preserve that fact and require a fresh human-owned proposal or an explicitly reviewed import transition rather than fabricating attribution.
- [ ] Enforce distinct maker/checker identities in service code for submit/approve/activate. Reject self-approval and unauthorized state jumps; ensure route permission alone is not the SOD control.
- [ ] Validate complete 0–100 coverage, no gaps/overlaps, correct rating-category mapping, valid order, and one complete set before approval and again transactionally at activation.
- [ ] Make activation atomic: supersede the currently active set and activate exactly one approved set in the same transaction; append the audit event in that transaction.
- [ ] Keep scoring reads restricted to `ACTIVE` and effective bands only. Add a regression test proving `APPROVED` and `DRAFT` never affect production rating resolution.
- [ ] Restrict legacy single-band CRUD to DRAFT-only and prevent the `seed` route from bypassing the reviewed lifecycle in production. Do not change any active methodology in place.

Acceptance:

- No direct create/update/seed/activate path bypasses required validation and SOD.
- An incomplete/overlapping/gapped band set cannot be approved or activated.
- One successful activation produces exactly one effective ACTIVE set, a complete audit event, and a consistent readback.

## 8. Workstream D — Scorecard version provenance and activation (P0)

Likely files:

- `backend/src/credit/services/scorecard.service.ts`
- `backend/src/credit/controllers/scorecard.controller.ts`
- `backend/src/credit/routes/scorecardVersion.routes.ts`
- `backend/src/credit/services/scoring.service.ts`
- `backend/src/credit/services/borrowerScoring.service.ts`
- Existing scorecard approval/activation and scoring tests

Tasks:

- [ ] Preserve the existing two-person activation checks and add route/service regression coverage for unapproved, self-approved, creator-activates, future-effective, and conflicting active-version cases.
- [ ] Require policy-version provenance (scorecard ID/version and effective period) in every score run; ensure rating-band version and policy-set version are also recorded where fields already exist.
- [ ] Confirm that exactly one effective scorecard version is selected across product-specific and generic selection. Fail closed on zero or ambiguous matches.
- [ ] Add a pre-activation validator for corporate and retail factor maps: required keys, numeric range, sum to 100, and unsupported/no-provider factors. A warning for `market_conditions` must be visible and acknowledged by the policy owner before activation.
- [ ] Do not infer the maker for the existing inactive generated v1. Either create a new reviewed version with a real creator, or use a separately audited import/review action that clearly records the baseline as system-generated and records the reviewing maker/checker.
- [ ] Add tests asserting there are no silent static rating-band fallbacks in production scoring and no score-run persistence when required active governance configuration is absent.

Acceptance:

- Scoring creates a run only when one valid active scorecard and one valid active rating-band set are available.
- The saved run references the exact scorecard, rating-band, and policy versions used.
- A failed readiness gate returns a clear actionable error and does not partially persist scores or application state.

## 9. Workstream E — Baseline reconciliation and release execution (P0)

Tasks:

- [ ] Harden `backend/prisma/scripts/generate-credit-config-baseline.ts`: identify rows by canonical set identity and exact rule keys; handle partial/duplicate states without creating a second full ten-row band set; make dry-run output report conflicts and exact proposed IDs/counts.
- [ ] Add dry-run tests for empty, exact-existing, partial, duplicate, and conflicting-active states. The default remains read-only.
- [ ] In staging, run dry-run and reconcile the four field drafts, ten band drafts, scorecard, and version. Confirm actual persisted weight JSON against the proposal using a safe script/read-only query; check both weight maps sum to 100. Do not rely solely on row count.
- [ ] Credit-policy owner signs the required-field scope, rating thresholds/categories/effective date, corporate/retail weights, qualitative-factor treatment, and unsupported `market_conditions` treatment.
- [ ] Take a production backup and record path, size, checksum, and restore-validation evidence before any approved production write.
- [ ] Promote configuration only through the governed APIs after code is deployed and readiness checks pass. Do not issue raw SQL activation or broad seed.
- [ ] Read back exact active set/version IDs, actor IDs, timestamps, scopes, and effective dates. Run readiness validation and compare pre/post counts.
- [ ] Run one controlled scoring smoke test on an explicitly designated non-customer/test application in staging first. Production smoke requires explicit credit/operations approval and must not create a score against a real borrower without an approved test procedure.
- [ ] Re-check `/health`, credit readiness, backend logs, audit chain, and scoring provenance. Verify no existing application was automatically rescored or mutated.

Acceptance:

- Dry-run reports no unintended writes; apply is idempotent after readback.
- Staging scoring succeeds with expected approved versions and a reproducible score-run provenance record.
- Production config readback matches the signed policy decision, audit events identify distinct actors, and the health report has no P0 blocker.

## 10. Workstream F — Legacy risk-factor warning disposition (P1)

Tasks:

- [ ] Confirm with credit engineering whether `riskEngine.service.ts` / `RiskFactorMatrix` is formally retired, reserved, or intended to be wired into a live borrower-risk path.
- [ ] If retired/unwired, remove it from blocking configuration readiness and report it as a deprecated subsystem warning; do not insert active rows or use `DEFAULT_WEIGHTS` as a substitute policy.
- [ ] If future use is approved, write a separate design and implementation plan covering canonical taxonomy, live callers, effective dating, maker-checker, audit, scoring provenance, and migration from defaults. Do not make that change part of the required application-score readiness rollout.
- [ ] Add a test that the health report reflects the chosen subsystem disposition and that no application scoring path accidentally starts consuming legacy weights.

## 11. Product and policy decisions required before activation

1. Are the existing canonical draft values approved as the intended production methodology, or are revised thresholds/weights required?
2. Which product, lane, and borrower scopes must each required-field rule cover? Are the four baseline fields universally mandatory?
3. Is `market_conditions` allowed to retain a 5% compatibility weight without a live data provider? Safe default: do not activate until answered; use an approved weight/source decision rather than a code guess.
4. Who are the named policy owner, maker, checker, and production operator? Maker/checker must be distinct identities; production operator should not silently stand in for policy approval.
5. What non-customer application or staging fixture is approved for end-to-end scoring verification?
6. What is the disposition of the legacy six-factor risk engine and its matrix table?

## 12. Verification matrix

Backend focused tests (run from `backend/`):

- `npx jest src/credit/services/__tests__/ratingBandLifecycle.test.ts`
- `npx jest src/credit/services/__tests__/scorecard.activate.test.ts`
- `npx jest src/credit/services/__tests__/scorecard.approval.test.ts`
- `npx jest src/credit/services/__tests__/creditRuleEngine.test.ts`
- Add focused tests for new readiness, rule-set lifecycle, band-set SOD, baseline dry-run reconciliation, and score provenance.
- `npm run build`
- `npm run lint`
- Full backend test suite with counts and exit status recorded; integration tests must use the designated isolated test database, not shared development/prod data.

Manual/staging evidence:

- Maker submits; different checker approves; distinct authorized actor activates where the lifecycle requires it.
- Attempted self-approval and direct lifecycle skips are rejected server-side.
- Before activation, scoring fails closed and creates no score run.
- After activation in staging, one controlled score uses the expected versions and has immutable provenance.
- Active rules resolve correctly for each approved scope; draft/superseded/expired rows do not affect resolution.
- Public liveness and authenticated methodology-readiness are reported separately.

## 13. Rollout and rollback

Rollout order:

1. Implement governance and readiness code in local/test environments.
2. Run migrations only after schema review, migration-history verification, and staging validation; never reset production.
3. Deploy code with configuration still inactive. Confirm boot, liveness, and readiness diagnostics.
4. Obtain signed policy approval and maker/checker identities.
5. Back up production; perform the governed activation through APIs; read back the exact records and audit events.
6. Run the approved controlled scoring check and verify provenance and logs.

Rollback:

- Before activation: leave draft records inactive; no data rollback should be necessary.
- After activation: use governed supersede/deactivate workflow and reactivate the last approved known-good version only if one exists and the policy owner approves. Never delete the active row or alter it in place.
- If the activation transaction or audit evidence is inconsistent, stop scoring rollout, preserve evidence, and follow the database backup recovery procedure only after assessing whether a targeted governed rollback is safe.

## 14. Definition of done

- [ ] Readiness diagnostics accurately distinguish active scoring blockers from draft/inactive records and the legacy unwired engine.
- [ ] Required-field and rating-band activation cannot bypass server-side maker-checker and atomic audit.
- [ ] Scorecard activation preserves and proves actor separation; all scoring reads fail closed on missing/ambiguous policy.
- [ ] Existing draft candidates are reconciled without duplicate rows or fabricated authorship.
- [ ] Policy-owner decisions and exact methodology are recorded before activation.
- [ ] Staging and production evidence satisfies the verification matrix; production backup and post-activation readback are retained.
- [ ] Existing applications are unchanged unless a separate approved remediation plan explicitly authorizes a particular record-level action.

## 15. Current local implementation and verification evidence

Snapshot taken 2026-10-05. This evidence supersedes the initial implementation-status statements in the workstream narrative; it does not waive any staging, policy, or production gate.

Implemented locally:

- Readiness is admin-only and read-only; it distinguishes production scoring blockers from draft/inactive configuration and the unwired legacy risk engine.
- Baseline planning is conflict-aware, plans only missing non-conflicting rows, and rechecks before transactional writes.
- Required-field rules and rating bands use governed versioned sets with maker/checker/operator checks, scope/completeness validation, effective dates, and same-transaction platform audit events; legacy mutation paths cannot bypass governance.
- Scorecard version creation/approval/activation preserves human attribution and separates maker, checker, and operator. Activation requires policy-reference evidence and explicit `market_conditions` acknowledgment.
- Application and borrower scoring fail closed on absent or ambiguous effective scorecards/bands and store the versions used as provenance.

Verified commands/results:

- `npx prisma generate` and `npx prisma validate` — pass.
- `npm run build` from `backend/` — pass.
- `npm run build` from `frontend/` — pass; Vite reported existing chunking/dynamic-import warnings.
- `npm run lint` from `backend/` — exit 0; 1,974 warnings, 0 errors.
- Focused backend governance/readiness/baseline/scorecard set — 20 suites, 135 tests pass; `creditRuleEngine.test.ts` separately — 1 suite, 4 tests pass. One earlier focused run failed from an exhausted one-shot test mock; the mock was corrected and the full focused set rerun green.
- Focused frontend governance/navigation set — 5 files, 12 tests pass after correcting an accessible-name selector in the scorecard activation test.
- Full frontend suite — 136 files, 735 tests pass, 1 fails (`src/components/credit/detail/__tests__/applicationWorkspaceAreas.test.ts`, expected `repayment-capacity` in individual financial tabs but received only `income`). This test/surface is outside the changed files; recorded as an unresolved full-suite failure, not a passing gate.
- `git diff --check` must be rerun after the final documentation/test edits before delivery.

Still gated / not claimed complete:

- Full backend suite: do not run until a separate isolated test database is configured and verified; Jest setup currently connects through the shared Prisma configuration.
- None of the three new migrations has been applied or runtime-read back. Do not apply them to the shared development database or production as part of this task.
- Policy-owner decisions remain outstanding for required-field scopes, rating thresholds/categories, scorecard weights and qualitative-factor treatment, `market_conditions` treatment, and named policy owner/maker/checker/operator identities.
- A non-customer staging test application and staging scoring smoke are not designated/verified.
- Credit engineering must confirm whether the legacy `RiskFactorMatrix` is retired or intended for future use.
- Production backup, approval, activation, readback, and rollout remain unperformed. Production data/configuration is unchanged.

## 16. Source references

- `backend/src/credit/services/configHealth.service.ts`
- `backend/src/credit/services/creditRuleEngine.service.ts`
- `backend/src/credit/services/ratingResolution.service.ts`
- `backend/src/credit/services/ratingBand.service.ts`
- `backend/src/credit/routes/ratingBandConfig.routes.ts`
- `backend/src/credit/controllers/creditRuleConfig.controller.ts`
- `backend/src/credit/validators/creditRuleConfig.validator.ts`
- `backend/src/credit/services/scorecard.service.ts`
- `backend/src/credit/services/scoring.service.ts`
- `backend/src/credit/services/borrowerScoring.service.ts`
- `backend/src/credit/services/riskEngine.service.ts`
- `backend/prisma/scripts/generate-credit-config-baseline.ts`
- `docs/2026-08-20-credit-end-to-end-journey-audit.md` (release precondition: active scorecard version and rating bands)
- `docs/superpowers/plans/2026-08-08-credit-los-phase4-scoring-governance.md` (rating-band and scoring-governance implementation context; re-verify against this plan's current baseline)
