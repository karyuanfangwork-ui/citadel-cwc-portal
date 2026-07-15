# CREDIT ASSESSMENT MODULE — IMPLEMENTATION ROADMAP

## 1. Document Control

| Item | Value |
|---|---|
| Document Name | 02-Credit-Assessment-Implementation-Roadmap.md |
| Module | Credit Assessment / Credit Origination |
| Roadmap Type | Prioritised implementation roadmap based on current-state baseline audit |
| Baseline Reference | 01-Credit-Assessment-Current-State-Baseline.md |
| Roadmap Date | 2026-07-15 |
| Status | DRAFT — subject to prioritisation review |

---

## 2. Roadmap Principles

1. **Evidence-first**: every work item traces to a baseline observation (CA-CS-xxx or domain finding).
2. **Gating over scaffolding**: fix workflow gates, RBAC, and auditability before adding new surfaces.
3. **E2E verification before new features**: prove the golden journey works end-to-end before extending it.
4. **Vertical slices**: each phase delivers a verifiable, testable, deployable capability — not horizontal refactors.
5. **No regressions**: every phase includes regression tests and CI gates before merge.

---

## 3. Maturity Summary from Baseline

| Capability Group | Current Maturity | Baseline Progress | Target Phase |
|---|---|---|---|
| Application management & workflow | INTEGRATED | 70-80% | P1 (hardening) |
| Borrower model & management | PARTIAL / IMPLEMENTED | 55-65% | P2 (enrichment) |
| Financial profile & calculations | IMPLEMENTED | 70-80% | P1 (verification) |
| Document & verification | IMPLEMENTED / INTEGRATED | 70-80% | P1 (dedup + gates) |
| Credit scoring | IMPLEMENTED / PARTIAL | 55-65% | P2-P3 (governance) |
| Risk assessment & rating | PARTIAL / IMPLEMENTED | 55-65% | P2-P3 (governance) |
| Recommendation, approval, decision | PARTIAL | 45-60% | P2 (separation) |
| RBAC & SOD | PARTIAL | 45-60% | P1 (matrix) |
| Auditability | PARTIAL / IMPLEMENTED | 55-70% | P2 (CA memo snapshot) |
| Test / E2E verification | PARTIAL | 25-40% | P1 (golden journeys) |

---

## 4. Phase Overview

| Phase | Name | Duration (est.) | Focus | Entry Criteria | Exit Criteria |
|---|---|---|---|---|---|
| **P0** | Stabilisation & Quick Wins | 1-2 weeks | Fix stale seed, permission mismatch, disconnected UI, run existing tests | Baseline audit complete | Seed aligned, permission mismatch resolved, 61 backend tests green, CI gate enforced |
| **P1** | Hardening & E2E Proof | 4-6 weeks | RBAC matrix, workflow verification, document dedup, golden journey E2E tests, scoring governance foundation | P0 exit | E2E test for Individual journey DRAFT→DISBURSED passes; RBAC endpoint matrix documented; CI green |
| **P2** | Governance & Separation | 4-6 weeks | Governed scoring model, CA memo snapshot, recommendation/decision separation, audit reconstruction | P1 exit | Score factors no longer placeholder-backed; CA memo immutable versioning; recommendation entity distinct; audit chain reconstructable |
| **P3** | Corporate & SME Depth | 3-4 weeks | Universal party model, corporate party hierarchy, exposure consolidation, SME E2E journey | P2 exit | Corporate party graph supports directors/UBOs/shareholders; group exposure computed; SME golden journey passes |
| **P4** | Production Readiness | 2-3 weeks | External integration stubs, deployment config, production seed, monitoring, documentation | P3 exit | All three golden journeys pass; external bureau/AML adapters documented; prod compose includes all envs; runbook exists |

**Total estimated timeline: 14-21 weeks**

---

## 5. Phase 0 — Stabilisation & Quick Wins (1-2 weeks)

**Goal**: Align the codebase with itself — fix inconsistencies that the baseline found, run existing tests, and establish CI gates.

