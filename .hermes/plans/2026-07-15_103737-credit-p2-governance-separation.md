# Credit Assessment P2 — Governance & Separation Implementation Plan

> **For Hermes:** Execute only after this plan is approved. Work test-first, preserve seed files as the source of truth, use additive Prisma migrations, and do not run reset/force-reset against any environment.

**Goal:** Close the remaining governance gaps in Credit Assessment: score models must be administratively governed, committee evidence must be immutable, analyst recommendations must be distinct from credit decisions, rating/risk semantics must be unambiguous, and financial/application-360 evidence must be regression-tested.

**Architecture:** P2 is delivered as six vertical slices. The score-factor and rating-band configuration is effective-dated, maker-checker governed, and consumed by the scoring engine. Committee submission first validates its prerequisites, then locks a durable CA-memo snapshot and emits an auditable event. A separate recommendation aggregate is required before committee submission and is SOD-checked against the final decision path. Borrower-level risk history is kept separate from application-level score/risk history.

**Stack:** Express + TypeScript, Prisma/PostgreSQL, Zod, Jest/Supertest, React/TypeScript.

---

## 1. Current State — Evidence-Based

### Completed foundation

- P0 and P1 are committed in `dbebbfe` (workflow/seed alignment, RBAC and SOD coverage, document unification, approval authority, audit reconstruction, golden journey).
- The working tree contains uncommitted P2.1 and P2.2 work:
  - P2.1: `ScoreFactorDefinition`, `CreditScoreRun.scoreRunWarnings`, governed scoring seed, missing-data warnings, rating-band seed, and the `resume_committee` workflow transition.
  - P2.2: `CreditMemoVersion`, memo-version APIs, committee-lock hook, approval-pack/preview snapshot reads.
- Fresh focused verification ran on 2026-07-15: `creditGovernedScoring.test.ts` + `creditMemoVersion.test.ts` = 47 passing; `npx tsc --noEmit` exited 0. These are not sufficient P2 exit evidence because the memo tests are largely structural and do not exercise a real transition/database flow.

### Gaps found in the in-progress implementation

| Area | Evidence | Required plan action |
|---|---|---|
| P2.1 factor governance | `scoreFactorDefinition.service.ts` provides DB rows but `scoring.service.ts` still constructs a fixed nine-factor object and does not apply factor activation/applicability to scoring. `factorKey @unique` also prevents effective-dated successor definitions. | Complete the model as a real runtime source of truth before declaring P2.1 complete. |
| P2.2 submission ordering | `creditApplication.service.ts` locks/generates the memo before `validateSubmissionReadiness()`. A rejected submission can therefore lock committee evidence. | Validate all submission gates first; only then atomically freeze/lock the correct snapshot. |
| P2.2 PDF contract | `caMemoPdf.controller.ts` now persists a version but no longer calls `enqueuePdf`; the frontend still calls `downloadCaMemo()` then polls a `jobId`. | Restore a snapshot-based PDF job and update the persisted version with its URL/job result. |
| P2.2 route ordering | `GET .../:versionNumber` is registered before `GET .../locked`, so `/locked` is treated as a version number. | Put static routes before parameterised routes and add route tests. |
| P2.2 immutability/audit | Version numbers use `count + 1` (race-prone); `governanceWarnings` is modelled but not persisted; generic admin unlock lacks a corresponding audit/revision policy. | Use serializable allocation/retry, snapshot the warnings, and adopt an explicit refer-back revision policy. |
| P2.4 admin exposure | `ratingBandConfig.routes.ts` authenticates but does not enforce any `credit:*` permission; controller accepts unvalidated bodies and directly mutates records. | Add Zod + role permissions + maker/checker activation flow. |
| P2.3/P2.5/P2.6/P2.7 | No recommendation aggregate, separate borrower-risk history contract, financial boundary suite, or tab persistence matrix exists in the inspected P2 change set. | Implement as dedicated slices below. |

---

## 2. Decisions Required Before Coding

These are product/policy decisions, not implementation details. The recommended defaults keep the roadmap intent and avoid silent weakening of controls.

