# Gap and Risk Register

Effort bands: XS ≤1 day, S 2–3 days, M 4–10 days, L 2–4 weeks. Estimates include focused automated tests, not organizational policy approval.

| Gap ID | Area | Journey | Current Behaviour | Expected Behaviour | Repository Evidence | User Impact | Credit/Operational Risk | Severity | Recommended Resolution | Existing Capability Reusable? | Estimated Effort | Priority | Dependencies |
|---|---|---|---|---|---|---|---|---|---|---|---:|---|---|
|| LOS-001 | Approval workflow | Assessment → committee | RESOLVED: Approval actions now restricted to COMMITTEE_REVIEW only; the canonical `submit_to_committee` transition is the sole entry point. | Only canonical transition may enter committee after readiness, freeze and memo lock. | `approvalAction.service.ts`; `creditApplication.service.ts` | Incomplete cases can appear approval-ready. | Approval without validated/frozen basis. | Critical | Reject approval actions before `COMMITTEE_REVIEW` or route all advancement through one transactional orchestration command. | Yes—readiness, freeze, memo lock | M | P0 — CLOSED 2026-08-08 | LOS-005, LOS-009 |
|| LOS-002 | Approval authority | Rating → authority | RESOLVED: Comparator corrected from `<=` to `>=`; C/D/NR now correctly require committee/board authority; AAA–CCC below RM5M no longer over-restricted. | Adverse grades at or beyond CC must require committee/board. | `approvalAction.service.ts`; `approvalMatrix.service.ts` | Wrong approval level displayed/enforced. | Worst risk may be under-approved. | Critical | Correct ordinal comparison, add boundary tests for AAA/CC/C/D and exposure combinations. | Yes | S | P0 — CLOSED 2026-08-08 | Approval policy confirmation |
|| LOS-003 | RBAC/config | Score/rating config | Rating-band/risk-factor POST/PATCH/seed routes require authentication only. RESOLVED: mutation routes now require credit:admin. | Only authorized admin with MFA/governance may mutate. | `ratingBandConfig.routes.ts` | Ordinary staff can alter methodology. | Systemic score/rating manipulation. | Critical | Add `credit:admin` and MFA where used for scorecard changes; route through governed lifecycle service. | Yes—permissions/MFA/lifecycle | S | P0 — CLOSED 2026-08-08 | LOS-010 |
|| LOS-004 | Row-level security | Search/read application | Lists are RM-scoped; direct detail fetch ignores scope. Borrower-filter query broadens scope. RESOLVED: requireApplicationAccess() mounted at /applications/:applicationId; borrower query broadening removed. | Same row policy on list, detail and every nested resource. | `rmScope.middleware.ts`; controller `getOne`; service `getApplication` | Restricted borrower data can be viewed by guessed/known UUID. | Confidentiality breach and unauthorized review. | Critical | Centralize application access assertion and require it for all application/nested routes; remove borrower query broadening. | Yes—scope/access middleware | M | P0 — CLOSED 2026-08-08 | Data-access policy |
|| LOS-005 | Recommendation | Assessment → submit | RESOLVED: Recommendation frontend API client and Application 360 section now live; analysts can draft, validate, submit and view recommendations in the Approvals tab. | Analyst can draft, validate, submit and view recommendation in Application 360. | `creditRecommendation.service.ts/routes`; `creditRecommendationApi`; `RecommendationSection.tsx`; readiness | Normal browser flow cannot reach committee. | Staff may seek bypass path or use direct API. | Critical | Connect existing entity/routes to a lane-aware section; show status and validation in readiness/pack. | Yes | M | P0 — CLOSED 2026-08-08 | LOS-009 |
| LOS-006 | Financial integrity | Financial review → decision | RESOLVED: Governance fields (status, reviewedById) removed from generic PATCH; statement status guard blocks line-item edits on REVIEWED/APPROVED statements; amendments must create a new statement. | Only draft lines editable; review endpoint owns status; amendments create a new version. | `financial.routes.ts`, validator and service | Approved figures can silently drift. | Score/memo/decision no longer match source evidence. | Critical | Remove governance fields from generic PATCH; enforce statement status on line mutations; supersede/version amendments. | Yes—status workflow/recalc | M | P0 — CLOSED 2026-08-08 | Data migration policy |
| LOS-007 | Document integrity | Evidence → approval | RESOLVED: Replace and delete now gated behind EDITABLE/DELETABLE states; APPROVED/OFFER/ACCEPTED documents are immutable; UI hides delete button in post-decision states. | Frozen decision documents immutable; replacement/deletion triggers controlled supersession/reapproval. | `creditDocument.service.ts`; `stateGuard.util.ts` | Approved supporting evidence can disappear/change. | Decision unsupported by retained evidence. | Critical | Apply state guard to replace/verify/delete and bind memo/freeze to document version hashes. | Yes—versions/hashes/freeze | M | P0 — CLOSED 2026-08-08 | Retention policy |
|| LOS-008 | Scoring override | Rating override | RESOLVED: One governed override path; scoreRunId persisted; originalRating derived server-side; direct route returns 410 Gone; justification mandatory (≥20 chars). | One server-derived, permission-verified, linked, atomic workflow. | `scoreOverride.service.ts`; `scoring.service.ts` | Override may be inert or falsely attributed. | Unauthorized/untraceable rating change. | Critical | Consolidate flows; derive current run/rating; mandate reason; record actual approver action; update run/application/freeze atomically. | Yes—models/audit/SOD | L | P0 — CLOSED 2026-08-08 | Policy decision |
|| LOS-009 | Audit atomicity | Submit/score/approve | RESOLVED: All critical business mutations now commit with their audit event in a single `$transaction`; `pg_advisory_xact_lock` serializes concurrent appends per application. 54 call sites inventoried; 31 now pass `tx`; remaining 23 are audit-only or informational (SOD middleware, download logs, delegation recording, evidence mapping). | Critical mutation and audit event commit or roll back together. | approval, scoring, document and transition services | Error may be shown after action succeeded; retry ambiguity. | Missing decision evidence/double action. | High | Pass transaction client to audit append and include business mutation in same transaction; serialize per-application appends. | Yes—AuditChain transaction support | M | P0 — CLOSED 2026-08-09 | LOS-001 |
|| LOS-010 | Rating governance | Configure rating bands | RESOLVED: Lifecycle routes exposed (DRAFT→SUBMITTED→APPROVED→ACTIVE); only ACTIVE bands affect scoring; legacy CRUD guards DRAFT-only; approvedById no longer set on DRAFT creation. | Draft/submit/approve/activate lifecycle; only one effective active set. | `ratingBand.service.ts`; `ratingBandConfig.routes.ts` | Admin cannot tell what is truly effective. | Unapproved methodology affects outcomes. | Critical | Replace legacy mutation with service lifecycle; consume ACTIVE only; validate full coverage/no overlaps. | Yes | M | P0 — CLOSED 2026-08-08 | LOS-003 |
|| LOS-011 | Missing data | Calculate score/readiness | RESOLVED: BLOCK throws AppError(400); unconfigured factors default to PENALTY (25) not NEUTRAL (50); lane scope threaded through; cashflow defaults to BLOCK. | Approved policy must fail closed or apply explicit conservative penalty for essential evidence. | `missingDataPolicy.service.ts`; scoring/readiness | Incomplete file receives plausible score. | Repayment risk understated. | Critical | Configure BLOCK/PENALTY by lane/factor; hard-gate DSR/financial evidence; show treatment prominently. | Yes—policy engine | S–M | P0 — CLOSED 2026-08-08 | Credit policy approval |
|| LOS-012 | Approval UI | Management decision | RESOLVED: All approval surfaces now use a shared `validateApprovalDecision`/`buildApprovalPayload` contract; QuickView and Mobile Inbox include rejection reason code selector and route CONDITIONAL to full panel. | Every surface uses same validated decision command and fields. | `ApprovalChainPanel.tsx`, `ApprovalQuickView.tsx`, `MobileApprovalInbox.tsx` | Actions fail or behave inconsistently. | Wrong/undocumented decision route. | High | Reuse full decision form/schema; disable incomplete shortcuts until parity. | Yes | S | P0 — CLOSED 2026-08-08 | LOS-001 |
| LOS-013 | Audit chain | All critical events | RESOLVED: `pg_advisory_xact_lock` serializes concurrent appends per application within transactions; DB-level BEFORE UPDATE OR DELETE trigger raises `42501` regardless of role. Maintenance paths use `AuditChainService.withImmutabilityBypass` which sets a transaction-scoped GUC. | Serialized append-only chain with DB-enforced immutability. | `auditChain.service.ts`; migration `20260810090000` | Integrity verification may fork/fail. | Audit evidence challenged. | High | Per-application lock/sequence; DB trigger/privilege; scheduled verify and alert. | Yes | M | P1 — CLOSED 2026-08-10 | DBA deployment |
|| LOS-014 | Scoring provenance | Reproduce rating | RESOLVED: policyVersion (md5 hash of resolved missing-data policy) and ratingBandVersion (from ACTIVE band set) now persisted on every CreditScoreRun; replay regression test added. | Exact applied model/policy/band versions stored and replayable. | `CreditScoreRun`; scoring create data | Reviewer cannot reconstruct old result exactly. | Model-risk/audit finding. | High | Persist IDs/versions and add replay regression test. | Yes | S–M | P1 — CLOSED 2026-08-08 | LOS-010 |
| LOS-015 | Return workflow | Return → amend → resubmit | RESOLVED: `resume_committee` now passes the same readiness→freeze→memo gate as `submit_to_committee` (extracted to `committeeEntryGate.ts`); `GET /applications/:id/return-diff` derives what changed since last refer-back from the audit chain. | Mandatory reason, scoped amendment, before/after diff and renewed freeze. | `committeeEntryGate.ts`; `creditApplication.service.ts`; return-diff endpoint | Rework is unclear; reviewer repeats full review. | Unreviewed changes can slip through. | High | Mandate reason; derive diff from audit; always re-run readiness/freeze/memo on resume. | Yes—audit/versions | M | P1 — CLOSED 2026-08-10 | LOS-001, LOS-009 |
| LOS-016 | Management pack | Review → decision | Pack omits authored recommendation, factor explanation, missing inputs, overrides, exceptions and evidence index. | Existing pack summarizes complete frozen decision basis. | memo/pack services and UI | Excessive navigation; “why” is unclear. | Poorly informed approval. | High | Add existing stored data to current pack and anchors; display frozen version. | Yes | M | P1 | LOS-005, LOS-014 |
| LOS-017 | Duplicate borrower | Borrower create | Enhanced create check does not compare direct BorrowerProfile NRIC/registration values. | Server normalizes and uniquely checks identifiers regardless of CRM linkage. | `borrowerProfile.service.ts` | Duplicate customer records/exposure split. | Incomplete aggregate exposure and KYC history. | High | Normalize/hash identifier lookup; add conditional unique strategy and governed override. | Yes | M | P1 | Data cleanup |
| LOS-018 | Child concurrency | Assessment edits | RESOLVED: `assertVersionMatch` on financial statement, collateral, risk assessment and document edit endpoints compares `updatedAt` timestamps and returns 409 on stale writes; `expectedUpdatedAt` is optional for backward compatibility. | Detect conflicting edits and prevent last-write loss. | `optimisticConcurrency.ts`; service/validator changes | Analysts overwrite each other. | Incorrect assessment basis. | Medium | Add version/updatedAt preconditions for high-risk child mutations. | Yes | M | P1 — CLOSED 2026-08-10 | API contract |
|| LOS-019 | Return validation | Manager return | RESOLVED: Backend validator now requires ≥10-character comment for RETURN decisions, matching desktop panel enforcement. | Reason mandatory and audited for every return surface. | approval validator/panel | Blank return gives no remediation direction. | Delay and weak audit rationale. | High | Add backend minimum reason and tests. | Yes | XS | P1 — CLOSED 2026-08-08 | None |
| LOS-020 | Inbox | Management queue | RESOLVED: My Approvals now reads the authority- and SOD-filtered dashboard inbox; excluded applications are named with a reason in a collapsible disclosure section. | Authority/SOD-filtered backend inbox is single source. | `MyApprovals.tsx`; `dashboard.service.ts`; inbox tests | Noise and failed actions. | Operational mistakes/delay. | Medium | Connect page to existing inbox endpoint and explain ineligibility. | Yes | S | P1 — CLOSED 2026-08-10 | LOS-012 |
| LOS-021 | Integration | Final decision/disbursement | RESOLVED (record-only scope): `assertRecordOnlyAllowed` fails closed when `CREDIT_LIVE_LENDING=true` without a configured CBS/e-sign vendor; placeholder CBS identifiers are prefixed `SIMULATED-` with a `simulated: true` flag; disbursement screen carries a record-only banner; `getIntegrationsStatus` now reports CBS and e-sign alongside bureau/AML/OCR. | Production blocks functions requiring an unconfigured live adapter or clearly operates record-only. | `registry.ts`; `cbs.placeholder.ts`; `IntegrationModeBanner.tsx`; registry gating tests | Staff may mistake simulation for external completion. | Operational/financial mismatch. | Critical for live booking | Fail closed by capability; production deployment evidence for each adapter. | Yes—registry/status | M + external | P0 — CLOSED (record-only) 2026-08-10 | Vendor/configuration |
| LOS-022 | Test assurance | Whole journey | RESOLVED: Seeded P0 regression test (`npm run test:credit:p0`) attempts each former bypass and asserts it fails without data mutation; 6 Playwright browser specs cover analyst journey, committee entry gate, approval inbox exclusions, audit trail, committee approval, and unauthorised access. | Seeded, repeatable individual/SME/corporate/control E2E release suite. | `creditP0Regression.test.ts`; `frontend/e2e/credit/` | Defects emerge only during staff use. | Control-path regressions undetected. | High | Add focused browser/API tests from report 10; make DB service part of CI. | Yes—fixtures/tests | L | P1 — CLOSED 2026-08-10 | Stable test DB |
| LOS-023 | Joint applicants | Borrower/application create | Backend enum supports JOINT; main UI omits it. | Either explicitly unsupported/hidden by policy or fully mapped. | schema/validators vs creation UI | Ambiguous staff expectations. | Misclassification/manual workaround. | Medium | Confirm scope; document as unsupported or connect existing backend fields. | Partial | S–M | P2 | Product policy |
| LOS-024 | UX terminology | Borrower/application | SME is lane/sole proprietor while labels vary; risk/score/recommendation terms overlap. | Consistent labels with clear system versus analyst recommendation. | lane enums and UI sections | Training burden/misinterpretation. | Moderate operational error. | Medium | Standardize copy/tooltips using existing terminology map. | Yes | S | P2 | UX content review |
| LOS-025 | Build performance | Application UX | Frontend build emits dynamic/static import and large-bundle warnings. | Credit routes load predictably within operational targets. | Vite build output | Slower first load, especially mobile approval. | Availability/productivity rather than credit control. | Low | Measure route bundles and split only demonstrated hot spots. | Yes | M | DEFERRED | Performance baseline |