### P0.1 — Align Workflow Seed with Service State Machine

| Item | Detail |
|---|---|
| Baseline ref | CA-CS-023 |
| Problem | Seed omits `COMPLIANCE_HOLD`, `CONDITION_FULFILMENT`, `REFERRED_BACK` transitions; seed is stale versus service schema |
| Scope | Update `backend/prisma/seed-credit-workflow.ts` to include all states and transitions present in `creditApplication.service.ts:135-246` and `schema.prisma:2712-2732` |
| Verification | `npm run prisma:seed` completes; query `WorkflowTransition` table matches service TRANSITIONS array |

### P0.2 — Fix Disburse Permission Mismatch

| Item | Detail |
|---|---|
| Baseline ref | CA-CS-024 |
| Problem | Route maps `disburse → credit:disburse`; service transition metadata maps `disburse → credit:admin` |
| Scope | Align both to the intended permission. Decision needed: should disburse require `credit:admin` or `credit:disburse`? Recommend `credit:disburse` for SOD. Patch `creditApplication.service.ts:259-286` transition metadata or `creditApplication.routes.ts:18-35` route map — not both |
| Verification | Transition permission matches route permission; `npm test` passes |

### P0.3 — Remove or Wire Disconnected UI Links

| Item | Detail |
|---|---|
| Baseline ref | CA-CS-026, CA-CS-027, CA-CS-028 |
| Problem | `/credit/audit` link has no backend route; borrower export logs to console only; Application 360 computes `visibleTabGroups` but renders fixed `TAB_GROUPS_360` |
| Scope | (a) Remove or gate the `/credit/audit` nav link until audit route exists; (b) implement borrower export API endpoint or remove the export button; (c) use `visibleTabGroups` in tab rendering or remove the computation |
| Verification | No dead nav links; export button either works or is removed; tab gating is consistent |

### P0.4 — Run Existing Backend Tests & Establish CI Gate

| Item | Detail |
|---|---|
| Baseline ref | CA-CS-031, CA-CS-032 |
| Problem | 61 backend credit test files exist but were not freshly run in the audit |
| Scope | Run `npm test` in `backend/`; record pass/fail; fix any failures; add CI gate to GitHub Actions if not present |
| Verification | All 61 backend credit tests pass; CI gate enforces `npm test` before merge |

### P0.5 — Frontend Test Baseline

| Item | Detail |
|---|---|
| Baseline ref | CA-CS-032 |
| Problem | Only 3 credit-specific frontend tests exist |
| Scope | Run existing frontend tests; record baseline count; identify lowest-effort additions (creditUtils, transition labels, tab rendering) |
| Verification | Frontend `npm run test` passes; baseline count recorded for P1 expansion |

---

## 6. Phase 1 — Hardening & E2E Proof (4-6 weeks)

**Goal**: Prove the Individual borrower journey works end-to-end; document RBAC; unify document requirements; add test coverage.

### P1.1 — RBAC Endpoint Permission Matrix

| Item | Detail |
|---|---|
| Baseline ref | CA-CS-017, Domain 18 |
| Problem | Full endpoint-by-endpoint permission enforcement is UNKNOWN |
| Scope | Extract every credit route from `credit.routes.ts` and sub-routers; document required permission per route; generate a test matrix; add parameterised tests that verify each route rejects unauthorised and unauthenticated calls |
| Deliverable | `docs/credit-rbac-matrix.md` + test file `creditRbac.test.ts` |
| Verification | Matrix matches route code; all parameterised RBAC tests pass |

### P1.2 — SOD Verification Tests

| Item | Detail |
|---|---|
| Baseline ref | CA-CS-016, CA-CS-017 |
| Problem | Score override SOD is implemented but broader SOD (recommend→approve, create→disburse) is not verified |
| Scope | Write tests for: (a) same user cannot recommend and approve same application; (b) same user cannot create and disburse same application; (c) same user cannot create and approve same score run; (d) disbursement SOD (creator ≠ approver, approver ≠ disburser) |
| Verification | All SOD tests pass |