| ID | Decision | Recommended default | Why it blocks implementation |
|---|---|---|---|
| D1 | Recommendation gate | Require one **submitted, current** recommendation for every committee submission after P2 migration. Legacy applications already in committee remain readable and may proceed only through a documented migration exemption. | Defines P2.3 readiness and migration behaviour. |
| D2 | Recommendation/decision SOD | A recommendation submitter cannot cast a final approval/rejection/return decision for that application; a draft author may edit only their own draft. | Defines the exact final-decision actors to query and deny. |
| D3 | Memo revisions | No generic “unlock and overwrite.” A refer-back/revision creates a new draft version; the submitted version remains permanently locked. Admin may correct metadata only through a separately audited break-glass action, not this P2 scope. | Preserves committee evidence and audit-chain meaning. |
| D4 | Rating band governance | Credit Policy is maker; a distinct Credit Risk/Admin approver activates a whole effective-dated band set. A set must cover integer scores 0–100 exactly once. | Defines the rating-band model and approval workflow. |
| D5 | Factor governance | Factor-definition edits are successor versions (effective-dated), not in-place changes to a factor used by historical score runs. | The existing `factorKey @unique` model must change if versioning is required. |
| D6 | Borrower risk cadence | Trigger borrower-risk evaluation after approved borrower-level financial/KYC/bureau changes and expose history; application scoring remains application-triggered. | Determines events, idempotency and “current risk” semantics. |
| D7 | P2.7 scope | Treat it as a persistence/consumer audit. Fix blocking persistence/data-contract defects in P2; create separately prioritised P3 items for net-new UX. | Prevents a 13-tab audit from becoming an uncontrolled redesign. |

---

## 3. Sequencing and Exit Gates

```
P2.0 baseline
  ├─► P2.1 governed score factors ─► P2.4 rating-band governance
  ├─► P2.2 immutable memo evidence ─┐
  ├─► P2.3 recommendation + SOD ────┼─► committee submission integration gate
  ├─► P2.5 risk separation ─────────┤
  ├─► P2.6 calculation regression ──┤
  └─► P2.7 Application 360 evidence ┘
```

Recommended order: P2.0 → P2.1 → P2.6 (parallel-safe) → P2.2 → P2.3 → P2.4 → P2.5 → P2.7 → full P2 exit gate.

Do not merge P2.2’s current partial implementation as a standalone capability: it currently changes a live frontend PDF contract and can lock a memo for a failed committee submission.

---

## 4. Detailed Implementation Backlog

### P2.0 — Establish an honest baseline and safety harness

**Objective:** Turn the current uncommitted P2 work into a verified baseline before extending it.

**Files:**
- Modify: `backend/src/credit/__tests__/creditGovernedScoring.test.ts`
- Replace/expand: `backend/src/credit/__tests__/creditMemoVersion.test.ts`
- Create: `backend/src/credit/__tests__/creditP2.integration.test.ts`
- Modify: `backend/prisma/seed-credit.ts`

**Steps:**
1. Run the committed P1 credit suite and record count/failures separately from P2 tests.
2. Replace structural assertions (`expect(true).toBe(true)`, locally invented route/action arrays) with service/controller integration tests against isolated database fixtures.
3. Add helpers that seed one borrower, one application, scorecard/rating configuration, permitted actors and readiness-complete committee state through existing project seed patterns.
4. Add a P2 CI target or grouped Jest command so all P2 tests are executable without manually selecting files.

**Acceptance:** no P2 completion claim relies on structural-only tests; P2 test execution is repeatable with isolated fixtures.

---

### P2.1 — Finish the governed score-factor model

