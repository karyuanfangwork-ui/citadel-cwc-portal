# ESM Credit LOS — Data Model

**Source:** `backend/prisma/schema.prisma` (6,954 lines; **210 models, 104 enums** total). This doc covers the **credit domain only** (~80 models), which spans schema lines **3438–6954** (service-desk / HR / CRM models at lines 18–3437 are excluded except where they are direct FKs of credit models).

**Conventions to know:**
- Enums (`ApplicationState`, `FacilityType`, `RiskRating`, `CommitteeVoteChoice`, `DisbursementStatus`, etc.) are Prisma enums — **single source of truth**. Import from `@prisma/client`, never re-declare (see warning in `credit.types.ts`).
- Many entities use **soft delete** (`deletedAt`); query with `deletedAt: null`.
- Table names are consistently snake_case (`@@map`), UUID PKs with `@db.Uuid` are standard.
- Line numbers are from the schema (they can shift with migrations).

---

## 1. God-models (treat with care)

| Model | Line | Fields | Relations | Notes |
|---|---|---|---|---|
| `CreditApplication` | 4506 | ~107 | ~48 | **Central aggregate.** 20-state lifecycle, product, lane, rating, CA-memo fields, LOO, sign-offs; ~40 child relation arrays (facilities, documents, auditEvents, scoreRuns, decisions, recommendations, conditions, memoVersions, committeeAgendaItems, covenants, payments, warningSignals, riskAssessments, deviations, comments, ...) |
| `BorrowerProfile` | 4055 | ~79 | ~24 | Central borrower aggregate; 1:1 credit extension of `CrmAccount`/`CrmContact` |
| `User` | 79 | ~163 | ~110 | Platform-wide identity; many named relations back to credit models (Rm/Analyst/MemoLockedBy/etc.) |

These aggregate most of the module. Changes here ripple widely.

---

## 2. Data-model domains (~80 credit models)

### (a) Borrower & parties
| Model | Line | Purpose / key FKs |
|---|---|---|
| `BorrowerProfile` | 4055 | Borrower master (type/segment/lifecycle, risk rating, exposure, encrypted PII) |
| `BorrowerCreditProfile` | 4194 | Borrower-360 aggregate credit snapshot (score, DSR); `borrowerId` unique |
| `BorrowerIncome` | 4213 | Income & commitment profile; `borrowerId` unique |
| `BorrowerBureauReport` | 4235 | Uploaded bureau report (CTOS/CCRIS PDF); children: `BorrowerBureauFacility` |
| `BorrowerBureauFacility` | 4255 | Facilities within a bureau report |
| `BorrowerActivity` | 4270 | Borrower-360 activity log |
| `BorrowerRiskRun` | 4285 | Borrower-level scorecard run (pre-application, immutable) |
| `FatcaCrsDeclaration` | 4322 | FATCA/CRS tax declaration |
| `Director` | 4348 | Corporate director |
| `Shareholder` | 4380 | Corporate shareholder |
| `UltimateBeneficialOwner` | 4410 | UBO |
| `RelatedPartyGroup` / `RelatedPartyMember` | 4434/4448 | Connected-party/common-ownership group + membership |
| `ConsentRecord` | 3915 | PDPA consent per subject/purpose (P1-2) |
| `BorrowerDuplicateException` | 6924 | Duplicate-borrower exception register (LOS-017) |
| `AmlRescreenEvent` | 3764 | Quarterly AML re-screen log |
| `SuspiciousTransaction` + `StrAttachment` | 3798/3828 | STR register (P1-7) + attachments |

### (b) Application & facilities
| Model | Line | Purpose / key FKs |
|---|---|---|
| `CreditAppCounter` | 3438 | Atomic application-number sequence (`CA-…`) |
| `CreditApplication` | 4506 | **God-model / central aggregate** (see §1) |
| `CreditApplicationDraft` | 4665 | Durable wizard state per user |
| `BorrowerOnboardingRun` | 4675 | Idempotent onboarding run |
| `ApplicationFacility` | 4691 | Requested facility (amounts, tenor, rate, Islamic variants, SME lane config) |
| `RequestItem` | 4777 | CA Memo §3 request items (renewal/variation/policy-breach/SICR) |
| `PricingWorksheet` | 4750 | Loan-pricing engine output (§2.1); `facilityId` unique |
| `ExposureSummary` | 4798 | Grouped secured/unsecured exposure |
| `Branch` | 4473 | Multi-branch reference (also config data) |