### P1.3 — Document Requirement Source Unification

| Item | Detail |
|---|---|
| Baseline ref | Domain 6 flags, CA-CS-018 |
| Problem | Document requirements exist as both hardcoded readiness defaults and configurable rule-based checklist seeding |
| Scope | Refactor `submissionReadiness.service.ts:18-28` to call `resolveRequiredDocuments()` from `creditDocument.service.ts:795-804` instead of maintaining a parallel static list. Remove hardcoded `getRequiredDocuments()` or make it delegate to the rule engine |
| Verification | Committee submission readiness uses unified document source; existing tests updated; no readiness regression |

### P1.4 — Individual Golden Journey E2E Test

| Item | Detail |
|---|---|
| Baseline ref | CA-CS-020, CA-E2E-001 |
| Problem | No automated E2E test proves the Individual journey from creation through decision |
| Scope | Write an integration test (supertest + real DB) covering: (1) create borrower, (2) create application, (3) upload & verify document, (4) enter retail income/DSR, (5) execute score run, (6) submit to committee, (7) approve, (8) complete conditions, (9) create disbursement order. Use seeded test data. This is the single most important deliverable of P1 |
| Verification | `creditGoldenJourney.individual.test.ts` passes from DRAFT through DISBURSED |

### P1.5 — Workflow Transition Validation Tests

| Item | Detail |
|---|---|
| Baseline ref | CA-CS-001, Domain 4 |
| Problem | Transition graph is code-defined; complete validated transition logic has not been tested for every status change |
| Scope | Parameterised test: for every valid transition in TRANSITIONS array, assert the transition succeeds from the correct state. For every invalid transition, assert it is rejected. Cover all 20 application states |
| Verification | All valid transitions succeed; all invalid transitions are rejected |

### P1.6 — Scoring Governance Foundation

| Item | Detail |
|---|---|
| Baseline ref | CA-CS-008, CA-CS-009, CA-CS-010, Section 12 |
| Problem | `NO GOVERNED CREDIT SCORING MODEL EVIDENCED`; placeholder factors, JSON-configured weights without schema validation |
| Scope | (a) Add Zod/JSON schema validation for `factorWeights` and `retailFactorWeights` on `CreditScorecardVersion` creation/update — enforce required keys, numeric bounds (0-100), and sum-to-100 constraint. (b) Add validator for `RatingBandConfig` — prevent overlapping ranges, enforce required fields. (c) Mark `market_conditions` factor as explicitly requiring data source configuration or remove from default scoring path until real data is available. (d) Document scoring methodology in `docs/credit-scoring-methodology.md` |
| Verification | Scorecard version creation rejects invalid weights; rating band creation rejects overlaps; `market_conditions` no longer silently defaults to placeholder |

### P1.7 — Approval Authority Negative Tests

| Item | Detail |
|---|---|
| Baseline ref | CA-CS-013, Domain 14 |
| Problem | Above-authority approval denial is not dynamically verified |
| Scope | Write tests for: (a) approval below required authority level is rejected; (b) approval above application exposure/rating threshold is rejected; (c) duplicate approval by same approver is rejected |
| Verification | All authority boundary tests pass |

### P1.8 — Audit Trail Reconstruction Test

| Item | Detail |
|---|---|
| Baseline ref | CA-CS-019, Domain 19 |
| Problem | Complete decision reconstruction is not proven |
| Scope | Write a test that creates an application, uploads a document, executes a score run, creates an approval decision, and then queries audit events to reconstruct the full timeline — asserting actor, timestamp, before/after state for each event |
| Verification | Audit reconstruction test passes; timeline is reconstructable from events alone |

---

## 7. Phase 2 — Governance & Separation (4-6 weeks)

**Goal**: Replace placeholders with governed data; create immutable CA memo; separate recommendation from decision; establish scoring governance.

### P2.1 — Governed Credit Scoring Model