**Objective:** Make factor definitions, active applicability and missing-data policy govern runtime scoring—not merely describe it.

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/<timestamp>_complete_score_factor_governance/migration.sql`
- Modify: `backend/prisma/seed-credit.ts`
- Modify: `backend/src/credit/services/scoreFactorDefinition.service.ts`
- Modify: `backend/src/credit/services/scoring.service.ts`
- Create: `backend/src/credit/controllers/scoreFactorDefinition.controller.ts`
- Create: `backend/src/credit/routes/scoreFactorDefinition.routes.ts`
- Create: `backend/src/credit/validators/scoreFactorDefinition.validator.ts`
- Modify: `backend/src/credit/routes/credit.routes.ts`
- Test: `backend/src/credit/__tests__/creditGovernedScoring.test.ts`

**Steps:**
1. Write failing tests for inactive, expired and borrower-inapplicable factors; assert they neither receive weights nor participate in totals.
2. Change the schema from one mutable `factorKey` record to effective-dated successors (for example, uniqueness on factor key + effective start/version) while retaining historical rows. Add a non-overlap service validation for the same factor’s effective windows.
3. Backfill the nine canonical definitions with the existing keys, order and descriptions. Preserve historical score-run factor snapshots without rewriting them.
4. Refactor the scoring orchestration to load applicable active definitions first, validate the selected scorecard’s factor set against them, then calculate only the governed set. Keep calculation formulas in dedicated key-specific handlers; reject an active factor without a registered calculation strategy rather than silently scoring it.
5. Apply missing-data policy at the individual missing input/factor level. Persist both `missingInputs` and `scoreRunWarnings`; include the effective factor-definition identifiers/versions in `inputSnapshot`.
6. Add read endpoints (`credit:read`) and maker-only draft/successor endpoints; reserve activation/deactivation for the approved governance path defined in D5. Add Zod validation and audit events for each configuration state change.
7. Regenerate Prisma client, run migration locally, seed with `--scoring`, and test a fresh database plus an unseeded compatibility database.

**Acceptance:** an inactive/inapplicable/expired factor cannot influence score output; missing data is explicit and persisted; factor policy changes are effective-dated and auditable; no hardcoded factor list remains the runtime authority.

---

### P2.6 — Financial and score-calculation regression contract

**Objective:** Lock current financial formula behaviour before P2 changes deepen the score engine.

**Files:**
- Create: `backend/src/credit/__tests__/financialCalculationRegression.test.ts`
- Modify only formula source modules proven by failing tests (expected candidates discovered from financial/retail-income/ratio services and `scoring.service.ts`)
- Modify: `docs/credit-scoring-methodology.md` (create if absent)

**Steps:**
1. Identify the live calculation functions and their persisted ratio keys; do not duplicate formulas inside tests.
2. Add parameterised tests for ROS, ROA, ROE, D/E, D/A, current ratio, quick ratio, DSCR, interest coverage and asset turnover.
3. Add DSR and net-DSR cases: zero income, zero commitments, deductions reducing net income to zero, null inputs and `NET` vs `GROSS` basis selection.
4. Assert divide-by-zero becomes the established nullable/not-applicable result, never `Infinity`/`NaN`; assert documented rounding boundaries consistently at 2 decimal places.
5. Add score-factor tests for all ratios missing, partial ratios and policy-specific BLOCK/PENALTY/NEUTRAL behaviour.
6. Document inputs, units, rounding and null semantics alongside the scoring methodology.

**Acceptance:** formulas, null semantics, precision and score-input behaviour are covered by deterministic regression tests.

---

### P2.2 — Complete CA memo immutable versioning safely

**Objective:** Bind a committee decision to exactly one immutable, renderable evidence snapshot and preserve the existing PDF download contract.

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Modify/create: `backend/prisma/migrations/20260715030000_add_credit_memo_versions/migration.sql` only if not deployed; otherwise create a follow-up additive migration
- Modify: `backend/src/credit/services/creditMemoVersion.service.ts`
- Modify: `backend/src/credit/services/creditApplication.service.ts`
- Modify: `backend/src/credit/controllers/caMemoPdf.controller.ts`
- Modify: `backend/src/credit/controllers/approvalPack.controller.ts`
- Modify: `backend/src/credit/controllers/creditMemoVersion.controller.ts`
- Modify: `backend/src/credit/routes/credit.routes.ts`
- Modify: `frontend/src/services/credit.service.ts` only if response fields change
- Modify: `frontend/pages/CreditApplicationDetail.tsx` only if the existing `jobId` contract must be adapted
- Test: `backend/src/credit/__tests__/creditMemoVersion.test.ts`, `backend/src/credit/__tests__/creditP2.integration.test.ts`

**Steps:**
1. Write integration tests for the full flow: generate draft v1 → regenerate draft v2 → complete readiness → submit → lock v2 → mutate live application data → verify preview and approval pack still read v2 → refer back → create v3 → resubmit → lock v3.
2. Add negative tests: incomplete readiness must create/lock no memo; duplicate submission is idempotent; concurrent generation cannot create duplicate version numbers; a normal actor cannot unlock/edit locked evidence; `/locked` resolves before `/:versionNumber`.
3. Change the submission sequence so all readiness/recommendation gates are evaluated before freeze/lock. Perform version selection/creation, lock state update and audit append in a transaction or a compensating failure-safe sequence.
4. Allocate `versionNumber` safely (serializable transaction and unique-conflict retry, or an application-scoped counter); never use `count + 1` without concurrency protection.
5. Snapshot the complete memo data, rendered HTML, score-run governance warnings and relevant configuration/version references. The approval pack and preview must consume the locked snapshot when it exists.
6. Restore the PDF job: enqueue PDF from the saved HTML snapshot, return the `jobId` expected by the frontend, and persist the finished URL through `updateMemoPdfUrl`. Do not render PDF from newly fetched live data after lock.
7. Remove the generic unlock endpoint or replace it with the D3 revision workflow. If a break-glass exception is approved later, make it separately permissioned, reason-required and audit-chain logged.
8. Correct route order: collection/static endpoints (`locked`, `latest`) before `/:versionNumber`; remove redundant `authenticate` calls below the router-level authentication gate.

**Acceptance:** a failed submission leaves no locked evidence; a successful committee submission has one immutable, auditable snapshot; preview/approval pack/PDF are derived from it; refer-back creates a subsequent version without altering the original.

---

### P2.3 — Recommendation aggregate and decision separation

**Objective:** Make the analyst recommendation a governed lifecycle object, enforce committee readiness and prevent self-decision.

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/<timestamp>_add_credit_recommendations/migration.sql`
- Create: `backend/src/credit/services/creditRecommendation.service.ts`
- Create: `backend/src/credit/controllers/creditRecommendation.controller.ts`
- Create: `backend/src/credit/routes/creditRecommendation.routes.ts`
- Create: `backend/src/credit/validators/creditRecommendation.validator.ts`
- Modify: `backend/src/credit/services/submissionReadiness.service.ts`
- Modify: `backend/src/credit/services/creditApplication.service.ts`
- Modify: the existing final-decision/approval service after tracing the controller/service route path
- Modify: `backend/src/credit/routes/credit.routes.ts`
- Test: `backend/src/credit/__tests__/creditRecommendation.test.ts`, `backend/src/credit/__tests__/creditP2.integration.test.ts`