### (c) Collateral & guarantees
| Model | Line | Purpose / key FKs |
|---|---|---|
| `Collateral` | 5216 | Security for a facility; dual valuation, haircut inputs; **rich soft-delete** (`softDeletedAt/ById/Reason`) |
| `CollateralHaircutConfig` | 5262 | Haircut % by security category (P1-4) |
| `CollateralApplicationLink` | 5276 | Cross-application collateral sharing |
| `CollateralValuation` | 5293 | Valuation snapshot history |
| `CollateralLien` | 5311 | Liens/charges |
| `InsuranceCover` | 5330 | Insurance policy on collateral |
| `Guarantee` | 5352 | Guarantee on a facility; capacity + related-party checks (P1-5) |

### (d) Credit assessment / risk / scoring
| Model | Line | Purpose |
|---|---|---|
| `ExternalRating` | 4825 | Agency rating |
| `EclSnapshot` / `EclForecast` | 4846/4872 | ECL snapshot + Y1/Y2/Y3 forecast |
| `CashflowProjection` / `ProjectionLineItem` | 4893/4905 | Cash-flow projection |
| `SensitivityScenario` | 4925 | Stress scenario metrics |
| `FinancialStatement` / `FinancialLineItem` / `FinancialRatio` | 5706/5748/5771 | Borrower BS/PL/CF statements + line items + ratios |
| `AccountProfitability` / `ProfitabilityLine` | 5385/5400 | Profitability report |
| `WalletShare` | 5423 | Wallet share per facility type |
| `KeyCounterparty` | 5446 | Supplier/buyer/competitor counterparty |
| `AccountUtilisationSnapshot` | 5471 | Monthly account utilisation |
| `QualitativeAssessment` | 6022 | Qualitative scores (management/relationship/industry/collateral) |
| `RetailIncome` | 6043 | Individual borrower DSR assessment (gross + net) |
| `IndustryAssessment` | 6514 | Sector outlook |
| `RiskAssessment` | 6556 | Risk category assessment + weighted risk engine |
| `RiskFactorMatrix` | 6539 | Configurable weighted risk factors |
| `RmdIssue` | 6583 | RMD issue log |
| `EsgAssessment` | 6602 | ESG assessment |
| `SicrAssessment` | 6621 | SICR trigger assessment (corporate committee gate) |
| `ApplicationSignoff` | 6643 | Prepared/Reviewed/Concurred sign-offs |
| `CreditScorecard` / `CreditScorecardVersion` | 5798/5916 | Scoring model + versioned factor-weights snapshot |
| `ScoreFactorDefinition` | 5821 | Governed factor definitions, effective-dated + successor chain |
| `RatingBandConfig` | 5884 | Score→rating band config, versioned + governed |
| `CreditScoreRun` | 5943 | Result of scoring an application (factor scores, rating, overrides, provenance) |
| `ApplicationAssessmentResult` | 5988 | **Frozen governed record** populated at committee submission |

### (e) Committee & approvals
| Model | Line | Purpose / key FKs |
|---|---|---|
| `CommitteeMeeting` / `CommitteeMember` / `CommitteeAgendaItem` / `CommitteeVote` | 6112/6129/6146/6167 | Meetings, members/attendance, agenda, votes (quorum) |
| `CreditDecision` | 5501 | Approval/rejection decision record; `conditionRecords`→Condition |
| `CreditRecommendation` | 5530 | Analyst recommendation; submitted records **immutable + superseded** |
| `CreditApprovalMatrix` / `CreditApprovalMatrixVersion` | 5648/5684 | Authority levels by exposure & risk rating + snapshot |
| `DeviationApproval` | 3876 | Policy deviation/exception register (P1-6) |
| `ScoreOverrideApproval` | 6339 | Dual-approval for score overrides ≥2 notches |

### (f) Conditions & disbursement
| Model | Line | Purpose / key FKs |
|---|---|---|
| `Condition` | 5569 | Precedent/subsequent condition with fulfilment & waiver |
| `DisbursementOrder` | 5612 | Disbursement lifecycle control (create→approve→disburse) |

### (g) Monitoring & early warning
| Model | Line | Purpose |
|---|---|---|
| `FacilityHealth` | 6187 | Health status & review cadence |
| `CovenantDefinition` / `CovenantTest` | 6208/6229 | Covenant definition + test result (breach → EWS) |
| `PaymentEvent` | 6248 | Payment due/paid status (aging) |
| `EarlyWarningSignal` | 6266 | EWS with FK-based dedup to covenant/condition |