| Item | Detail |
|---|---|
| Baseline ref | CA-CS-008, CA-CS-009, CA-CS-010, Section 12.15 |
| Problem | Score factors use placeholder scores, neutral defaults for missing data, and code-defined factor definitions |
| Scope | (a) Create `ScoreFactorDefinition` model in Prisma schema: factor key, label, description, input source type (ratio/qualitative/external), applicable borrower types, active flag, effective dates. (b) Migrate hardcoded factor definitions in `scoring.service.ts` to query `ScoreFactorDefinition`. (c) Replace `PLACEHOLDER_SCORE` and `NEUTRAL_SCORE` with explicit missing-data policies that surface warnings in score run output. (d) Add `ScoreRunWarning` array to `CreditScoreRun` for missing-data indicators. (e) Remove `mapTotalScoreToRiskRating()` static fallback after confirming `RatingBandConfig` seed covers all ranges |
| Deliverable | Schema migration, service refactor, seeding, regression tests |
| Verification | Score run with missing inputs produces warnings, not silent neutral scores; all factors are database-defined; static fallback removed |

### P2.2 — CA Memo Immutable Versioning

| Item | Detail |
|---|---|
| Baseline ref | Domain 12, CA-CS-019 |
| Problem | No separate immutable CA memo snapshot table; approvers may review regenerated data |
| Scope | (a) Create `CreditMemoVersion` model: applicationId, version, memoData (JSONB), generatedAt, generatedBy, status (draft/locked/submitted), lockedAt, lockedBy. (b) Refactor `caMemoPdf.service.ts` to save a `CreditMemoVersion` snapshot when generating memo. (c) Lock memo version on committee submission; prevent regeneration of locked versions. (d) Approval pack controller references locked version, not live data. (e) Add audit event for memo version lock |
| Verification | Memo snapshot is immutable once locked; committee submission references locked version; regeneration creates new version |

### P2.3 — Recommendation Entity

| Item | Detail |
|---|---|
| Baseline ref | Domain 13, CA-CS-014 |
| Problem | Analyst recommendation is not a distinct governed object separate from final credit decision |
| Scope | (a) Create `CreditRecommendation` model: applicationId, recommendedById, recommendedAt, recommendationType (approve/reject/conditional), recommendedAmount, recommendedTenure, pricingTerms (JSONB), conditions, rationale, status (draft/submitted/acknowledged/superseded). (b) Add recommendation routes and service. (c) Wire recommendation into committee submission readiness: require submitted recommendation before committee. (d) Add SOD check: same user cannot both recommend and make final decision on same application. (e) Add audit event for recommendation submission |
| Verification | Recommendation entity exists; committee submission requires recommendation; SOD check prevents self-approval |

### P2.4 — Rating Band Governance

| Item | Detail |
|---|---|
| Baseline ref | CA-CS-012, Section 12.9 |
| Problem | Static fallback bands remain hardcoded; no admin validation for overlapping bands |
| Scope | (a) Seed `RatingBandConfig` covering the same ranges as the current static fallback. (b) Add validator that rejects overlapping score ranges within the same version/effective period. (c) Remove `mapTotalScoreToRiskRating()` static fallback after confirming seeded bands cover all ranges. (d) Add rating band version approval flow |
| Verification | All score ranges map to ratings from DB; no static fallback; overlapping bands are rejected |

### P2.5 — Borrower Risk / Application Risk Operational Separation

| Item | Detail |
|---|---|
| Baseline ref | CA-CS-004, CA-CS-011 |
| Problem | Borrower risk and application risk converge through current rating surfaces |
| Scope | (a) Ensure `BorrowerRiskRun` is always triggered independently from application scoring. (b) Document that borrower risk rating reflects borrower-level credit quality and application risk rating reflects application-level risk. (c) Add API endpoint to retrieve borrower risk history separate from application score history. (d) Ensure UI clearly labels which rating is which |
| Verification | Borrower risk and application risk are displayed distinctly; history APIs are separate |

### P2.6 — Financial Calculation Regression Suite