## Priority summary

- P0: None remaining for record-only scope. (LOS-001 through LOS-012, LOS-009 closed 2026-08-08/09; LOS-021 closed record-only 2026-08-10.)
- P1: LOS-013 through LOS-015, LOS-018, LOS-020, LOS-022 now CLOSED (2026-08-10). Remaining open: LOS-016 (management pack), LOS-017 (duplicate borrower).
- P2: LOS-023 and LOS-024.
- Deferred: LOS-025 until measured performance justifies change.

## Phase 2 behaviour changes for operations

- Approval decisions are now only possible in COMMITTEE_REVIEW. Applications
  must reach committee via the submit_to_committee transition, which validates
  readiness, freezes the assessment and locks the memo.
- The corrected board-band rule (LOS-002) changes routing in both directions:
  grades C, D and NR now correctly require committee/board authority, and
  grades AAA-CCC below RM5m are no longer forced to committee as they were
  under the inverted comparator. Expect visibly different authority levels on
  existing pipeline applications.
- Refer-back (RETURN) now requires a reason of at least 10 characters at the API,
  matching what the desktop panel already required.

### Phase 3

- Analysts must now draft and submit a credit recommendation (Application 360 →
  Approvals) before an application can be sent to committee. This gate already
  existed in the backend; Phase 3 made it reachable in the browser.
