# Credit Assessment Module — Comprehensive Enterprise Audit Report

**Date:** 2026-05-29
**Audit type:** Senior Product Auditor / Credit Risk Consultant / Business Analyst / UI-UX / Solution Architect / Internal Auditor / Enterprise Software Reviewer
**Scope:** Citadel CWC 2.0 — Credit Assessment Module (CAM)
**Auditor:** AI-assisted desk review (live codebase + 27 in-repo design docs)
**Branch reviewed:** `dev2.0`
**Codebase footprint at review:** 45 backend route modules (~180 endpoints), ~65 credit-specific Prisma models, ~40 enums, 24 frontend tabs, 8 dashboard widgets, 4 report packs

---

## 1. EXECUTIVE SUMMARY

The Credit Assessment Module is a **mature, near-production-ready corporate / SME credit lifecycle system** embedded in the CWC 2.0 platform. It implements the full sanction-to-monitoring chain — borrower onboarding, related-party capture, application workflow, financial spreading, scorecard execution, committee voting, collateral and guarantee tracking, conditions, covenants, payment monitoring, dashboards and regulatory-style reports — backed by a defensible data model, maker-checker controls, segregation of duties, and an immutable audit trail.

**Headline verdict: Strong design and breadth. The blocker between current state and "fit for live production sanctioning" is integration completeness (bureau / AML adapters), authentication hardening (MFA), and a small number of UX gaps in approver tools — not architectural rework.**

### Strengths
- 16-state deterministic workflow with maker-checker and SOD enforcement at every decision point.
- Versioned approval matrix and versioned scorecards — every sanction is reproducible.
- Field-level encryption (NRIC, passport) plus PII-read audit log.
- IFRS 9 staging (ECL snapshot, ECL forecast, SICR assessment) built into the data model.
- Committee workflow with quorum, voting, attendance and CA Memo generation.
- Comprehensive in-repo documentation (27 reference docs including framework, RACI, runbooks).

### Critical risks (must-fix before live sanctioning)
1. **Bureau adapters are placeholders** — CCRIS, CTOS and AML screening do not yet call live vendors (gated by `credit:bureau_checks` flag).
2. **No MFA / no session binding** — JWT + password only; unacceptable for users with `credit:approve` or `credit:admin`.
3. **No SLA auto-escalation** — SLA thresholds are defined but not enforced; aged-in-state items are not paged to a supervisor.
4. **No ongoing AML re-screening** — PEP / sanctions captured once at onboarding only.
5. **DLP / export controls absent** — CSV and PDF exports of exposure and approvals are not gated, watermarked, or audit-logged.
6. **Optimistic concurrency missing** — two analysts editing the same application can silently overwrite each other.

### Final scorecard (detail in §13)

| Dimension | Score | Band |
| --- | --- | --- |
| Business process coverage | 88 | Excellent |
| Credit risk controls | 78 | Good |
| Workflow design | 86 | Excellent |
| UI design | 72 | Good |
| UX (effort, journey) | 68 | Needs improvement |
| Data quality controls | 80 | Good |
| Security & compliance | 66 | Needs improvement |
| Reporting & BI | 70 | Good |
| Scalability | 78 | Good |
| Mobile readiness | 42 | Critical |
| **Composite (weighted)** | **74 / 100** | **Good** |

---

## 2. PHASE 1 — MODULE UNDERSTANDING

### 2.1 Business objective
Provide a defensible, auditable, end-to-end credit sanctioning and monitoring capability for corporate, SME and (optionally) individual borrowers — replacing spreadsheet-driven workflows with a controlled platform that produces consistent CA Memos, enforces approval authority, and feeds regulatory portfolio reporting.

### 2.2 Target users
Relationship Managers (RM), Credit Analysts, Credit Approvers, Risk Head / CRO, Committee Chair and Members, Compliance, Operations / Disbursement, Internal Audit, Executive Leadership (read-only dashboards).

### 2.3 User roles & permissions (from `17-rbac-verification-matrix.md`, verified in code)
- `credit:read` — Analyst-level view of apps, borrowers, reports
- `credit:write` — RM/Analyst create + edit, no decision authority
- `credit:approve` — Approve/reject, cast committee votes, approve financials
- `credit:admin` — Scorecard promotion, matrix changes, score overrides, disbursement
- SOD enforced: RM ≠ approver on same app; analyst ≠ committee voter on own deal; score creator ≠ override approver.

### 2.4 Credit assessment process (as implemented)
`DRAFT → SUBMITTED → KYC_REVIEW → KYC_APPROVED → UNDERWRITING → CREDIT_ASSESSMENT → COMMITTEE_REVIEW → APPROVED → OFFER → ACCEPTED → DISBURSED → ACTIVE → CLOSED` plus reject/withdraw side-paths. Each transition is logged to `CreditAuditEvent`.

### 2.5 Approval workflow
`CreditApprovalMatrix` lookup driven by `(exposure_band, risk_rating, connected_party_flag)` → returns `authorityLevel` and `requiredApproverCount`. Routes to either single approver or `CommitteeMeeting` with quorum + voting.

### 2.6 Credit scoring methodology
Champion/challenger model via `CreditScorecardVersion.factorWeights` (JSON). Factor groups: Financial Profitability / Leverage / Liquidity / Coverage; Industry; Management; Behavioural (bureau); Collateral. Output `0–100 composite → RiskRating (AAA…D)`. Overrides allowed but require `credit:admin` approval with documented reason — stored on `CreditScoreRun`.

### 2.7 Risk evaluation methodology
- **Quantitative:** scorecard, ratios, ECL snapshot/forecast (PD, LGD, MFRS stage)
- **Qualitative:** `RiskAssessment`, `IndustryAssessment`, `EsgAssessment`, `SicrAssessment`
- **Exposure:** `ExposureSummary` aggregating self / other apps / customer / related counterparty / group totals secured & unsecured