| Item | Detail |
|---|---|
| Baseline ref | CA-CS-006, Domain 8 |
| Problem | Financial ratio/DSR formulas are implemented but rounding, null handling, and current regression pass status are UNKNOWN |
| Scope | Write parameterised tests for: (a) DSR and net-DSR with edge cases (zero income, zero commitments, null values). (b) All financial ratios (ROS, ROA, ROE, D/E, D/A, current, quick, DSCR, interest coverage, asset turnover). (c) Divide-by-zero null handling. (d) Rounding consistency (2dp throughout). (e) Score factor calculation edge cases (all ratios missing, partial ratios) |
| Verification | All financial calculation tests pass; edge cases documented |

### P2.7 — Application 360 Tab Persistence Verification

| Item | Detail |
|---|---|
| Baseline ref | CA-CS-021, Domain 5 |
| Problem | Some tabs may not persist, reload, or feed downstream consumers |
| Scope | For each of the 13 tabs: (a) verify data entered in the tab is persisted via API call. (b) Verify data reloads on page refresh. (c) Verify data is consumed by downstream (e.g. financial data feeds scoring, documents feed readiness, conditions feed disbursement). Document any gaps |
| Verification | Tab persistence matrix documented; gaps turned into P2/P3 work items |

---

## 8. Phase 3 — Corporate & SME Depth (3-4 weeks)

**Goal**: Complete the party model for corporate/SME; prove SME and Corporate golden journeys; add exposure consolidation.

### P3.1 — Universal Party Model Foundation

| Item | Detail |
|---|---|
| Baseline ref | CA-CS-003, Domain 1 |
| Problem | No universal Party model; Applicant, Borrower, Customer, Director, UBO, Shareholder not represented as one clean governed hierarchy |
| Scope | (a) Create `Party` model as a supertype: id, partyType (INDIVIDUAL/ORGANISATION), displayName, taxId, registrationNumber, status, timestamps. (b) Create `PartyRole` link model: partyId, role (APPLICANT/BORROWER/GUARANTOR/DIRECTOR/UBO/SHAREHOLDER/CUSTOMER), applicationId (nullable for borrower-level roles), effectiveFrom, effectiveTo. (c) Create `PartyRelationship` model: fromPartyId, toPartyId, relationshipType (DIRECTOR_OF/SHAREHOLDER_OF/BENEFICIAL_OWNER_OF/RELATED_TO), ownershipPercentage, effectiveFrom, effectiveTo. (d) Migrate `BorrowerProfile` to extend `Party` via `partyId`. (e) Migrate `ApplicationParty` to reference `PartyRole`. (f) Keep backward compatibility: `BorrowerProfile` still works; `Party` adds governance layer |
| Verification | Party model seeded; borrower creation creates Party; application party references PartyRole; existing API tests still pass |

### P3.2 — Corporate Party Hierarchy

| Item | Detail |
|---|---|
| Baseline ref | CA-E2E-003 |
| Problem | Corporate party/related-party structure, UBO/director/shareholder lifecycle not fully governed |
| Scope | (a) Build on P3.1 Party model. (b) Add UI for corporate party structure: directors, shareholders, UBOs with ownership percentages. (c) Add API endpoints for party relationship CRUD. (d) Validate that corporate borrowers have at least one director. (e) Wire party relationships into Application 360 Customer Profile tab |
| Verification | Corporate borrower can add directors/shareholders/UBOs; relationships persist and reload; UI displays party graph |

### P3.3 — Group Exposure Consolidation

| Item | Detail |
|---|---|
| Baseline ref | CA-E2E-003, Domain 8 |
| Problem | Group exposure calculation exists but corporate related-party exposure consolidation is not fully traced |
| Scope | (a) Implement group exposure service that aggregates exposure across all parties in a `PartyRelationship` group. (b) Add API endpoint for group exposure calculation. (c) Wire group exposure into committee submission readiness and approval matrix lookup. (d) Add group exposure display to Application 360 and `/credit/group-exposure` page |
| Verification | Group exposure computed across related parties; readiness check includes group exposure; approval matrix uses group exposure |

### P3.4 — SME Golden Journey E2E Test