### (h) Documents
| Model | Line | Purpose / key FKs |
|---|---|---|
| `CreditDocument` | 4970 | Document with classification, sha256, AV scan, verification |
| `CreditDocumentVersion` | 5015 | Replacement version tracking |
| `DocumentRequirement` | 5037 | Per-application doc checklist |

### (i) SLA & policy / rules
| Model | Line | Purpose / key FKs |
|---|---|---|
| `CreditSlaPolicy` / `CreditSlaPolicyBranchOverride` / `CreditSlaBreach` | 5155/4492/5189 | SLA target state/hours/escalation + branch overrides + breaches |
| `CreditPolicyLimit` | 3852 | Exposure/concentration limit |
| `CreditPolicyParameter` | 5060 | Generic keyed policy params, scoped by product/lane/borrower |
| `CreditRuleConfig` | 5086 | Required-document / required-field rules |

### (j) Audit & security
| Model | Line | Purpose / key FKs |
|---|---|---|
| `CreditAuditEvent` | 5119 | **Append-only audit trail with hash-chain + sequence** (LOS-013) |
| `PiiReadLog` | 6297 | PII read-access log |
| `CreditExportEvent` | 6317 | CSV/PDF export DLP log |
| `CreditMemoVersion` | 5859 | **Immutable versioned memo snapshot**, lockable |
| `ApplicationComment` | 6784 | Collaboration thread (P2-4) |

### (k) Config / reference data
`Branch` (4473), `CreditFxRate` (6765, unique currency+effectiveDate), `RatingBandConfig`, `RiskFactorMatrix`, `CollateralHaircutConfig`, `SchedulerConfig` (6664, credit jobs).

---

## 3. Key enums used by credit models (defined in schema)

| Enum | Used by |
|---|---|
| `ApplicationState` (3447) | CreditApplication.state — 19 states (DRAFT…CLOSED/WITHDRAWN/REFERRED_BACK) |
| `BorrowerType` / `BorrowerSegment` / `BorrowerLifecycleStatus` (3470/3477/3483) | BorrowerProfile |
| `ProcessingLane` (3490) | CreditApplication.lane (PERSONAL_FAST / SME / CORPORATE) |
| `RiskRating` (3504) | BorrowerProfile, CreditApplication, BorrowerRiskRun, CreditScoreRun, CreditApprovalMatrix, RatingBandConfig (AAA…D, NR) |
| `AmlRiskTier` (3519) | BorrowerProfile |
| `ApplicationType` (3528) | CreditApplication (NEW / ADDITIONAL / RENEWAL / VARIATION) |
| `AccountClassification` (3539) | CreditApplication, SicrAssessment (BNM-aligned, PERFORMING…IMPAIRED) |
| `CreditProductType` (3554) | CreditApplication, CreditScorecard, CreditPolicyParameter, CreditRuleConfig |
| `FacilityType` (3566) | ApplicationFacility (incl. Islamic RWC_I/LC_I/BG_I/ICMTD_I/CASHLINE) |
| `SecurityCategory` (3583) | Collateral, CollateralHaircutConfig |
| `CounterpartyRole` (3594) | KeyCounterparty |
| `MfrsStage` (3601) | EclSnapshot, EclForecast |
| `DocumentClass` (3631) | CreditDocument, DocumentRequirement, CreditRuleConfig |
| `CovenantType` / `CovenantFrequency` (3662/3994) | CovenantDefinition, FacilityHealth |
| `ConditionType` / `ConditionCategory` / `ConditionStatus` (3674/3680/3689) | Condition |
| `ApprovalDecisionType` (3697) | CreditDecision |
| `RejectionReasonCode` (3707) | CreditApplication |
| `ConsentPurpose` / `ConsentStatus` (3736/3743) | ConsentRecord |
| `CommitteeVoteChoice` (6100) | CommitteeVote (APPROVE/REJECT/ABSTAIN) |
| `EarlyWarningSeverity` (3952) | EarlyWarningSignal |
| `HealthStatus` (3960) | FacilityHealth |
| `DisbursementStatus` (3967) | DisbursementOrder |
| `PaymentStatus` (3974) | PaymentEvent |
| `SignalType` (3982) | EarlyWarningSignal |
| `FinancialStatementType` / `FinancialPeriod` / `FinancialStatus` / `RatioCategory` (4016/4023/4029/4036) | FinancialStatement, FinancialRatio |
| `BaseRateType` (4742) | PricingWorksheet (BLR/OPR/FIXED/SORA/KLIBOR) |
| `CommitteeMeetingStatus` / `CommitteeMemberRole` / `CommitteeAttendance` (6076/6088/6094) | Committee models |
| `BureauProvider` (6391) | CreditBureauCheck — **CCRIS is historical-only** (non-bank lender, no live CCRIS) |
| `RiskCategory` (6405) | RiskAssessment |
| `EsgGuidingPrinciple` / `EsgCategory` (6413/6421) | EsgAssessment |
| `SicrTriggerType` (6430) | SicrAssessment |
| `SignoffRole` (6437) | ApplicationSignoff |
| `ScoreOverrideStatus` (6374) | ScoreOverrideApproval |
| `RepaymentType` / `RepaymentFrequency` (6869/6877) | ApplicationFacility |
| `DuplicateExceptionStatus` (6916) | BorrowerDuplicateException |
| `CurrencyCode` (4001) | CreditApplication, FinancialStatement |