### 2.8 Integration points
CRM Account / Contact (1:1 link from `BorrowerProfile`), SSE notification stream, email (Resend), AI (OpenAI gpt-4o-mini, advisory only). Bureau, CBS, OCR, e-Sign and ClamAV are **placeholder adapters**.

### 2.9 Data sources
- Internal: financial statements (manually spread), CRM customer records, prior payment events, internal collateral valuations.
- External (planned): CCRIS, CTOS, Refinitiv / Dow Jones AML, panel valuer reports, audited financials (OCR).

### 2.10 Expected business outcomes
Sanction TAT reduction, defensible audit trail, regulator-ready portfolio reporting (BNM aligned `AccountClassification`), IFRS 9 alignment, reduced operational risk, eventual AI-assisted underwriting.

### 2.11 Missing / ambiguous requirements
| # | Gap | Type |
| --- | --- | --- |
| R1 | No documented SLA per state (only "≤ 5 days KYC" mentioned in design doc) | Ambiguous |
| R2 | No documented appeal / reconsideration path after `REJECTED` | Missing |
| R3 | No documented data-retention policy for `WITHDRAWN` / `LAPSED` applications | Missing |
| R4 | No documented borrower-self-service portal scope (in or out?) | Ambiguous |
| R5 | No documented signing authority for Islamic facility types (RWC_I, LC_I, BG_I, ICMTD_I) | Missing |
| R6 | "Connected-party" definition not codified (auto-detected vs analyst-flagged?) | Ambiguous |
| R7 | No documented operating model for parallel-run shadow stream (`credit:parallel_run_mode`) | Ambiguous |

---

## 3. PHASE 2 — FEATURE AUDIT

| # | Feature | Current state | Risk | Recommendation | Priority |
| --- | --- | --- | --- | --- | --- |
| F1 | Borrower profile + related parties (directors, shareholders, UBO) | Implemented; NRIC encrypted; PEP captured at UBO | Low | Add periodic PEP re-screening | High |
| F2 | Credit application lifecycle (16-state) | Implemented | Low | Document SLAs per state, enforce via cron | High |
| F3 | Facility CRUD with Islamic variants | Implemented | Low | Confirm Shariah sign-off path | Med |
| F4 | Document upload + verification | Implemented; SHA-256, MIME check, ClamAV placeholder | **Med** | Wire real ClamAV; add OCR for FS auto-extraction | High |
| F5 | Financial spreading + ratios + maker-checker | Implemented | Low | Add ratio visualisation in UI | Med |
| F6 | Scorecard versioning + score runs + overrides | Implemented; immutable versions | Low | Add challenger comparison report | Med |
| F7 | Approval matrix (versioned) | Implemented | Low | Add "what-if" simulator for matrix changes | Low |
| F8 | Committee meeting + quorum + voting | Implemented | Low | Mobile-friendly voting view | High |
| F9 | Collateral with valuation history, liens, insurance | Implemented; dual valuation (bank vs PMMD) | Low | Auto-alert on expiring insurance / valuation > 12m | Med |
| F10 | Guarantee with guarantor snapshot | Implemented | Low | Add cross-link to guarantor's other exposures | Med |
| F11 | Conditions (CP / CS) | Implemented | Low | Add fulfilment SLA + reminders | High |
| F12 | Covenant definition + testing | Implemented | Low | Auto-schedule next test from frequency | Med |
| F13 | Payment monitoring + delinquency buckets | Implemented | Low | Hook to CBS to remove manual entry | High |
| F14 | Early warning signals | Implemented; severity bands | **Med** | Add UI to acknowledge / resolve / assign owner | High |
| F15 | Facility health status | Implemented | Low | Auto-set next review date from frequency | Low |
| F16 | Bureau checks (CCRIS, CTOS, AML) | **Placeholder adapters** | **High** | Wire production vendor; add re-screening cadence | Critical |
| F17 | ECL snapshot + forecast (IFRS 9) | Implemented | Low | Validate calc against finance team model | High |
| F18 | SICR assessment | Implemented | Low | Auto-trigger from rating migration | Med |
| F19 | ESG scoring | Implemented (data captured) | Low | Calibrate weights with sustainability team | Low |
| F20 | CA Memo Phase 1–5 narrative fields + autosave | Implemented | Low | Add memo print preview button | High |
| F21 | Signoff workflow (prepared / reviewed / concurred) | Implemented | Low | Add e-sign attestation | Med |
| F22 | RMD issue log | Implemented | Low | Surface in dashboard widget | Low |
| F23 | Audit event log | Implemented | Low | Add export-with-redaction for internal audit | Med |
| F24 | Dashboard widgets (8 widgets) | Implemented | Low | Add CRO-focused concentration view | Med |
| F25 | Reports (Pipeline, Approvals, Exposure, Monitoring) | Implemented | **Med** | Add DLP gate + export audit log | High |
| F26 | Notifications (SSE + email) | Implemented | Low | Add SMS for critical breaches | Low |
| F27 | Feature flag admin | Implemented | Low | Add change-log of flag flips | Med |
| F28 | AI advisory (gpt-4o) | Implemented but gated | Low | Keep gated until Phase 9; add explainability layer first | High |

**Missing features**
- M1. Borrower self-service portal (document upload, status check).
- M2. Decision-letter / sanction-letter generator (currently CA Memo only).
- M3. Watchlist module for ad-hoc internal "do-not-lend" lists (separate from sanctions).
- M4. Exception register (policy deviations approved with rationale).
- M5. Limit utilisation real-time view (we capture monthly snapshots only).
- M6. Cross-collateral / cross-guarantee visual graph.
- M7. Renewal pipeline auto-creation (T-90 days before expiry).
- M8. Stress-testing harness across the portfolio (we have per-deal sensitivity only).