| Item | Detail |
|---|---|
| Baseline ref | CA-CS-020, CA-E2E-002 |
| Problem | No automated E2E test for SME journey |
| Scope | Write integration test covering: (1) create corporate borrower, (2) create application, (3) add directors/shareholders via Party model, (4) enter financial statements, (5) compute ratios, (6) execute score run, (7) submit to committee, (8) approve, (9) create disbursement order |
| Verification | `creditGoldenJourney.sme.test.ts` passes end-to-end |

### P3.5 — Corporate Golden Journey E2E Test

| Item | Detail |
|---|---|
| Baseline ref | CA-CS-020, CA-E2E-003 |
| Problem | No automated E2E test for corporate journey |
| Scope | Write integration test covering: (1) create corporate borrower with full party hierarchy, (2) create application with facilities and collateral, (3) add guarantees, (4) enter financial statements, (5) compute ratios including DSCR, (6) execute score run, (7) submit to committee, (8) approve with conditions, (9) fulfil conditions, (10) create disbursement order |
| Verification | `creditGoldenJourney.corporate.test.ts` passes end-to-end |

---

## 9. Phase 4 — Production Readiness (2-3 weeks)

**Goal**: Replace placeholder integrations; complete deployment config; add monitoring; document runbook.

### P4.1 — External Bureau & AML Adapter Interfaces

| Item | Detail |
|---|---|
| Baseline ref | CA-CS-029, Domain 9 |
| Problem | External bureau and AML providers are placeholder/no-op; bureau returns null, AML returns clear |
| Scope | (a) Define adapter interfaces for bureau score retrieval and AML screening. (b) Implement adapter pattern with configurable provider (noop for dev, real for prod). (c) Store adapter configuration in `CreditRuleConfig` or environment. (d) Wire bureau adapter into scoring service for bureau cap. (e) Wire AML adapter into borrower screening flow. (f) Keep noop adapter as default for development |
| Verification | Bureau adapter interface exists; scoring service calls adapter; AML adapter interface exists; noop adapter passes existing tests |

### P4.2 — ECL Calculation Clarification

| Item | Detail |
|---|---|
| Baseline ref | CA-CS-030 |
| Problem | ECL is stored from supplied values, not computed as an evidenced engine; EAD implementation not found |
| Scope | (a) Document that current ECL is user-supplied, not model-computed. (b) If business requires computed ECL, design PD/LGD/EAD model architecture as a future phase (not this roadmap). (c) Add ECL data validation (PD 0-1, LGD 0-1, EAD >= 0). (d) Ensure ECL readiness check for corporate products uses stored values correctly |
| Verification | ECL storage/validation works; ECL calculation is documented as future scope |

### P4.3 — Deployment Configuration Completeness

| Item | Detail |
|---|---|
| Baseline ref | Domain 4 (deployment gap), Section 21 |
| Problem | Production compose lacks credit-specific cron/scheduler envs |
| Scope | (a) Add `CREDIT_SLA_CRON`, `AML_RESCREEN_CRON`, `AUDIT_RETENTION_CRON`, and scheduler singleton envs to `docker-compose.prod.yml`. (b) Add health checks for credit scheduler jobs. (c) Verify all feature flags are configurable via env. (d) Document all credit-related env vars in deployment runbook |
| Verification | `docker compose config` validates; credit scheduler jobs start with configured env; health checks respond |

### P4.4 — Monitoring & Alerting

| Item | Detail |
|---|---|
| Baseline ref | Section 21 (missing runtime evidence) |
| Scope | (a) Add structured logging for credit events: application transition, score execution, approval decision, disbursement. (b) Add metrics: application count by state, SLA breach count, score execution time, approval turnaround time. (c) Add alerts: SLA breach, score execution failure, disbursement SOD violation, audit hash chain break |
| Verification | Credit events appear in structured logs; metrics dashboard shows application state counts |

### P4.5 — Production Seed & Smoke Tests