> `FacilityType` Phase-2 (Islamic) variants are hidden behind a feature flag; Phase-1 types are the default dropdown set.

---

## 4. Integrity invariants to preserve

- **Audit chain (`CreditAuditEvent`, 5119):** append-only; SHA-256 `hash` + `hashVersion`; **`sequence` is the ordering key (not `createdAt`, which is ms-precision)** — `@@unique([applicationId, sequence])` enforces a single predecessor. FK to application has **`onDelete: Restrict`** — an application with audit events cannot be deleted. Never rewrite or delete audit records.
- **CA memo versioning (`CreditMemoVersion`, 5859):** immutable snapshots; `isLocked/lockedAt/lockedBy` — on committee submission the latest version is locked and cannot be regenerated.
- **Frozen assessment (`ApplicationAssessmentResult`, 5988):** `status FROZEN|SUPERSEDED` + `version`; populated at committee submission; later input changes do **not** mutate it.
- **Immutable recommendations (`CreditRecommendation`, 5530):** submitted records are immutable; a newer one supersedes the prior (self-FK `RecommendationSuccession`).
- **Version snapshots:** `CreditApprovalMatrixVersion`, `CreditScorecardVersion`, `RatingBandConfig` carry JSON snapshots for audit trail.
- **Factor governance (`ScoreFactorDefinition`, 5821):** effective-dated succession chain (`predecessorId` self-FK), `@@unique([factorKey, effectiveFrom])`.
- **Document evidence retention:** documents backing a decision (from `APPROVED`/`OFFER`/`ACCEPTED` onward) cannot be deleted (enforced in `stateGuard.util.ts`); corrections are new versions.
- **Soft delete:** `deletedAt` on `BorrowerProfile`, `CreditApplication`, `ApplicationFacility`, `CreditDocument`, `FinancialStatement`; `Collateral` uses a richer `softDeletedAt/ById/Reason` set (P1-4, replaces hard delete for audit). Query with `deletedAt: null`.
- **PII encryption at rest (AES-256-GCM):** `BorrowerProfile.annualIncomeEncrypted/netWorthEncrypted/sourceOfWealthEncrypted`; `Director/Shareholder/UltimateBeneficialOwner.nricPassportEncrypted + nricPassportHmac`; `FatcaCrsDeclaration.usTinEncrypted`.
- **Canonical dedup forms (LOS-017):** `BorrowerProfile.registrationNumberNormalized` / `nricPassportNormalized` — maintained by the service, never set by clients.
- **Optimistic concurrency:** `CreditApplication.version Int default(1)` — incremented on every update/transition; race-safe state writes use `updateMany WHERE state` guards (409).
- **Denormalised exposure:** `BorrowerProfile` exposure kept in lockstep with canonical `computeBorrowerExposure()` (G-09) — transitions into/out of exposure states trigger a refresh.
- **Consent immutability:** `ConsentRecord` unique on `(subjectId, subjectType, purpose, status)` — one active consent per purpose.

---

## 5. Working with the schema

- Migrations: `cd backend && npx prisma migrate dev` (local) — never destructive commands in production.
- After schema changes: `npm run prisma:generate` then regenerate client.
- Seed reference data (scorecards, rating bands, policy limits, SLA policies, rule config) via `npm run prisma:seed`.
- Design markers preserved in the schema: CA Memo Phases 1–5 map fields to memo sections 1–19; `ProcessingLane` and SME statement classification drive lane routing and approval depth; BNM alignment notes state Citadel does **not** pull live CCRIS (non-bank lender).