**Redundant / duplicate concerns**
- `FacilitiesTab.tsx` and `RequestsFacilitiesTab.tsx` overlap — consolidate to a single "Facilities" surface with a "Request type" filter.
- `EsgTab.tsx` and `SicrTab.tsx` could be combined into a single "Forward-looking risk" tab.
- Two financial entry surfaces (`PaymentCapabilityTab.tsx` for FS, `ProfitabilityWalletTab.tsx` for profitability) — should share a common Financials shell.

**Technical debt observed**
- `creditDemoSeed.ts` + `creditDemoSeed.ts.bak` co-exist — clean up.
- Multiple `seed-credit-*.ts` scripts — consolidate to a single seed orchestrator.
- Frontend tab page is a "single mega-page with tab switching" (per mapping) — risks bundle bloat; consider route-based code splitting.

---

## 4. PHASE 3 — CREDIT RISK ASSESSMENT AUDIT

### 4.1 What is well-controlled
- Rating scale AAA…D, NR with explicit mapping to IFRS 9 stages (`AAA–BBB → Stage 1`, `BB–B → Stage 2 if SICR`, `CCC–D → Stage 3`).
- Approval authority driven by **versioned** matrix — historical sanctions can be re-derived against the matrix that was in force on that date.
- Score overrides are **never silent**: `isOverride=true` requires `overrideReason`, `overrideApprovedById`, `overrideApprovedAt`. SOD enforced so the originator cannot self-approve.
- Maker-checker on financials: `enteredById` and `reviewedById` must differ before status moves to `APPROVED`.
- Committee voting captures individual `CommitteeVote` rows — reconstructable for audit.

### 4.2 Weaknesses & loopholes
| # | Weakness | Fraud / control risk | Recommendation |
| --- | --- | --- | --- |
| C1 | Bureau checks are placeholders | Cannot confirm CCRIS/CTOS standing — fabricated reports could pass review | Wire live bureau before any live sanction (block via `credit:bureau_checks` flag) |
| C2 | One-time PEP/sanctions screening | UBO can become a PEP after onboarding without detection | Quarterly re-screen job; surface results as `EarlyWarningSignal` |
| C3 | Collateral valuation freshness not enforced | Stale valuation could inflate cover ratio | Hard-block facility activation if valuation > 12 months; warn at 9 months |
| C4 | Insurance expiry not auto-monitored | Lapsed insurance reduces recovery in default | Cron checks `InsuranceCover.expiryDate`; raises signal at T-30 days |
| C5 | Exposure aggregation depends on `ExposureSummary` correctness; recomputed on demand only | Stale exposure can let approver under-call required authority | Recompute on any facility / decision change; flag dashboard if stale > 24 h |
| C6 | "Connected party" is a free-form flag | RM could miss/omit; matrix steps to higher tier are bypassed | Auto-detect via `RelatedPartyGroup` membership and force flag |
| C7 | Override audit lacks "before/after rating delta" search | Cannot easily report on aggressive overrides | Add report: overrides by user, by delta, by month |
| C8 | No four-eyes on borrower profile creation | Single user could create a fake borrower, then their colleague approves | Add maker-checker for `BorrowerProfile` (status DRAFT → VERIFIED) |
| C9 | No conflict-of-interest declaration on `CommitteeMember` | Member with personal interest can still vote | Add COI flag + force recusal | 
| C10 | Score override approval is single-eye (`credit:admin`) | A single admin can wave through any override | Require dual approval at delta > 2 notches |
| C11 | `requestedAmount` and `approvedAmount` both on `ApplicationFacility` — no enforced upper bound between them | RM-side amendment after approval could increase amount | Lock `approvedAmount` post `APPROVED` state; require new application for increases |

### 4.3 Risk categorisation consistency
Rating-to-PD and rating-to-stage mapping live in code — recommend extracting to a versioned `RatingCalibration` table so risk team can adjust without redeploy.

### 4.4 Manual dependency
- Financial statements are **manually keyed** — OCR auto-extraction is on roadmap.
- Payment events are **manually logged** — should flow from CBS post-disbursement.
- Connected-party detection relies on RM diligence — should be system-driven.

---

## 5. PHASE 4 — USER JOURNEY AUDIT

### 5.1 Current journey (Application Lifecycle, happy path)
1. RM navigates to Borrowers → searches → opens profile → creates Application → enters basic details (8 fields) → Save.
2. Open `/credit/applications/:id` → scroll across 24 tabs.
3. Fill Header / Background (tab 3) → Facilities (tab 4) → upload Documents (tab 5) → run Credit Checks (tab 6, placeholder) → Account Conduct (tab 7) → Financials (tab 8) → Collateral (tab 9) → Conditions (tab 10) → Counterparties (tab 11) → Risk Mitigators (tab 12) → Industry (tab 13) → Scoring (tab 14) → ESG / SICR (tab 15–16) → Approvals (tab 17) → Signoff (tab 18) → submit.
4. Approver opens Approvals tab → reviews → records decision.
5. Committee Secretary schedules meeting (separate page) → adds agenda → quorum check → vote → finalise.
6. Operations marks `OFFER` → `ACCEPTED` → `DISBURSED` → `ACTIVE`.

### 5.2 Click / effort estimate
- **DRAFT → SUBMITTED for typical SME deal:** ~ 60–80 clicks across 12 tabs.
- **Approver review:** ~ 15 clicks (dashboard inbox → app → 3–4 tabs → decision).
- **Committee meeting (3 deals, 5 members):** ~ 25 clicks for chair / secretary.

