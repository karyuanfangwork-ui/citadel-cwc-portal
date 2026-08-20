# Borrower-Level Risk Rating — Design

**Date:** 2026-08-20
**Status:** Approved for planning
**Related:** `docs/2026-08-20-credit-end-to-end-journey-audit.md` (gaps G-02, G-03, G-16)

---

## Problem

Two problems, deliberately addressed in one change because they share the same files and the same operator-facing goal.

### 1. Borrower-level risk rating does not exist (G-16, P1)

`createBorrowerRiskRun` in `backend/src/credit/services/borrowerRisk.service.ts` has **zero production callers**. The only reference in the codebase is a test asserting the function's name exists.

- No POST route (`routes/borrowerRisk.routes.ts` exposes only two GETs)
- No scheduled job, no service hook
- No frontend caller for either GET endpoint
- Therefore `GET risk-latest` and `GET risk-history` always return empty

The service header documents a deliberate separation between `BorrowerRiskRun` (borrower-level, triggered by borrower data changes) and `CreditScoreRun` (application-level). The design was written down; only the application half was wired.

Operators report not knowing how to calculate a borrower's risk rating. They are correct that they cannot: there is no mechanism. Rating exists only per-application, via `executeScore(applicationId)`, and only once an application exists with an APPROVED financial statement behind it.

The existing stub is also internally inconsistent:

- It accepts `factorScores` and `baseRiskRating` **as arguments from its caller** — nothing in the codebase derives them
- It computes weights internally via `riskEngine.computeWeightedRisk` while storing `totalScore` as a raw *unweighted* sum of input scores. `totalScore` and `factorScores` therefore disagree by construction
- `BorrowerRiskRun` carries `scorecardVersionId` / `scorecardVersion` / `ratingBandVersion` columns that no caller populates

### 2. Borrower identity invariants are unenforced on update (G-02, G-03, P1)

`createBorrowerProfileSchema` enforces type-conditional mandatory identity fields via `superRefine` (`validators/borrowerProfile.validator.ts:67–95`). `updateBorrowerProfileSchema` (lines 98–150) has **no `superRefine` at all**, and every identity field is `.optional().nullable()`.

A borrower that passed creation validation can be edited into a state that would have failed it — NRIC, date of birth or registration number can be nulled post-KYC.

Separately, the create-time refine branches only on `INDIVIDUAL` and on `CORPORATE || SOLE_PROPRIETOR`. `BorrowerType.JOINT` has no branch, so a JOINT profile can be created carrying nothing but a defaulted type.

---

## Decisions Taken

Recorded so the reasoning survives the implementation.

| # | Decision | Rationale |
| - | -------- | --------- |
| D1 | **Purpose-built borrower factor set**, not the 9-factor application scorecard and not the 6-factor `riskEngine` | The 6-factor engine includes `PRODUCT`, which has no meaning for a borrower who has not applied for anything. The 9-factor set includes `collateral` and `market_conditions`, both application-level or sourceless. A borrower-specific set is the only clean conceptual fit. |
| D2 | **Fully auto-derived. No analyst input, no form, no "Calculate" button** | Directly dissolves the operator confusion: nobody calculates it, so there is nothing to train. Also avoids reproducing audit gap G-05 (unrubriced analyst judgment) at borrower level. Every factor is traceable to a stored field. |
| D3 | **Informational only. No existing gate reads it** | Approval matrix, board-band trigger, application scoring and readiness validation continue to key off the application's own score run. `approvalAction.service` deliberately avoids `borrowerProfile.creditRiskRating` because it drifts; that guard stays. Zero risk to hardened approval controls. The rating earns trust before it gets teeth. |
| D4 | **Borrower-scoped scorecard (option C)** rather than a new config table or code-only constants | Reuses versioning, effective dating, activation rules, `RatingBandConfig` and the `ScorecardManagement` admin screen. It is also what the schema already expects — the orphaned `scorecardVersionId` / `scorecardVersion` / `ratingBandVersion` columns on `BorrowerRiskRun` can only be populated by this option. Gives borrower rating the same replayability guarantee application scoring has. |
| D5 | **Borrower and application ratings share one 0–100 scale and one governed `RatingBandConfig` set** | `RatingBandConfig` has no scope column, and that is a feature. If the borrower factor set also scores 0–100 higher-is-better, a grade means the same thing on both objects. One scale, one band set to govern. |
| D6 | **The immutable `BorrowerRiskRun` row is the audit record.** The hash chain is not generalised | `CreditAuditEvent.applicationId` is non-nullable, so the tamper-evident chain structurally cannot carry borrower events. Making it nullable would touch `AuditChainService.verifyChain`, the sequence logic and LOS-013's ordering guarantee — disproportionate for a rating scoped as informational. `BorrowerRiskRun` is append-only and carries `calculatedById`, `runAt`, `factorScores`, `missingInputs` and resolved versions. `BorrowerActivity` provides the human-readable timeline. **Revisitable** if the rating later acquires authority. |
| D7 | **Ship G-02/G-03 together with the rating work**, not as a separate earlier change | Same files, same operator-facing goal. Documenting an unvalidated edit path in the operator guide would teach a flow that silently accepts bad data. |