- A failed committee submission no longer leaves a frozen assessment behind.
- Financial statement `status` and `reviewedById` can only be changed through
  the review endpoint (credit:approve). Line items cannot be edited once the
  statement is past DRAFT/SUBMITTED — record amendments as a new statement.
- Documents can no longer be replaced or deleted once the application reaches
  APPROVED, OFFER or ACCEPTED. Post-decision corrections require a new version.

### Phase 4

- Rating overrides now go through POST /credit/score-overrides only. The direct
  POST /credit/score-runs/:id/override endpoint returns 410 Gone — it accepted the
  approver's identity from the request body, so it could not prove who approved.
- Approved dual-approval overrides now actually change the score run. They
  previously recorded as APPROVED and left the rating untouched.
- Override requests no longer accept `originalRating` (derived from the latest
  score run) and require a justification of at least 20 characters.
- "Material override" now means the same thing everywhere: notch distance is
  computed on the single RiskRating scale. Adjacent grades such as AAA->AA are one
  notch, where the old override scale counted two.
- Only an ACTIVE rating band set affects scoring. An APPROVED set must be
  explicitly activated. ACTIVE bands can no longer be edited in place.
- Missing core data no longer scores as neutral 50. A missing DSR blocks scoring
  by default; missing financial evidence applies a conservative penalty. All
  values are overridable per lane via CreditRuleConfig.