### 5.3 Pain points
| # | Pain | Severity |
| --- | --- | --- |
| P1 | 24 tabs in one page — no progress indicator, easy to miss a section | High |
| P2 | No "completeness checklist" before submit (system allows submit with empty mandatory narratives) | High |
| P3 | Two overlapping facility tabs (Facilities vs Requests-Facilities) — confusing | Med |
| P4 | No global save — autosave is per-field; users worry about lost work | Med |
| P5 | Approver must open multiple tabs to form a view — no consolidated "approval pack" preview | High |
| P6 | Committee voting only on desktop — chair sometimes mobile during meetings | High |
| P7 | Borrower contact must wait for RM to manually upload — no self-service | Med |
| P8 | No "duplicate borrower" warning at profile creation (CRM has it; CAM should reuse) | Med |
| P9 | Search across applications is by `applicationNo` only — no fuzzy name search | Med |
| P10 | Dashboard widgets do not deep-link to filtered application lists | Low |

### 5.4 Recommended journey (target)
- Replace 24-tab page with a **3-step wizard + a side rail of 6 grouped sections** (Borrower, Request, Risk, Mitigants, Decision, Monitoring).
- Add a **submission readiness panel** (real-time validation, "12 / 14 sections complete").
- Add a **"Approval Pack" PDF preview** (auto-generated CA Memo) so approvers see one document, not 24 tabs.
- Add a **mobile committee-voting view** (vote + see memo PDF + comment box).
- Add a **borrower portal** (upload docs, view status, accept offer).

### 5.5 Expected benefits
- Cut application prep clicks by ~ 40 %.
- Cut approver decision time by ~ 50 % (single pack vs tab navigation).
- Reduce "submitted with incomplete data" rate to near zero (hard-gate).
- Enable committee voting in transit (chair on phone).

---

## 6. PHASE 5 — UI / UX AUDIT

| Area | Observation | Score (1–10) |
| --- | --- | --- |
| Layout | Single-page tabbed shell, dense; some tabs scroll for several screens | 6 |
| Visual hierarchy | RiskBadge + StateBadge components give good colour cues; section headers inconsistent across tabs | 6 |
| Spacing | Acceptable; some tabs use tight tables that crowd at < 1280 px | 6 |
| Typography | Consistent (project-wide design system); some long-form narrative fields lack max-width — line lengths > 120 chars hurt readability | 7 |
| Colour usage | RiskBadge palette (AAA green → CCC+ red) is intuitive; check WCAG AA contrast on amber states | 7 |
| Readability | Tables (facilities, score factors, monitoring) need zebra striping + sticky headers | 6 |
| Accessibility | No documented accessibility audit; missing aria-labels on icon-only buttons in Approvals + Committee | 5 |
| Consistency | Inconsistent confirm-dialog patterns (some inline toast, some modal) | 6 |
| Responsiveness | Most tabs collapse acceptably on tablet; committee voting + scoring grid break < 768 px | 5 |
| Mobile readiness | Not a first-class target — see §11 | 4 |
| Form design | Autosave is good; missing inline validation summaries; required-field marking inconsistent | 6 |
| Validation messages | Server-side errors surface as toasts; field-level errors not always shown | 5 |
| Error handling | Failed API calls return a toast — no recovery / retry affordance | 5 |
| Confirmation messages | Approval / reject correctly show "are you sure"; some destructive actions (delete document) lack confirmation | 6 |
| Progress indicators | Missing on long operations (score run, memo generate, bureau check) | 5 |
| Dashboard usability | Widgets readable, but lack "drill-down" actions and configurable layout | 6 |