---

## Architecture

### Scope discriminator

`CreditScorecard` gains `scope: ScorecardScope` — a new enum with values `APPLICATION` and `BORROWER`, defaulting to `APPLICATION` so every existing row is untouched by the migration.

`FACTOR_GROUPS` in `services/scorecard.service.ts` splits:

- `APPLICATION_FACTOR_GROUPS` — the existing nine, unchanged
- `BORROWER_FACTOR_GROUPS` — the seven defined below

`validateFactorWeights(weights, scope)` becomes scope-aware and checks the correct key set. The existing sum-to-100 assertion is unchanged and passes for both sets.

`executeScore`'s "exactly one active scorecard" rule narrows to "exactly one active **APPLICATION-scoped** scorecard". The 409 disambiguation logic and its messages stay intact; the query gains a scope filter ahead of the existing product-type filter.

> **Highest-risk edit in this design.** The scorecard-selection logic in `scoring.service.ts:376–430` was written carefully, including the multi-active 409 path. Its existing tests run before any other work in the plan.

### The seven borrower factors

Only properties knowable about a borrower standing alone, each traceable to a stored field.

| Factor key | Derived from | Weight |
| ---------- | ------------ | -----: |
| `financial_standing` | `FinancialStatement` ratios (corporate); `annualIncome` / `netWorth` / `annualTurnover` (individual) | 20 |
| `repayment_capacity` | `BorrowerIncome` DSR inputs, or `BorrowerCreditProfile.dsrPercent` / `netDsrPercent` honouring `dsrBasis`; DSCR for corporates | 20 |
| `bureau_conduct` | `BorrowerBureauReport` + `BorrowerBureauFacility` arrears; `BorrowerCreditProfile.creditScore` | 20 |
| `identity_kyc` | `kycVerifiedAt`, identity field presence, FATCA/CRS declaration, director / shareholder / UBO completeness | 15 |
| `industry_risk` | `industry` / `sicCode` against `IndustryAssessment` | 10 |
| `relationship_tenure` | `yearsTrading`, borrower record age (`createdAt`), and count of prior `CreditApplication` rows in `APPROVED` / `DISBURSED` / `ACTIVE` / `CLOSED` | 10 |
| `compliance_screening` | `amlRiskTier`, `isSanctionedEntity`, `AmlRescreenEvent` outcomes | 5 |

Total: **100**.

Polarity is **higher = better**, matching the application scorecard, so D5 holds.

**Thresholds.** `BorrowerRiskThresholds` is resolved through `getNumberPolicy` against `CreditPolicyParameter`, under a `borrower_risk.*` key prefix, with hardcoded defaults — exactly the pattern `getScoringThresholds()` already uses. No new configuration table, and thresholds are tunable without a deploy.

### Compliance is a cap, not only a weight

At 5% weight, sanctions would be dilutable by strong financials. Unacceptable. `compliance_screening` contributes its weighted score **and** drives a hard cap, mirroring `applyBureauCaps`:

| Condition | Cap |
| --------- | --- |
| `isSanctionedEntity = true` | `D` |
| `amlRiskTier = PROHIBITED` | `D` |
| `amlRiskTier = HIGH` | `BB` |

Caps only ever worsen the rating, never improve it. Recorded in the existing `BorrowerRiskRun.bureauCapsApplied` column.

### Thin data yields NR, not a bad grade

A freshly created borrower has almost no data. Rather than let missing-data policy scores masquerade as a real rating:

> If factors with genuine source data cover **less than 50% of total weight**, the run records `effectiveRiskRating = NR` with reason code `INSUFFICIENT_DATA`, retaining the derived score for reference.

This is the answer to "why does my new borrower show D" — it will not. It shows `NR`, explicitly, with the missing inputs named.

---

## Components

Four units, separated so that most logic is testable without a database.

### Unit 1 — `loadBorrowerRiskInputs(borrowerProfileId)`

*Impure. One Prisma query.*

Single call with includes, returning a flat typed `BorrowerRiskInputs` snapshot: ratios from the latest APPROVED statement, income and DSR figures, bureau report and facility arrears, KYC/identity completeness flags, industry, tenure, AML tier and sanctions flag.

Nothing else in the borrower-risk path touches Prisma for input gathering.

### Unit 2 — `borrowerRiskFactors/`

*Pure. One file per factor.*

Seven modules, each exporting one function of identical shape:

```ts
(inputs: BorrowerRiskInputs, thresholds: BorrowerRiskThresholds)
  => { score: number | null; reasonCode?: string }
```

Returning `null` means "no source data" and hands control to the missing-data policy. **A factor never invents a number.**

An `index.ts` registry maps factor key → function. Adding a factor is one new file plus one registry line.

Rationale for one file per factor: each rule stays small enough to hold in context, gets its own focused test file, and can change without reading the other six.

### Unit 3 — `computeBorrowerRisk(inputs, weights, thresholds, policies)`

*Pure.*

1. Run the registry over all seven factors
2. Apply `missingDataPolicy` to null-returning factors, collecting `MissingInputRecord[]`
3. Compute the weighted total
4. Evaluate the 50% coverage rule
5. Map score → grade via `mapScoreToRatingFromBands`
6. Apply compliance caps

Returns the complete result: `factorScores`, `totalScore`, `baseRiskRating`, `effectiveRiskRating`, `capsApplied`, `missingInputs`, `reasonCodes`, `coveragePercent`.

Fully unit-testable with literal inputs. No mocks.

### Unit 4 — `runBorrowerRiskAssessment(borrowerProfileId, opts)`

*Impure orchestrator.*

Load → compute → persist, in **one transaction**:

- Insert the `BorrowerRiskRun`
- Update `BorrowerProfile.creditRiskRating`, `riskRatingCalculatedAt`, `riskRatingVersion`
- Write the `BorrowerActivity` timeline entry

Mirrors how `executeScore` transacts its run insert, `persistApplicationRiskRating` and audit append together.

### Repair to the existing stub

`createBorrowerRiskRun` becomes a thin persistence function accepting an already-computed result, rather than computing weights internally while accepting `baseRiskRating` from its caller. This makes the `totalScore` / `factorScores` disagreement impossible by construction.

---

## Data Flow

```
BORROWER DATA WRITE
   │
   ├── borrower profile create / update
   ├── BorrowerIncome save
   ├── FinancialStatement APPROVAL
   ├── bureau report upload
   ├── AML rescreen outcome
   ├── director / shareholder / UBO change
   └── FATCA/CRS declaration
   │
   ▼
recalcBorrowerRisk(borrowerProfileId, reason, { sourceUpdatedAt })
   │   idempotency: skip if latest run.runAt >= sourceUpdatedAt
   │   non-blocking: never fails the operator's save
   │   on failure: BorrowerActivity RISK_RECALC_FAILED       ← unlike G-08
   ▼
loadBorrowerRiskInputs()            one query  → BorrowerRiskInputs
   ▼
computeBorrowerRisk()               pure
   │  7 factor fns → missing-data policy → weighted total
   │  → coverage check → RatingBandConfig → compliance caps
   ▼
runBorrowerRiskAssessment()         one transaction
   ├── INSERT BorrowerRiskRun                     (immutable)
   ├── UPDATE BorrowerProfile rating + timestamps
   └── INSERT BorrowerActivity
   ▼
READ SURFACES
   GET /borrower-profiles/:id/risk-latest     (existing, currently unused)
   GET /borrower-profiles/:id/risk-history    (existing, currently unused)
```