| Item | Detail |
|---|---|
| Baseline ref | CA-CS-023, Section 21 |
| Problem | Seed appears stale; no production smoke test |
| Scope | (a) Create production-safe seed script that creates initial admin, scorecards, rating bands, approval matrix, and workflow transitions. (b) Never use `--force-reset` on production DB. (c) Write smoke tests that verify production readiness: scorecard exists, rating bands cover full range, approval matrix has entries, workflow transitions match service. (d) Run smoke tests against staging before promotion |
| Verification | Production seed runs without error; smoke tests pass on staging |

### P4.6 — Documentation & Runbook

| Item | Detail |
|---|---|
| Baseline ref | Multiple (overall production readiness) |
| Scope | (a) Write `docs/credit-runbook.md`: architecture overview, deployment steps, environment variables, monitoring, incident response, data model reference. (b) Write `docs/credit-scoring-methodology.md`: factor definitions, weight governance, rating band management, override process. (c) Write `docs/credit-rbac-matrix.md`: endpoint permissions. (d) Write `docs/credit-operations-guide.md`: daily operations, SLA monitoring, score override approval, committee procedures |
| Verification | Documentation reviewed; covers all baseline observations |

---

## 10. Cross-Cutting Concerns

### 10.1 — Test Strategy

| Test Type | Scope | Phase |
|---|---|---|
| Unit | Financial calculations, scoring factors, DSR, ratio thresholds | P1, P2 |
| Integration | RBAC matrix, SOD checks, workflow transitions, readiness gates | P1 |
| E2E / Golden Journey | Individual (P1), SME (P3), Corporate (P3) | P1, P3 |
| Regression | Scoring governance, rating bands, financial edge cases | P2 |
| Smoke | Production readiness, seed integrity, configuration | P4 |
| Security | Permission bypass, above-authority, transition bypass | P1 |

### 10.2 — CI Pipeline Requirements

- Backend: lint → typecheck → test (with Postgres + Redis) → build
- Frontend: lint → typecheck → test → build
- PR gate: all jobs must pass before merge
- Nightly: run full credit golden journey suite

### 10.3 — Database Migration Safety

- All schema changes (P2 Party model, P2 Recommendation, P2 CA Memo Version, P3 Party Role/Relationship) must use additive migrations first, then backfill, then remove old columns.
- Never use `--force-reset` on production.
- Seed migrations must be idempotent (findFirst + create/update pattern).

### 10.4 — Backward Compatibility

- BorrowerProfile API must continue to work during and after P3.1 party model migration.
- ApplicationParty must reference PartyRole but remain queryable.
- Existing score runs must not break when factor definitions migrate to DB (P2.1).
- CA memo generation must reference locked version when available, but still work for draft memos (P2.2).

---

## 11. Risk Register

| ID | Risk | Impact | Mitigation |
|---|---|---|---|
| R1 | Party model migration (P3.1) breaks existing BorrowerProfile API | High | Additive migration; keep BorrowerProfile as primary until Party is proven; extensive backward-compat tests |
| R2 | Scoring refactor (P2.1) changes factor key names and breaks existing score runs | High | Factor keys remain backward-compatible; `ScoreFactorDefinition` includes key alias; migration script backfills |
| R3 | CA memo versioning (P2.2) locks memo too early in workflow | Medium | Lock only on committee submission; allow draft regeneration; add unlock/revision flow for refer-back |
| R4 | Golden journey tests (P1.4, P3.4, P3.5) are flaky due to test data dependencies | Medium | Use seeded test data; reset between tests; add retry logic for async operations |
| R5 | Rating band removal (P2.4) leaves score ranges uncovered | Medium | Seed bands covering all ranges before removing fallback; add startup validation check |
| R6 | Recommendation entity (P2.3) slows committee submission for existing applications | Low | Make recommendation optional in P2 for backward compat; require in P3 |
| R7 | External bureau/AML adapter (P4.1) requires third-party contracts | Low | Adapter pattern with noop default; real provider integration is a separate commercial decision |

---

## 12. Success Criteria