**Top UI fixes (highest ROI first)**
1. Add submission-readiness completeness panel (kills the #1 user complaint potential).
2. Add Approval Pack / CA Memo preview button in Approvals + Signoff tabs.
3. Sticky headers + zebra stripes on score factor, monitoring, exposure tables.
4. Loading + progress spinners on long-running calls (score run, memo gen).
5. ARIA labels + keyboard nav across icon-only buttons.
6. Consistent confirmation modal pattern across all destructive actions.
7. Configurable / pinnable dashboard widgets.

---

## 7. PHASE 6 — FORM DESIGN AUDIT

| Form | Strengths | Issues | Recommendation |
| --- | --- | --- | --- |
| Borrower Profile | Type-driven field set (Individual vs Corporate) | No duplicate detection; no inline SSM lookup; PEP captured only at UBO level (not director) | Add SSM lookup via CRM duplicate-detection adapter; capture PEP at director + shareholder too |
| Application Create | Minimal — good | No "load template" for repeat product types | Add Application Template (preset product, tenor, currency) |
| Facility Add | Enum-constrained | Rate / tenor inconsistent vs product type validation | Add product-type-aware validation matrix |
| Financial Statement Spread | Maker-checker, hierarchical line items | No "import from prior period" copy; no XBRL/CSV import | Add prior-period copy & template export; long-term: XBRL import |
| Scorecard Execution | Auto-populates from FS | No "what-if" sliders for factor inputs | Add what-if sandbox (read-only, does not persist) |
| Collateral Entry | Dual valuation (bank vs panel) | Inline edit lacks change-tracking on valuation | Force valuation history record on every value change |
| Guarantee Entry | Snapshots guarantor risk | No automatic alert if guarantor rating drops post-snapshot | Subscribe guarantee to guarantor rating-change event |
| Covenant Definition | Frequency + threshold | No formula validator (e.g., "DSCR ≥ 1.20") | Add expression parser + dry-run against latest FS |
| Committee Memo | Auto-generated | No section reorder; no analyst note vs official text separation | Add reorder + redaction draft mode |

**Cross-form issues**
- Required-field marking inconsistent (some `*`, some helper text, some none).
- Several free-form notes fields lack max-length — risks DB inflation and UX wrap problems.
- No autocomplete on RM / Analyst pickers — typing a user ID is the only option in some screens.
- Smart defaults underused (e.g., currency should default to borrower's home currency, tenor to product norm).

---

## 8. PHASE 7 — WORKFLOW AUDIT

### 8.1 Maker-checker — well implemented
Financials, scorecard versions, score overrides, collateral valuation overrides all enforce maker-checker. SOD middleware prevents same-user dual roles on a deal.

### 8.2 Multi-level approval — works but missing UX scaffolding
Matrix returns `requiredApproverCount`. Code supports multiple decisions; UI shows them as a list but lacks a "this approval needs 3 of 5 — 1 received" visual gauge.

### 8.3 Escalation rules — partial
- Matrix escalates by exposure / rating / connected-party at decision time.
- **No time-based escalation** (e.g., "if `KYC_REVIEW` > 5 days, page Compliance Head"). Roadmap item.

### 8.4 Delegation — missing
No "delegate my approvals while on leave" mechanism. Approvals can pile up unaddressed. High priority.

### 8.5 SLA controls — partial
SLA targets exist as design intent. No enforcement, no per-state countdown UI, no breach report.

### 8.6 Notifications — solid event coverage; weak preference control
11 notification topics defined. No per-user channel preference (email / SSE / SMS). No digest mode. No mute-by-borrower for noisy deals.

### 8.7 Approval bottleneck risks
- `credit:approve` and `credit:admin` users are a small set — single point of failure.
- Committee Secretary (manual scheduling) is a manual bottleneck — add auto-schedule based on agenda load.

### 8.8 SOD findings
| # | Issue | Severity |
| --- | --- | --- |
| W1 | No COI declaration on committee members | Med |
| W2 | Score override single-approver | Med |
| W3 | Disbursement and approval can be performed by the same `credit:admin` user | High |
| W4 | Borrower profile creator can also be the application's RM | Med |

### 8.9 Audit trail
`CreditAuditEvent` captures `(user, action, entityType, entityId, oldValues, newValues, timestamp)` via Prisma middleware. PII reads logged separately. Retention 7 years per design doc. **Verify retention is actually configured** (no evidence in code that retention enforcement runs).

### 8.10 Improved workflow design (target)
- Add **time-based escalation** (cron service per state with thresholds).
- Add **delegation table** (`UserDelegation: fromUserId, toUserId, validFrom, validTo, scope`).
- Add **dual approval on overrides** (Δ ≥ 2 notches).
- Split **disbursement permission** from `credit:admin` (`credit:disburse`).
- Add **committee COI declaration** before voting.
- Add **per-state SLA countdown** widget in Summary tab.

---

## 9. PHASE 8 — DASHBOARD AUDIT

### 9.1 Existing widgets (8)
Pipeline state counts, Approval inbox, Top borrowers by exposure, Sector breakdown, Rating distribution, Committee calendar, Portfolio health, Covenant compliance.

### 9.2 Strengths
Covers operational (pipeline, inbox) + portfolio (concentration, rating) + monitoring (health, covenant) dimensions. Refresh cadences are sensible (2–5 min for hot, daily for portfolio).

### 9.3 Weaknesses
- All-user one dashboard — no role-tuned layout.
- No drill-down (widgets do not link to filtered list views).
- No alert summary band (high-severity EWS, breached covenants).
- No SLA / aged-WIP widget.
- No "my pipeline" view for RM (single-user filter).

### 9.4 Missing KPIs
| Category | KPI |
| --- | --- |
| Operational | Average TAT per state; aged-WIP per state; throughput per RM / Analyst; first-time-approval rate; override frequency |
| Risk | Concentration by industry / geography / single borrower; rating migration matrix; PD-weighted exposure; Stage-2/Stage-3 trend; ECL coverage ratio; covenant breach rate; EWS open by severity; recovery rate |
| Management | Sanction TAT vs target; rework rate; reject rate by RM / Analyst; committee deferral rate; cost per sanction; pipeline value by stage |

### 9.5 Recommended dashboards
- **Executive (CRO / CEO):** PD-weighted portfolio exposure, concentration heatmap, Stage-2/3 trend, ECL coverage, top-10 watchlist, sanction TAT vs target.
- **Credit Analyst:** My pipeline, my open items, my overrides this quarter, my approvals waiting, FS spread queue.
- **Manager:** Team pipeline, aged-WIP, throughput, reject rate, override report, breached SLAs, upcoming committee load.

---

## 10. PHASE 9 — REPORTING AUDIT

### 10.1 Existing reports
Pipeline, Approvals (turnaround), Exposure, Monitoring — each CSV + PDF.

### 10.2 Strengths
Covers four core regulatory / management lenses; filterable; pagination-friendly.

### 10.3 Weaknesses
- No export audit log — cannot answer "who exported the full borrower list?"
- No watermarking on PDFs.
- No row-level redaction (NRIC) on exports.
- No scheduled / subscribed report delivery (email on cadence).
- Reports are tabular only — no visual portfolio analytics (trend lines, heatmaps).

### 10.4 Missing reports
| # | Report | Audience |
| --- | --- | --- |
| RP1 | Override analysis (by user, delta, month) | Risk Head, Audit |
| RP2 | Rating migration matrix (period-over-period) | CRO |
| RP3 | Concentration risk (industry / geography / single name) | CRO |
| RP4 | Covenant breach detail | Risk team |
| RP5 | IFRS 9 staging movement (Stage-1 → 2 → 3 flow) | Finance |
| RP6 | ECL roll-forward | Finance |
| RP7 | SLA breach (per state, per user) | Operations |
| RP8 | Bureau-vs-internal rating divergence | Risk Head |
| RP9 | Connected-party group exposure | CRO |
| RP10 | Collateral coverage trend | Risk team |

### 10.5 BI enhancements
- Stand up a read-replica + BI tool (Metabase / Superset) on the same Postgres so analysts can build ad-hoc — without bypassing PII controls (use a redacted view).
- Move heavy reports off the OLTP path.
- Establish a "report catalogue" page in-app.

---

## 11. PHASE 10 — SECURITY & COMPLIANCE AUDIT

| # | Area | Finding | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| S1 | Authentication | JWT + password only, no MFA, no session binding | **High** | Add TOTP / WebAuthn for `credit:approve` and `credit:admin`; bind session to device fingerprint |
| S2 | RBAC | Four well-scoped permissions; checked at route layer | Low | Add row-level access (RM can only see own portfolio unless `credit:admin`) |
| S3 | Field encryption | NRIC / Passport AES-256-GCM + HMAC; PII read logged | Low | Extend to `annualIncome`, `netWorth`, `sourceOfWealth`; add per-user-day read-rate alert |
| S4 | Audit trail | `CreditAuditEvent` via Prisma middleware; 7-year retention design | Low | Confirm retention job; test tamper-evidence (append-only? hash-chained?) |
| S5 | Approval logs | `CreditDecision` + `CommitteeVote` immutable | Low | Add chain-of-custody export for regulator | 
| S6 | Document storage | SHA-256 hash, ClamAV placeholder, signed URL 10 min expiry, version history | **Med** | Wire real ClamAV; encrypt at rest with KMS-managed key; restrict signed-URL geography |
| S7 | DLP / export controls | None | **High** | Log every export; redact NRIC; PDF watermark with user + timestamp; geo / IP restriction |
| S8 | AML ongoing screening | One-time only at onboarding | **High** | Quarterly cron + alert via `EarlyWarningSignal` |
| S9 | Data classification | Not documented | Med | Tag every Prisma field with classification (Public / Internal / Restricted / Secret) |
| S10 | Compliance — BNM / IFRS 9 | Data model aligns (BNM `AccountClassification`, MFRS stage); operational policies not audited here | Med | Engage compliance for parallel-run + go-live sign-off |
| S11 | PII handling | `piiReadLog.service.ts` captures reads; not surfaced to user / admin | Med | Add admin report; let users see who viewed their own data on request |
| S12 | API rate limiting | Generic middleware; no per-endpoint differentiation | Med | Stricter limits on bureau check, export, score override |
| S13 | Secret management | Not assessed in this audit | — | Confirm `.env` patterns + Vault / KMS use |
| S14 | Supplier risk | Bureau / AML adapters pending — vendor selection and DD outstanding | High | Complete vendor due diligence before live wiring |

---

## 12. PHASE 11 — MOBILE & RESPONSIVENESS AUDIT

| Device | Observation | Severity |
| --- | --- | --- |
| Desktop ≥ 1440 px | Primary target; works well | OK |
| Laptop 1280 px | Score factor + monitoring tables crowd | Low |
| Tablet 768–1024 px | Most tabs collapse; committee voting + scoring grid break | Med |
| Mobile 360–414 px | Not designed for; tab nav unusable; forms wrap badly | **High** |

### 12.1 Mobile-critical screens (must work)
1. Dashboard (read-only).
2. Approval inbox + decision action.
3. Committee voting (vote + see memo).
4. EWS / breach acknowledge.

### 12.2 Recommended fixes
- Stack tabs into a vertical accordion / drawer on < 1024 px.
- Build a dedicated mobile committee-voting view (single deal at a time, vote + comment + see memo PDF).
- Build a mobile approval card (one-tap APPROVE / REJECT / DEFER with comment).
- Touch-size all interactive elements ≥ 44 px.
- Performance: lazy-load tab payloads.

### 12.3 Touch & gesture
- No swipe affordances; not required v1 but expected on mobile-redesigned screens.

---

## 13. PHASE 12 — AI ENHANCEMENT OPPORTUNITIES

The design framework wisely states: *AI is advisory only; never authoritative at sanction stage.* All AI features must remain explainable, gated, and auditable.

| # | Opportunity | Business value | Complexity | Effort (person-weeks) | Priority |
| --- | --- | --- | --- | --- | --- |
| AI1 | **Document classification + key-field extraction** (OCR over uploaded FS, NRIC, board resolutions) | Cuts data-entry by 30–50 % | Med | 8–12 | High |
| AI2 | **Financial-statement spreader assist** (LLM proposes line-item mapping from OCR text → reviewer approves) | Cuts spreading time ~60 % | High | 12–16 | High |
| AI3 | **Credit risk prediction (challenger model)** alongside scorecard | Improves discrimination; supports model validation | High | 16–20 | Med |
| AI4 | **Approval recommendation** (memo summary + recommended decision + rationale, never auto-approves) | Faster approver review | Med | 6–10 | High |
| AI5 | **Document Q&A** ("what was the DSCR in FY24?" over uploaded FS) | Reduces approver time hunting through PDFs | Med | 6–8 | High |
| AI6 | **Customer risk alerts** (news + bureau drift + payment behaviour → narrative early-warning) | Earlier issue detection | Med | 8–12 | Med |
| AI7 | **Portfolio risk monitoring** (anomaly detection across exposures, concentration trends) | CRO visibility | High | 12–16 | Med |
| AI8 | **CA Memo narrative draft** (preamble, matters to highlight, transaction details) | Cuts memo prep time | Low | 4–6 | High |
| AI9 | **Bureau-result triage** (LLM scores match certainty across CCRIS / CTOS / AML hits) | Cuts false-positive review | Med | 6–8 | Med |
| AI10 | **Covenant breach drafter** (auto-draft borrower communication on breach detection) | Faster response | Low | 2–4 | Low |
| AI11 | **Industry / sector outlook synthesiser** | Frees analyst time | Med | 6–8 | Low |
| AI12 | **Anti-money-laundering narrative reviewer** (LLM reads UBO + source of funds + KYC docs → flags inconsistencies) | Improved AML quality | High | 12–16 | Med |

**Governance rules (already in code framework — reinforce)**
- Every AI output stored with `model_version`, `prompt_id`, `confidence`, `human_reviewed_by`, `human_reviewed_at`.
- Champion-challenger A/B for prediction models.
- Drift monitoring; model card per release.
- All AI features behind `credit:ai_advisory` flag and only enabled in Phase 9+.

---

## 14. PHASE 13 — FINAL SCORECARD

| Dimension | Score | Band | Notes |
| --- | --- | --- | --- |
| Business process coverage | 88 | Excellent | All sanction-to-monitoring stages covered |
| Credit risk controls | 78 | Good | Strong design; bureau / re-screening gaps drag score |
| Workflow design | 86 | Excellent | 16-state machine, maker-checker, SOD; time-based escalation missing |
| UI design | 72 | Good | Visual hierarchy OK; consistency + accessibility gaps |
| UX (effort, journey) | 68 | Needs improvement | 24-tab page is a usability tax; no submission-readiness gate |
| Data quality controls | 80 | Good | Maker-checker + validation present; OCR + duplicate detection missing |
| Security & compliance | 66 | Needs improvement | No MFA, no DLP, one-time AML, weak export control |
| Reporting & BI | 70 | Good | Four core reports; missing concentration / migration / SLA reports |
| Scalability | 78 | Good | Postgres + Express + Prisma — sensible; need durable job queue + read-replica for BI |
| Mobile readiness | 42 | Critical | Not a first-class target; committee voting + approver inbox urgently need it |
| **Composite (weighted)** | **74 / 100** | **Good (Action Required)** | — |

Weighting used: business process 10, risk controls 20, workflow 10, UI 5, UX 10, data quality 10, security 20, reporting 5, scalability 5, mobile 5.

---

## 15. RISK REGISTER

| # | Risk | Likelihood | Impact | Inherent | Mitigation | Owner | Residual |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R-01 | Live sanctioning without real bureau integration | High | Critical | Critical | Keep `credit:bureau_checks=false` until vendor live; block state transition `KYC_REVIEW → KYC_APPROVED` when flag off | CTO + CRO | Low |
| R-02 | Approver account compromise (no MFA) | Med | Critical | High | Add MFA for `credit:approve` / `credit:admin`; IP allow-list internal users | CISO | Low |
| R-03 | Stale PEP / sanctions data | High | High | High | Quarterly AML re-screen cron; EWS on hit | Compliance | Med |
| R-04 | Stale collateral valuation inflates LTV | Med | High | High | Hard-block on > 12-month valuation; warn at 9 months | Risk Ops | Low |
| R-05 | Concurrent edit data loss | Med | Med | Med | Add optimistic locking (`version` field) | Eng | Low |
| R-06 | Aged WIP / no SLA enforcement | High | Med | High | Add per-state SLA cron + escalation | Operations | Low |
| R-07 | Export of sensitive data without audit | High | High | High | Add export log, watermark, redaction | Compliance | Low |
| R-08 | Score override abuse by single admin | Low | High | Med | Dual approval at Δ ≥ 2 notches | Risk Head | Low |
| R-09 | Disbursement by same person who approved | Low | Critical | High | Split `credit:disburse` permission | Operations | Low |
| R-10 | Committee member COI not declared | Med | High | High | Add pre-vote COI attestation | Committee Secretary | Low |
| R-11 | Mobile-blind committee chair cannot vote in transit | Med | Med | Med | Build mobile voting view | Eng | Low |
| R-12 | Audit log tamper risk | Low | Critical | Med | Add hash-chain / append-only WAL | Eng + Audit | Low |
| R-13 | Bureau adapter vendor lock-in / outage | Med | High | High | Adapter registry already supports swap; add circuit breaker + fallback | Eng | Med |
| R-14 | AI hallucination in advisory features | Med | High | High | Keep advisory-only; require human review + confidence display | Risk + AI Lead | Low |
| R-15 | BNM / IFRS 9 calculation drift vs finance team model | Med | High | High | Parallel run with finance team for one quarter | Finance | Low |

---

## 16. QUICK WINS (≤ 4 weeks)

1. **Submission readiness panel** — completeness gauge + hard-gate on `DRAFT → SUBMITTED`.
2. **Connected-party auto-flag** — derive from `RelatedPartyGroup`; remove free-form risk.
3. **Collateral valuation freshness alert** — cron + EWS at 9 months, hard-block at 12.
4. **Insurance expiry alert** — cron + EWS at T-30 days.
5. **Export audit log** — log every CSV / PDF export with user, filter, row count.
6. **Confirmation modal consistency** — single shared component across destructive actions.
7. **Sticky table headers + zebra striping** — score factors, monitoring, exposure.
8. **Split `credit:disburse`** out of `credit:admin`.
9. **Delete `creditDemoSeed.ts.bak`**; consolidate `seed-credit-*.ts` scripts.
10. **Add CA Memo "preview" button** in Approvals and Signoff tabs.
11. **Dual approval on score override Δ ≥ 2 notches** — backend check + UI flow.
12. **Audit-log retention job** — confirm the 7-year retention task actually runs.

---

## 17. MEDIUM-TERM IMPROVEMENTS (1–3 months)

1. **MFA / WebAuthn** for `credit:approve` and `credit:admin`.
2. **Time-based SLA escalation** per state with email + SSE alert.
3. **Delegation table** for out-of-office approval routing.
4. **OCR pipeline** (Textract) for FS, NRIC, board resolutions.
5. **Ongoing AML re-screening** quarterly cron.
6. **Optimistic concurrency** on `CreditApplication` + child entities.
7. **Mobile committee voting view** + mobile approval card.
8. **Approval Pack (CA Memo) PDF preview** integrated into Approvals tab.
9. **Override analysis report** + dual approval workflow.
10. **Row-level access** — RM sees own portfolio unless elevated.
11. **DLP on exports** — watermark + redaction + IP gate.
12. **Read-replica + Metabase** for BI offload.
13. **Per-user notification channel preference** + digest mode.

---

## 18. LONG-TERM ROADMAP (3–12 months)

1. **Borrower self-service portal** (upload, status, accept offer).
2. **Production bureau adapter wiring** (CCRIS, CTOS, Refinitiv).
3. **e-Sign adapter** (DocuSign / Adobe Sign) for offer + condition signoff.
4. **Durable job queue** (BullMQ) replacing cron; visible + retriable.
5. **Real-time CBS integration** for limit utilisation + payment events.
6. **AI advisory layer** (gated, behind `credit:ai_advisory` flag) — start with AI8 (memo drafter) and AI4 (approval recommendation).
7. **Challenger predictive model** alongside scorecard, with champion-challenger reporting.
8. **Stress-testing harness** at portfolio level.
9. **Islamic product sign-off path** (Shariah committee workflow variant).
10. **Open-banking / payment-aggregator** integration for cash-flow underwriting.
11. **Configurable dashboards** (per-role layout, pinnable widgets).
12. **Tamper-evident audit log** (hash chain).

---

## 19. UI / UX RECOMMENDATIONS (consolidated)

- Replace 24-tab page with 3-step wizard + 6-group side rail.
- Submission readiness gauge + hard-gate.
- CA Memo "Approval Pack" PDF preview (one-click in Approvals + Signoff).
- Mobile committee voting view + mobile approval card.
- Consolidate `FacilitiesTab` + `RequestsFacilitiesTab`; consolidate `EsgTab` + `SicrTab` into "Forward-looking risk".
- Sticky headers, zebra rows, sortable + filterable on every data table.
- ARIA labels + keyboard navigation across icon-only buttons.
- Progress indicators on long calls (score run, memo generate, bureau check).
- Consistent confirm-modal pattern; consistent required-field marking.
- Smart defaults (currency from borrower, tenor from product).
- Drill-down on dashboard widgets to filtered list views.
- Per-role dashboard layouts (Executive / Analyst / Manager).

---

## 20. PRIORITY MATRIX

```
          IMPACT
          HIGH                                   LOW
       +-------------------------------+-------------------------+
   URG | Quick wins (do now):          | Schedule:               |
       | 1 Submission readiness        | 1 Confirm-modal unify   |
   HIGH| 2 Connected-party auto-flag   | 2 Sticky table headers  |
       | 3 Bureau adapter wiring       | 3 Smart defaults        |
       | 4 MFA / WebAuthn              | 4 Notification prefs    |
       | 5 SLA escalation              | 5 Dashboard drill-down  |
       | 6 Export audit + DLP          |                         |
       | 7 Split credit:disburse       |                         |
       | 8 AML re-screen               |                         |
       +-------------------------------+-------------------------+
   URG | Plan & resource:              | Defer / monitor:        |
       | 1 OCR pipeline                | 1 AI11 sector synth     |
   LOW | 2 Mobile committee + approver | 2 AI10 breach drafter   |
       | 3 Delegation + optimistic lock| 3 Configurable dashboard|
       | 4 e-Sign integration          | 4 Islamic variants v2   |
       | 5 Read-replica + BI tool      |                         |
       | 6 Challenger predictive model |                         |
       +-------------------------------+-------------------------+
```

---

## 21. ACTION PLAN (90-day window)

### Week 1–2 (Mobilise)
- Stand up an audit-tracking workspace (e.g., Linear / Jira "CAM-Audit-2026Q2" project).
- Confirm `credit:bureau_checks` flag is OFF in production until adapter is live (compliance sign-off in writing).
- Confirm audit-log retention job actually runs.

### Week 3–6 (Quick wins)
- Ship items §16 #1–#12 in two fortnightly releases behind feature flags.

### Week 7–14 (Security & control hardening)
- MFA / WebAuthn.
- Time-based SLA escalation.
- Export audit + DLP.
- Optimistic concurrency.
- Delegation.

### Week 15–24 (UX overhaul)
- Submission wizard restructure.
- Approval Pack PDF integration.
- Mobile committee voting view.
- Override analysis report + dual approval.

### Parallel workstream — bureau / AML go-live
- Vendor RFP shortlist → DD → pilot → production cutover (gated by `credit:bureau_checks`).

### Exit criteria for "production sanctioning ready"
- Bureau adapters live for CCRIS, CTOS, AML.
- MFA enforced on `credit:approve` and `credit:admin`.
- Time-based SLA + escalation operational.
- Audit-log retention verified by Internal Audit.
- DLP on all exports.
- Connected-party auto-flag.
- Mobile committee voting view live.
- Parallel-run cohort completed (≥ 30 deals, ≥ 4 weeks).

---

## 22. CLOSING REMARKS

The Credit Assessment Module is one of the most ambitious modules in the CWC 2.0 platform and, on the evidence of the codebase plus the supporting 27-document design corpus, it is **structurally sound and operationally credible**. The headline message is:

> The design quality is well above what is typical of a v1 platform. The risk surface is mostly in **integration completeness**, **authentication hardening**, and **UX polish for approvers and committees** — not in the data model or workflow engine. With the prioritised quick-wins and the medium-term security / UX program, this module can move from "good demoware with strong bones" to **"production sanctioning ready"** within a single quarter.

The two non-negotiable gates before any live sanctioning are: (1) live bureau / AML adapters, and (2) MFA on every privileged credit role. Until both are met, the system should remain in shadow / parallel-run mode regardless of any business pressure to ship.

---

*End of report. — Generated 2026-05-29 by AI-assisted desk audit, cross-validated against the live `dev2.0` codebase and the in-repo `docs/credit-assessment/*` corpus.*