### Trigger → factor mapping

| Trigger | Factors affected |
| ------- | ---------------- |
| Borrower profile create / update | financial standing, industry risk, relationship tenure, compliance screening |
| `BorrowerIncome` save | repayment capacity |
| Financial statement approval | financial standing, repayment capacity |
| Bureau report upload | bureau conduct |
| AML rescreen outcome | compliance screening, **and caps** |
| Director / shareholder / UBO change | identity & KYC |
| FATCA/CRS declaration | identity & KYC |

A borrower receives its first run at creation, which will be `NR / INSUFFICIENT_DATA`.

---

## Operator Experience

The rating never asks the user to act. The **readiness strip** does.

| Surface | Component | Shows |
| ------- | --------- | ----- |
| Header / KPI band | `Borrower360Header`, `BorrowerKpiBand` | Grade, "as of" timestamp, data-coverage percentage |
| Factor breakdown | new panel following `CalculationBreakdownPanel` | Per-factor score, weight, weighted contribution, and explicitly labelled **"no data"** rows |
| Readiness strip | `BorrowerReadinessStrip` | Named missing inputs, each linking to the capture screen |
| Staleness | header badge | Derived, **no new column**: the rating is stale when `riskRatingCalculatedAt < BorrowerProfile.updatedAt`, or when the newest `BorrowerActivity` is a `RISK_RECALC_FAILED` later than the newest run |
| Risk history | new tab | Consumes the previously orphaned `risk-history` endpoint |
| Portfolio | `BorrowerDataTable`, `BorrowerFilterBar` | Rating column and filter |

The readiness strip is what closes the training gap. A user who does not know "how to calculate a borrower risk rating" does not need to — the screen names which data is missing and where to enter it, and the grade moves on its own once they do.

### One manual endpoint, deliberately secondary

`POST /borrower-profiles/:id/risk-recalc`, guarded by `credit:score`. For use when derivation logic changes or a recalc failed. Kept **off** the primary Borrower 360 surface so it does not recreate the "find the button" problem.

---

## Borrower Identity Invariants (G-02, G-03)

Copying the `superRefine` onto `updateBorrowerProfileSchema` cannot work: a PATCH is partial, so validating the patch alone cannot know whether the *merged* borrower still has an NRIC. Zod validates shape; it cannot validate an entity it cannot see.

The invariant moves to a single function:

```ts
assertBorrowerIdentityInvariants(merged: BorrowerProfileLike): void
```

Called by `borrowerProfile.service` on **both** create and update, against the post-merge record. Zod continues to handle field shape and types.

Branches:

| Borrower type | Required |
| ------------- | -------- |
| `INDIVIDUAL` | `nricPassport`, `dateOfBirth`, `nationality` |
| `CORPORATE`, `SOLE_PROPRIETOR` | `registrationNumber`, `dateOfIncorporation`, `businessNature` |
| `JOINT` | **New.** Same as `INDIVIDUAL` — `nricPassport`, `dateOfBirth`, `nationality` for the primary party |

One source of truth for "what makes a borrower valid", enforced on every write path.

> **Note on JOINT.** A first instinct was to require two identified co-borrowers, but there is no borrower-level parties model to hold them: `ApplicationParty` is application-scoped, and `Director` / `Shareholder` carry different semantics. Requiring primary-party identity closes the "nothing but a defaulted type" hole now, without inventing a data model. **Modelling joint co-borrowers properly is out of scope** and noted below.