- Score runs record the rating band version and missing-data policy version used,
  so an old rating can be reproduced.

### Phase 5

- All critical business mutations (approval, scoring, disbursement, committee,
  document, risk assessment, recommendation, rating band, collateral, memo version,
  AML rescreen, pricing, LOO, bureau check, connected party, SLA, rejection) now
  commit with their audit event in a single `$transaction`. If either side fails,
  both roll back.
- `AuditChainService.appendEvent` acquires `pg_advisory_xact_lock` per application
  when called inside a transaction, preventing chain forks from concurrent requests.
- 54 total `appendEvent` call sites inventoried; 31 now pass `tx` and are atomic.
  The remaining 23 are audit-only or informational (SOD middleware, download logs,
  delegation recording, evidence mapping) — no paired business mutation.
- `creditRecommendation.service.ts`: `submitRecommendation` now includes audit
  inside its existing `$transaction`.
- `scorecard.service.ts`: no `appendEvent` calls (was a false positive in the plan).
- `requestScoreOverride` (single-approver direct override) remains non-transactional
  because it's a single Prisma call followed by a rating persist + audit. Future
  work should wrap it in `$transaction` for consistency.

### Phase 6

- `resume_committee` now passes the same readiness → freeze → memo-lock gate as
  `submit_to_committee`. The gate is extracted to `committeeEntryGate.ts` so a
  future transition into COMMITTEE_REVIEW cannot silently skip it.