**Steps:**
1. Write failing lifecycle tests for DRAFT → SUBMITTED → ACKNOWLEDGED/SUPERSEDED; submitted recommendations are immutable and a newer submitted recommendation supersedes the prior current recommendation.
2. Add `CreditRecommendation` with application, author, timestamps, recommendation type, amount, tenure, pricing terms, conditions, rationale and lifecycle fields. Add indexes for application/current status and an additive relation from `CreditApplication`.
3. Implement create/edit-own-draft, submit, list/current and acknowledge endpoints with Zod validation, `credit:read`/`credit:write` permissions and audit events. Do not use a generic update endpoint to mutate submitted values.
4. Add readiness rule D1: committee submission requires exactly one current submitted recommendation. Include its id/version in the memo snapshot and committee/audit metadata.
5. Trace the actual final decision path and enforce D2 server-side for every terminal approval action; do not rely on a hidden UI button. Add denial tests for recommendation author equals final decision actor.
6. Add migration/backward-compat behaviour agreed under D1, including an explicit audit marker for a permitted legacy exemption if one is approved.

**Acceptance:** recommendation and final decision are separate persisted/audited records; committee submission cannot bypass a current recommendation; self-recommendation/self-final-decision is rejected server-side.

---

### P2.4 — Rating-band and factor-config governance