---

## Error Handling

| Condition | Behaviour |
| --------- | --------- |
| No active BORROWER-scoped scorecard | `runBorrowerRiskAssessment` returns a typed no-op result with reason `NO_ACTIVE_BORROWER_SCORECARD`. **Not** an exception — the absence of a borrower scorecard must never break borrower saves. |
| No active `RatingBandConfig` | Same fail-soft path, reason `NO_ACTIVE_RATING_BANDS`, plus a governance warning. Consistent with how application scoring warns, but fail-soft because this path is informational. |
| Derivation throws | Caught by the dispatcher. `BorrowerActivity` entry written with type `RISK_RECALC_FAILED`; operator's save unaffected. |
| Insufficient data coverage | Not an error. `NR` + `INSUFFICIENT_DATA` reason code. |
| Sanctioned / PROHIBITED | Not an error. Cap applied, recorded in `bureauCapsApplied`. |
| Invariant violation on borrower write | 400 from the service, with the specific missing field named. |

Design principle throughout: **a borrower-risk failure never blocks a borrower write.** The rating is informational (D3); it must not become a gate by accident.

---

## Testing Strategy

Order matters. The regression suite runs first.

### 1. Regression — before touching anything

Existing `executeScore` scorecard-selection tests, particularly the multi-active **409 disambiguation** path. Adding a scope filter to that query is the likeliest way to break working behaviour.

### 2. Migration safety

Every existing `CreditScorecard` row defaults to `APPLICATION`. Application scoring behaviour is byte-identical on deploy.

### 3. Per-factor unit tests

Seven files, table-driven, literal inputs, no mocks. Each rule's boundaries and its `null` (no-data) path.

### 4. `computeBorrowerRisk`

- Weighting arithmetic
- The 50% coverage rule at, above and below the boundary
- `NR / INSUFFICIENT_DATA` path
- Cap precedence over derived grade

### 5. The dilution test — explicitly

> A sanctioned entity with excellent financials must still resolve to `D`.

This is the assertion that proves `compliance_screening` is a cap and not merely a 5% weight. It is the single most important test in this change.

### 6. Orchestrator

Transaction integrity: run insert, profile denormalisation and activity entry all commit or all roll back.

### 7. Dispatcher idempotency

Skips when the latest run post-dates the triggering change.

### 8. Invariants (G-02, G-03)

- PATCH nulling an NRIC on an `INDIVIDUAL` → 400
- PATCH nulling `registrationNumber` on a `CORPORATE` → 400
- `JOINT` create without identity → 400
- Existing valid create paths unchanged

---

## Out of Scope

Recorded so it is deliberate, not forgotten.

- **Generalising the hash chain to borrower-level events** — see D6. Revisitable if the rating acquires authority.
- **Borrower rating feeding approval authority** — D3. Available later without rework.
- **Borrower rating seeding application cold-start scores** — considered and declined for now; would couple the two engines so a borrower data change moves an application's rating.
- **A borrower-level co-borrower / parties model for `JOINT`** — see the note under Borrower Identity Invariants. This change closes the empty-profile hole; it does not model joint borrowing properly.
- **Audit gaps G-01, G-04 through G-15** — separate work, separate plans. G-01 (decision-engine off-by-one) is the highest-value remaining item.
- **The operator guide** — written after this ships, against the shipped build, covering create borrower / update borrower / read and challenge the risk rating.

---

## Success Criteria

1. A borrower created through the wizard has a `BorrowerRiskRun` within one request cycle, showing `NR / INSUFFICIENT_DATA`.
2. Approving a financial statement for that borrower produces a new run with a real grade, without any user action beyond the approval.
3. Borrower 360 shows the grade, its "as of" time, the per-factor breakdown, and named missing inputs.
4. A sanctioned borrower with strong financials rates `D`.
5. `GET risk-history` returns the accumulated runs; no run is ever mutated.
6. A PATCH that would null a mandatory identity field is rejected with the field named.
7. Every pre-existing application-scoring test passes unchanged.
8. No approval, readiness or board-band behaviour changes.