- `credit_audit_events` is append-only at the database level: a BEFORE UPDATE OR
  DELETE trigger raises `42501` regardless of role. Maintenance paths use
  `AuditChainService.withImmutabilityBypass`, which sets a transaction-scoped GUC.
- Financial statement, collateral, risk assessment and document edits accept an
  `expectedUpdatedAt` concurrency token and return 409 on a stale write.
- `GET /credit/applications/:id/return-diff` derives what changed since the last
  refer-back from the audit chain — nothing extra is stored.
- My Approvals now reads the authority- and SOD-filtered dashboard inbox, and the
  inbox names every excluded application with a reason.
- Record-only scope is explicit: `assertRecordOnlyAllowed` fails closed if
  `CREDIT_LIVE_LENDING=true` without a configured CBS/e-sign vendor, placeholder
  CBS identifiers are prefixed `SIMULATED-`, and the disbursement screen carries
  a record-only banner.
- `npm run test:credit:p0` (backend) and `npm run test:e2e:credit` (frontend)
  constitute the go/no-go evidence suite.

## Follow-ups surfaced during Phase 6

- `verifyChain` should be called as a scheduled job (e.g., nightly) and on
  critical operations (e.g., before disbursement). This is an operational
  follow-up, not a code change.
- `requestScoreOverride` should be wrapped in `$transaction` for full consistency
  with the other atomic paths. This is a low-priority follow-up.
- LOS-016 (management pack completeness) and LOS-017 (duplicate borrower identity)
  remain open and should be picked up next.
- Live lending readiness: when the deployment transitions from record-only scope
  to real CBS/e-sign integration, LOS-021 reopens at P0 until vendor configuration
  is complete and `CREDIT_LIVE_LENDING` is enabled.