**Objective:** Remove safety-net rating fallbacks only after database configuration is complete, validated, protected and approved.

**Files:**
- Modify: `backend/src/credit/routes/ratingBandConfig.routes.ts`
- Modify: `backend/src/credit/controllers/ratingBandConfig.controller.ts`
- Modify: `backend/src/credit/services/ratingBand.service.ts`
- Create: `backend/src/credit/validators/ratingBandConfig.validator.ts`
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/<timestamp>_add_rating_band_set_governance/migration.sql`
- Modify: `backend/prisma/seed-credit.ts`
- Modify: `backend/src/credit/services/scoring.service.ts`
- Test: `backend/src/credit/__tests__/ratingBandGovernance.test.ts`

**Steps:**
1. Write route tests proving unauthenticated users, `credit:read` users and same-user maker/approvers cannot modify/activate a rating set.
2. Model a versioned band set (draft → submitted → approved → active → superseded), with individual ranges belonging to one set. Do not activate individual ad hoc bands.
3. Validate ranges and dates with Zod/service logic: integer 0–100, min ≤ max, no overlaps/gaps, full 0–100 coverage, and non-overlapping active effective periods per scoring domain.
4. Add permissions: read is `credit:read`; maker actions use a dedicated existing/new config permission; approval/activation is `credit:admin` or the approved D4 role mapping. Audit all changes.
5. Seed the canonical bands as approved v1 with full coverage. Add startup/seed smoke validation that an active set exists and maps representative boundary scores.
6. Only after the seeded/configured path passes, change `mapScoreToRatingFromBands()` to fail closed on an unavailable/uncovered active configuration and remove `mapTotalScoreToRiskRating()`/`FALLBACK_BANDS` from production scoring.
7. Bring score-factor admin CRUD under the same effective-dated, audited permission model from P2.1.

**Acceptance:** every 0–100 score maps through a single approved DB band set; invalid or unauthorised edits are rejected; production scoring has no static rating fallback.

---

### P2.5 — Borrower risk versus application risk separation

**Objective:** Establish independent data, lifecycle, API and UI semantics for borrower credit quality and application-specific risk.

**Files:**
- Inspect/modify: `backend/src/credit/services/riskAssessment.service.ts`, `backend/src/credit/services/riskEngine.service.ts`, `backend/src/credit/controllers/riskAssessment.controller.ts`, `backend/src/credit/routes/riskAssessment.routes.ts`
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/<timestamp>_add_borrower_risk_run_history/migration.sql` if current models cannot support immutable borrower-level history
- Create/modify: `backend/src/credit/services/borrowerRisk.service.ts`, controller/routes only after the source-of-truth audit
- Modify: `frontend/src/services/credit.service.ts`
- Modify: `frontend/pages/credit/tabs/RiskAssessmentTab.tsx` and/or its child components after inspecting their current data contract
- Create: `backend/src/credit/__tests__/borrowerRiskSeparation.test.ts`

**Steps:**
1. Audit existing risk-assessment, risk-engine and application-rating records to decide whether an immutable `BorrowerRiskRun` is already available or must be added. Document fields/event provenance before schema design.
2. Implement D6 idempotent borrower-level trigger(s) and immutable history; preserve application score/risk history as application-scoped.
3. Expose separate borrower-risk-history and application-score-history endpoints with correct borrower/application scope checks.
4. Update the Risk Assessment UI labels, timestamps and provenance so it cannot present borrower risk as application risk (or vice versa).
5. Test that borrower data changes produce a borrower-risk run without mutating historical application score runs, and that an application rescore does not overwrite borrower history.

**Acceptance:** two independently queryable histories exist, their trigger source is explicit, and UI labels/data never conflate them.

---

### P2.7 — Application 360 persistence and downstream-consumption matrix