| Criterion | Measurement | Phase |
|---|---|---|
| Workflow seed aligned with service | Seed transitions = service transitions | P0 |
| Permission mismatch resolved | disburse route and service metadata agree | P0 |
| Individual golden journey passes E2E | `creditGoldenJourney.individual.test.ts` green | P1 |
| RBAC matrix documented and tested | All credit routes have permission tests | P1 |
| Scoring has no silent placeholder scores | Missing inputs produce warnings, not neutral defaults | P2 |
| CA memo is immutably versioned | Locked memo cannot be regenerated; new version created instead | P2 |
| Recommendation is distinct from decision | Separate model, separate API, SOD check | P2 |
| Corporate party hierarchy works | Directors, shareholders, UBOs can be added and persisted | P3 |
| Group exposure is computed | Aggregation across related parties returns correct total | P3 |
| All three golden journeys pass | Individual, SME, Corporate E2E tests green | P3 |
| Deployment config complete | Docker compose includes all credit env vars; health checks respond | P4 |
| Runbook exists | `docs/credit-runbook.md` covers architecture, deployment, monitoring, incident response | P4 |

---

## 13. What This Roadmap Does NOT Cover

1. **External LMS/core banking integration** — the baseline found no evidence of external integration; this is a commercial and architectural decision beyond the current scope.
2. **Statistically validated PD/LGD/EAD model** — the current scoring model is an internal weighted scorecard; migrating to a regulatory-grade model requires separate actuarial/statistical work.
3. **UI redesign or new UI surfaces** — this roadmap focuses on backend governance, data model, and verification. UI improvements are tracked separately.
4. **Mobile application** — mobile approval inbox exists but is not in scope for governance hardening.
5. **Performance and load testing** — important for production but orthogonal to functional governance.
6. **Data migration from legacy systems** — assumes starting from current seed data.

---

## 14. Phase Dependency Graph

```
P0 ──► P1 ──► P2 ──► P3 ──► P4
       │       │       │
       │       │       └── P3.1 (Party Model) is prerequisite for P3.2, P3.3
       │       │
       │       └── P2.1 (Governed Scoring) is prerequisite for P2.4 (Rating Band Governance)
       │
       └── P1.4 (Individual E2E) is prerequisite for P3.4, P3.5 (SME/Corporate E2E)
```

---

## 15. Appendix: Baseline Observation Cross-Reference

| Baseline ID | Roadmap Item |
|---|---|
| CA-CS-001 | P1.5 |
| CA-CS-002 | P2.2, P2.3 |
| CA-CS-003 | P3.1, P3.2 |
| CA-CS-004 | P2.5 |
| CA-CS-005 | No remediation needed (confirmed implemented) |
| CA-CS-006 | P2.6 |
| CA-CS-007 | Acknowledged (governed model in P2.1) |
| CA-CS-008 | P2.1 |
| CA-CS-009 | P2.1 |
| CA-CS-010 | P2.1 |
| CA-CS-011 | P2.5 |
| CA-CS-012 | P2.4 |
| CA-CS-013 | P1.7 |
| CA-CS-014 | P2.3 |
| CA-CS-015 | P1.5 |
| CA-CS-016 | Acknowledged (SOD already implemented for score override) |
| CA-CS-017 | P1.1, P1.2 |
| CA-CS-018 | Acknowledged (audit trail is strong; P2.2 adds memo snapshot) |
| CA-CS-019 | P2.2, P1.8 |
| CA-CS-020 | P1.4, P3.4, P3.5 |
| CA-CS-021 | P2.7 |
| CA-CS-022 | Acknowledged (baseline confirms implementation depth) |
| CA-CS-023 | P0.1 |
| CA-CS-024 | P0.2 |
| CA-CS-025 | Acknowledged (breadth documented) |
| CA-CS-026 | P0.3 |
| CA-CS-027 | P0.3 |
| CA-CS-028 | P0.3 |
| CA-CS-029 | P4.1 |
| CA-CS-030 | P4.2 |
| CA-CS-031 | P0.4 |
| CA-CS-032 | P0.5 |