**Objective:** Produce evidence for all 13 Application 360 tabs and close only P2-blocking persistence/data-flow defects.

**Files:**
- Create: `docs/credit-application-360-persistence-matrix.md`
- Create/modify: focused Jest/Supertest tests under `backend/src/credit/__tests__/`
- Create/modify: focused frontend tests under `frontend/` using the project’s existing test runner
- Modify only defects proven by the matrix, with exact paths determined after the tab-by-tab trace

**Steps:**
1. Inventory the 13 tabs rendered by `frontend/pages/CreditApplicationDetail.tsx` and map each to component, API write path, persistence model, reload query and downstream consumer.
2. For each tab, exercise create/edit → reload → verify persisted data. Record status as Pass, Partial, Missing or Not Applicable—not a binary claim based on UI visibility.
3. Verify required downstream links: financial profile → scoring; documents → readiness; recommendation/approval → committee; conditions → disbursement; memo/audit → approval evidence.
4. Fix P2-blocking contract or persistence failures in the owning backend/frontend layer. Convert non-blocking new-surface needs to explicitly scoped P3 backlog entries.
5. Add at least one integration test per downstream-critical flow and one browser/component smoke test for the actual tab action path.

**Acceptance:** the matrix is evidence-backed, all committee/disbursement-critical tabs persist/reload/consume correctly, and remaining gaps have a named owner/phase.

---

## 5. Verification and P2 Exit Gate

Run after each slice and again from a clean database/seeded test environment:

```bash
cd backend
npx prisma generate
npx prisma migrate deploy
npm run prisma:seed:credit -- --scoring
npx jest src/credit/__tests__/creditGovernedScoring.test.ts \
  src/credit/__tests__/creditMemoVersion.test.ts \
  src/credit/__tests__/creditRecommendation.test.ts \
  src/credit/__tests__/ratingBandGovernance.test.ts \
  src/credit/__tests__/borrowerRiskSeparation.test.ts \
  src/credit/__tests__/financialCalculationRegression.test.ts \
  src/credit/__tests__/creditP2.integration.test.ts --runInBand
npx tsc --noEmit
npm run lint
npm test

cd ../frontend
npm run test
npm run build
```

Before the P2 completion claim, additionally prove with the integration golden path:

1. Seed governance configuration and a readiness-complete application.
2. Execute a score with missing data; confirm persisted warnings and factor/version provenance.
3. Submit a governed recommendation as Analyst A.
4. Submit to committee; assert readiness succeeds and exactly one memo snapshot locks.
5. Mutate live data; assert preview, approval pack and PDF remain snapshot-based.
6. Assert Analyst A is denied a final decision; let authorised Actor B decide.
7. Assert rating mapping is DB-only and all score boundaries are covered.
8. Assert borrower-risk and application-risk histories remain separate.
9. Re-run the original P1 individual golden journey for regression.

---

## 6. Out of Scope / Explicitly Deferred

- Party model, corporate hierarchy, group exposure and SME/corporate golden journeys remain P3.
- External bureau/AML provider integrations and regulatory PD/LGD/EAD modelling remain P4/future commercial work.
- A new Application 360 redesign is not part of P2.7; only persistence/contract defects proven by the matrix are in scope.
- Production deployment and data migration execution require a separate approved release plan. No production reset or force-reset is permitted.

## 7. Definition of Done

P2 is complete only when all of the following are evidenced by fresh tests/builds:

- Factor definitions and rating bands are effective-dated, permissioned, audited runtime configuration—not passive seed metadata.
- Missing score inputs surface persisted warnings; static production score/rating fallbacks are removed after configuration validation.
- Successful committee submission locks one immutable CA-memo snapshot; failed submission does not; approval documents/PDFs use the locked snapshot.
- Recommendation is a separate lifecycle object, required by the approved policy, and server-side SOD blocks self-final-decision.
- Borrower/application risk histories are independently persisted, queried and labelled.
- Financial calculations have deterministic boundary coverage.
- Application 360 has an evidence-backed persistence/consumption matrix, with P2 blockers resolved and remaining work explicitly deferred.
