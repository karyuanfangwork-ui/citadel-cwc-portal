# Credit Assessment Module — Multi-Perspective Audit
## Malaysia Non-Bank Lender Context (Personal / SME / Corporate Financing, 5–50 users)

**Date:** 2026-06-11 | **Branch:** dev2.0
**Perspectives:** Senior Credit Risk Consultant · Lending Operations Consultant · UI/UX Auditor · Information Security Auditor · Product Owner
**Method:** Code-verified — every finding traced to file/schema evidence. Companion doc: `2026-06-11-loan-origination-lifecycle-gap-analysis.md`

---

## VERDICT ON THE FIVE OBJECTIVE QUESTIONS

| Question | Answer |
|---|---|
| 1. Over-engineered? | **Yes, in specific areas.** ~30% of the module is bank-grade machinery (IFRS 9 ECL, ESG/SICR/climate risk, FATCA/CRS, committee/board apparatus, 25-tab CA memo) that a 5–50 person non-bank lender does not need and will not maintain. |
| 2. Missing critical lending controls? | **Yes.** PDPA consent capture, multi-approver enforcement, approver authority verification, LTV cap, net-income DSR, guarantor capacity check, document retention policy — all absent. The system is simultaneously over- and under-engineered: heavy on governance theatre, light on the controls a Malaysian lender actually gets examined on. |
| 3. Difficult for business users? | **Yes.** 25 tabs × 5–50 fields (~200–250 fields per application), dual Classic/Wizard view modes, state-dependent tab visibility, 7-level drill-down. A credit officer processing a RM30k personal loan faces the same screen as a RM20M corporate facility. |
| 4. Production ready? | **No.** Critical blockers: live secrets committed in `.env` (OpenAI key, S3 keys, DB password), no MFA, no `unhandledRejection` handler (crash risk), synchronous Puppeteer PDF generation, no backups/CI/metrics. Suitable for pilot at ≤100 users after security fixes; not for 1,000 users or 10k apps/month. |
| 5. Suitable for Malaysia lending? | **Structurally yes, compliance-wise not yet.** CCRIS/CTOS structured fields, bureau rating caps, borrower-self-pull eCCRIS approach (correct for non-bank), DSR thresholds, and AML rescreen cadence are all genuinely Malaysia-aware. But PDPA consent, STR record-keeping, EPF/net-income DSR, and BNM-style retention are missing — these are the items an examiner asks for first. |

---

# PART 1 — BUSINESS FIT ANALYSIS

## 1.1 Suitability by Product Line

| Product | Fit | Notes |
|---|---|---|
| **Personal Loans** | 🟡 Moderate | RetailIncome/DSR/employment-type flow exists and is sound in shape; but personal loans are forced through the same 25-tab corporate-grade application shell. DSR uses gross income (EPF captured but never deducted — `retailIncome.service.ts:27`). No streamlined "fast lane". |
| **SME Loans** | 🔴 Weakest fit | **There is no SME borrower type.** `BorrowerType` = INDIVIDUAL / CORPORATE / JOINT / SOLE_PROPRIETOR (`schema.prisma:2526`). SOLE_PROPRIETOR is routed down the retail path (DSR-only); small Sdn Bhds get the full corporate treatment. No dual personal+business assessment for sole props, no simplified financials for <RM5M turnover businesses. SME is the typical core book for a Malaysian non-bank lender — this is the biggest product-fit gap. |
| **Corporate Loans** | 🟢 Strong | Directors/shareholders/UBO capture, financial spreading with 14 ratios, group exposure, committee workflow, approval matrix. If anything, more than needed. |

## 1.2 Feature Classification

**Essential (keep, working):** application state machine; document checklist + verify/reject; CCRIS/CTOS structured capture + bureau caps; DSR computation; 9-factor scorecard with versioning; approval matrix; LOO generation + expiry; disbursement maker-checker; covenant/EWS monitoring; audit chain; PII encryption.

**Recommended (keep, finish):** retail income verification enforcement; conditions precedent/subsequent; score override dual-approval; SLA policies; collateral + insurance tracking; delegation.

**Nice-to-have:** AI risk narrative; AI policy-exception detection; committee calendar; group exposure aggregation; approval pack PDF.

**Unnecessary for this business (over-engineered):**
- **IFRS 9 ECL tab** — 32 input fields incl. macro factors (`RiskRatingEclTab.tsx`, 633 lines). Non-bank lenders under MFRS 9 need simple provisioning, not a manual ECL workbench inside each application.
- **ESG / SICR / Forward-Looking climate risk tab** (`ForwardLookingRiskTab.tsx`, 12 fields) — bank regulatory feature.
- **FATCA/CRS declarations** — relevant to deposit-taking FIs; a lender disbursing loans has near-zero FATCA exposure.
- **Profitability/Wallet-share and Counterparty-netting tabs** — relationship-bank concepts.
- **8 product types** incl. SYNDICATED and PROJECT_FINANCE — a non-bank lender of this size writes term loans, revolving, and hire purchase.
- **Committee quorum/voting/risk-member machinery** for a 5–50 person shop — a 2–3 person credit committee doesn't need agenda items, attendance tracking, and vote tallies; it needs a dual sign-off that's actually enforced (which is missing — see Part 4).

## 1.3 Features Creating Unnecessary Workload
1. Manual financial statement keying (OCR is a stub) — the single largest time cost per SME/corporate file.
2. 3-role sign-off chain (Prepared/Reviewed/Concurred) on **every** application regardless of size — for a RM20k personal loan this is 3 people touching a file that needs 1.
3. Bureau checklist tick + second-officer verify on top of the actual bureau report upload + verification — four touchpoints for one CCRIS report.
4. Qualitative assessment (4 scores), industry outlook narratives, and risk-mitigator lists as separate tabs all feeding one scorecard factor each.
5. Dual KYC tracks (CRM `CrmKycRecord` vs credit KYC states) — same facts maintained twice.

## 1.4 Approval Bottlenecks
- Single sequential sign-off chain — no parallel review, no size-based bypass.
- LOO generation requires `credit:approve` — approvers become a clerical bottleneck.
- Committee path is the only route for larger files; no circulation/written-resolution mode.
- Score must be manually re-run after any financials change before submission readiness passes.

## 1.5 Simplification Recommendations
1. **Introduce risk-tiered processing lanes:** Small (≤RM50k personal: 1 officer + 1 approver, ~6 tabs), Standard (SME: 2-eye, ~12 tabs), Full (corporate/large: current flow). Drive tab visibility off product × amount, not a manual "Advanced Memo" admin toggle.
2. **Add SME as a first-class borrower segment** with simplified financials (management accounts accepted, 2-year history) and dual personal+business assessment for sole proprietors.
3. **Collapse S5** (Bureau Checks, Industry Outlook, Risk & Mitigators, AI Insights) into one "Credit Checks & Risk" tab.
4. **Hide/retire** ECL, ESG/SICR, FATCA/CRS, Profitability, Counterparties tabs behind a config flag defaulted off (they're already feature-flagged — flip the default and stop maintaining them).
5. **Replace committee machinery with enforced N-eyes approval** for files above threshold (and actually enforce it — Part 4, F-1).

---

# PART 2 — USER JOURNEY AUDIT

## 2.1 Current Journey (measured)

| Step | Screen(s) | Effort |
|---|---|---|
| Lead | CRM (separate module) — create Account/Contact, then BorrowerProfile | ~15–20 fields before credit work starts |
| Application | New Application → CreditApplicationDetail (25 tabs) | 5 fields to create; then tab-by-tab completion |
| Document Collection | DocumentsTab — upload + classify + verify per doc | 2 clicks/doc + officer verify step |
| Credit Assessment | 6+ tabs (Financials 10f, RetailIncome 9f, Qualitative, Industry 5f, Risk 8f, Bureau 26f) | The heaviest phase; financials keyed manually |
| Risk Scoring | RiskScoreTab — manual "Run Score" | 1 click, but must remember to re-run after changes |
| Recommendation | SignoffTab — 3 sequential sign-offs | 3 different users, sequential |
| Approval | ApprovalsTab / Approval Inbox / Committee | 1–2 clicks per approver |
| Disbursement | DisbursementTab — create → approve → disburse | 3 actions, 2 users (SOD) |
| Monitoring | Separate monitoring screens per application | Manual covenant tests + payment entry |

**Friction points (evidence-based):**
- **10+ API calls on application load** (facilities, transitions, readiness, approvals, signoffs…) — slow first paint.
- **Drill-down depth of 7 levels** (Nav → App → Section → Tab → Subsection → Field → nested table).
- **Dual view modes** (Classic 25-tab bar vs Wizard 3-step sidebar) with no guidance on which to use; wizard sidebar disappears entirely on mobile.
- **Dynamic tab visibility** — S7 tabs appear/disappear by state; users lose their place.
- **Data duplication** — `requestedAmount` rendered/edited across 14 files; `state || status` dual naming; borrower facts repeated across Borrower tab, Summary, and CRM.
- **No comments/collaboration** — officers cannot leave notes on a file (AI narrative panel only); review feedback happens outside the system.
- **Missing shortcuts** — no "duplicate application", no bulk document upload, no keyboard-driven approval queue processing, no saved list filters.

## 2.2 Recommended Journey

```
CURRENT  (any loan):  Lead(CRM) → Profile → App(25 tabs) → Docs → 6-tab assessment → Score → 3 sign-offs → Approve → LOO → Disburse
                       ~10 screens · ~200+ candidate fields · 5–7 people touching the file

RECOMMENDED (tiered):
 Personal ≤RM150k:    Combined intake (profile+app+docs one screen) → auto-DSR on doc entry → score → 1 approver → LOO → Disburse
                       3 screens · ~30 fields · 2 people
 SME:                 Intake → SME assessment (simplified spread + DSR-for-owner) → score → 2-eye approval → LOO → Disburse
                       5 screens · ~60 fields · 3 people
 Corporate/large:     Current full flow, minus retired tabs
                       ~12 tabs · sign-off chain retained
```

Quick wins regardless of tiering: single "Assessment" workspace combining score+DSR+bureau on one screen; auto-rescore on financials approval; persistent comments thread per application; bulk doc upload with auto-classification.

---

# PART 3 — MALAYSIA LENDING SCENARIOS

## Scenario 1 — Personal Loan (salaried, RM5,000/month, CCRIS + EPF + bank statement)

**Walkthrough:** RM creates CRM contact → BorrowerProfile (INDIVIDUAL) → application → uploads payslip/EPF/bank statement (NRIC_PASSPORT, PAYSLIP, BANK_STATEMENT mandatory for INDIVIDUAL — `DocumentsTab.tsx:33`) → borrower self-pulls eCCRIS, officer uploads + ticks BureauChecklist, second officer verifies → RetailIncomeTab: gross income + commitments → DSR auto-computed (≤60 PASS / 60–70 WARN / >70 FAIL) → score run (retail weights, DSR-driven) → 3 sign-offs → approval → LOO → disburse.

| Issue type | Findings |
|---|---|
| Missing controls | DSR on **gross** income — EPF captured but never deducted (`retailIncome.service.ts:27`); no net income field. No bureau-pull consent capture. `financialsVerified` flag not enforced before approval. No verification that payslip amount matches keyed income (OCR stub). |
| Redundant steps | 3-role sign-off + bureau checklist + checklist verification for a salary-backed RM-thousands loan. Full 25-tab shell shown. |
| Missing automation | No payslip OCR; no auto-DSR from bank statement; manual score trigger. |
| Excessive complexity | Qualitative scores (management/industry/collateral) are meaningless for a salaried individual yet default to 50 in scoring. |

## Scenario 2 — SME Loan (trading company, 3 years, SSM registered)

**Walkthrough:** Must be set up as CORPORATE (no SME type) → SSM cert + audited financials + MOA mandatory → directors/shareholders keyed manually → financial statements keyed line-by-line → 14 ratios computed → corporate scorecard → full sign-off → approval matrix.

| Issue type | Findings |
|---|---|
| Missing controls | No SSM registry verification (number stored, never validated). Director NRIC never verified. No related-party check between guarantors and borrower. |
| Redundant steps | A 3-year trading company is forced through audited-financials-grade spreading; management accounts path exists in enums but no simplified SME track. |
| Missing automation | Financial spreading fully manual (biggest cost per file); no CTOS company-search integration. |
| Excessive complexity | Industry outlook narratives, risk-mitigator lists, ECL/ESG tabs visible to staff assessing a trading company credit line. |

## Scenario 3 — Corporate Loan (Sdn Bhd, multi-director, high amount)

**Walkthrough:** Full corporate path — parties (directors/shareholders/UBO with encrypted NRIC), group exposure check, spreading, scorecard, committee, approval matrix lookup by exposure × rating.

| Issue type | Findings |
|---|---|
| Missing controls | **`requiredApproverCount` not enforced** — `CreditDecision` records a single `decidedById`; a matrix saying "2 approvers / BOARD" cannot actually require it (`schema.prisma:4015`). **No authority verification** — nothing stops an RM approving a Board-level exposure. No LTV cap against collateral; no guarantor net-worth ≥ guarantee check; no linkage forcing Board-band files into the committee flow. |
| Redundant steps | Committee agenda/quorum/vote machinery duplicates what the (unenforced) matrix should do. |
| Missing automation | No stale-valuation block at approval; group exposure aggregation manual. |
| Excessive complexity | This is the one scenario the module fits — but its critical control (multi-approver) is decorative. |

---

# PART 4 — CREDIT RISK AUDIT

| Domain | Status | Key evidence |
|---|---|---|
| Application assessment | 🟡 Adequate structure, no completeness gates | Assessments manual; no state-transition block on missing assessment |
| Document verification | 🟢 Strong | Verify/reject + versioning + SHA-256; gap: no content validation that uploaded "CCRIS" is a CCRIS report |
| Financial assessment | 🟡 | 14-ratio engine good; no spreading adjustments/add-backs; manual entry |
| **DSR** | 🔴 Weak | Gross income only; EPF not deducted; no net income; no income-shock stress persisted; debts not differentiated secured/unsecured |
| Income assessment | 🔴 Weak | `financialsVerified` advisory only; no verification doc-type/by-whom fields |
| Business performance | 🟡 | Ratios + qualitative; no trend analysis, no SME-calibrated benchmarks |
| **Collateral** | 🔴 Weak | No haircuts; no LTV maximum at decision; no valuation staleness rule at approval; free-text valuer (no MAPV validation); `deleteCollateral()` hard-deletes even on active loans (`collateral.service.ts:150`) |
| **Guarantor** | 🔴 Weak | No netWorth ≥ guaranteeAmount validation; no per-guarantor aggregate capacity; no related-party check; no release workflow |
| Risk rating | 🟢 Strong | Versioned scorecards, bureau caps, dual-approval overrides ≥2 notches |
| **Approval matrix** | 🔴 Critical gap | Matrix exists and versions correctly, but **multi-approver count and authority level are not enforced at decision time** — the headline control of the whole module is advisory |
| Exception handling | 🔴 Missing | Condition waivers exist (reason + who), but no deviation authority matrix, no exception classification, no non-waivable conditions, no waiver sunset/review, no exception register report |
| Early warning indicators | 🟢 Good framework | Covenants, payment lateness tiers, EWS with severities, CONDITION_OVERDUE (new); payment data manual |

**Excessive controls:** bureau checklist verification layered on document verification; 3-role sign-off on all sizes; committee quorum apparatus; ECL/ESG assessment burden.

**Top credit-risk fixes (ranked):**
1. **F-1 Enforce the approval matrix** — collect N distinct `CreditDecision`s per `requiredApproverCount`, validate approver role vs `authorityLevel`, block disbursement otherwise. (High / Medium effort)
2. **F-2 Net-income DSR** — add `monthlyNetIncome`, deduct EPF/tax, keep gross for reference. (High / Easy)
3. **F-3 LTV gate** — compute facility ÷ (FSV × haircut) and block/escalate above configurable cap. (High / Easy–Medium)
4. **F-4 Guarantor capacity check** — warn/block when guarantee > estimated net worth or aggregate exposure. (High / Easy)
5. **F-5 Policy exception register** — explicit DeviationApproval model with authority levels and review dates. (Medium / Medium)

---

# PART 5 — UI/UX AUDIT

Scores are 1–10 (10 = excellent).

| Screen | Score | Problems | Impact | Recommendation |
|---|---|---|---|---|
| Dashboard (`CreditDashboard.tsx`, 784 ln, 5 tabs, 17 widgets) | **7** | Exposure tab packs 6 visualizations; no role-tailoring | Officers see portfolio noise | Role-default tab + widget pruning (Part 6) |
| Application List (787 ln, 6-column Kanban + 6 quick filters) | **7.5** | Best screen in module; horizontal scroll on smaller laptops; no saved filters | Minor | Add saved views; list/table alternate mode |
| **Application Detail** (1,472 ln, 25 tabs, ~200–250 fields) | **4** | Information overload; dual view modes; dynamic tab visibility; 7-level depth; 10+ API calls on load | Slow processing, training cost, abandoned wizard mode | Tiered tab sets by product×amount; kill one view mode; lazy-load tab data |
| Customer Profile (BorrowerProfileDetail, 7 tabs) | **6.5** | Overlaps application Borrower tab (duplication); PII reveal good | Double maintenance | Single source render component |
| Credit Assessment forms (6 tabs, 60+ fields) | **5** | Split across many tabs each feeding one scorecard factor; CreditChecksTab alone 26 elements | Context switching | One assessment workspace |
| Risk Score page (`RiskScoreTab`, 344 ln) | **7** | Clear factors/history; manual trigger, stale-score risk invisible | Decisions on stale scores | "Score outdated" banner + auto-rescore |
| Approval screen (ApprovalsTab + MobileApprovalInbox) | **6.5** | Mobile inbox is good (urgency-grouped); desktop approval lacks side-by-side memo view | Approver context switching | Split-pane memo + decision |
| Reports (`CreditReports.tsx`, 667 ln, 3 reports) | **6** | Only 3 reports; no vintage/NPL/concentration; CSV/XLSX export OK | Management blind spots | Add portfolio quality reports |
| Notifications | **5** | SSE infra exists; no credit-specific digest/preferences surfaced | Missed SLA events | Per-role notification preferences |
| **Comments** | **2** | **No user comments capability anywhere in credit module** | Collaboration happens in WhatsApp/email — unauditable | Per-application comment thread (model exists in helpdesk side to reuse) |
| Document Management (DocumentsTab) | **7** | Solid checklist + verification; no bulk upload, no drag-drop-classify | Repetitive uploads | Bulk upload + suggested classification |

**Cross-cutting:** Mobile — responsive grids and dedicated mobile approval inbox are genuinely good; wizard unusable on mobile (sidebar `lg:flex` only, falls back to dropdown). Accessibility — detail page strong (41 aria attrs, arrow-key tab nav, skip link); everywhere else sparse (4–13 attrs). Readability — terminology drift (`state` vs `status`), phase codes S1–S7 leak into UI.

**Overall UX score: 5.8/10** — excellent components (Kanban, mobile inbox, progress ring) trapped inside an over-scoped information architecture.

---

# PART 6 — DASHBOARD AUDIT

**Current:** 5 tabs / 17 widgets shown to everyone (branch filter admin-only).
**Unnecessary/misplaced:** committee calendar as top-level tab (most users never attend); product breakdown duplicated between Exposure tab and Reports; rating chart duplicated in Reports.
**Missing KPIs:** approval turnaround vs SLA target, approval rate %, portfolio NPL/arrears %, disbursement pipeline (approved-not-disbursed RM), document-pending aging, EWS open count by severity.

**Recommended role dashboards:**

| Role | Widgets |
|---|---|
| Credit Officer | My queue by SLA urgency · docs pending verification · returned/referred-back files · my drafts |
| Credit Manager | Team pipeline by state · SLA breaches · aging WIP · pending sign-offs · exception/waiver register |
| Approver | Approval inbox (urgency-ranked) · my turnaround vs SLA · conditions awaiting waiver decision |
| Operations | Approved-awaiting-LOO · LOO expiring (14-day) · disbursement orders pending · conditions precedent outstanding |
| CEO/Management | Portfolio RM + growth · approval rate & turnaround · NPL/arrears trend · concentration (sector/group/top-10) · open EWS by severity |

---

# PART 7 — SECURITY AUDIT

## Critical
| # | Finding | Evidence |
|---|---|---|
| S-C1 | **Live secrets committed**: OpenAI key, DO Spaces/S3 keys, DB password (`postgres:password`) in `backend/.env` | `.env:1,17–20,67` |
| S-C2 | Hardcoded bulk-import password `abc@123` for all imported users | `user.controller.ts` (~:440) |
| S-C3 | AV-status endpoint uses user permission instead of service auth — admin can mark malware "clean" (own TODO acknowledges) | `creditDocument.routes.ts` av-status |
| S-C4 | **No MFA** anywhere — password-only auth for a system holding NRIC, income, financials | codebase-wide |

## High
| # | Finding | Evidence |
|---|---|---|
| S-H1 | No account lockout — rate limit (email+IP) only; distributed brute force feasible | `rateLimit.middleware.ts:41` |
| S-H2 | Session rotation best-effort — token issued even if new session record fails | `auth.controller.ts:234–259` |
| S-H3 | Inconsistent bcrypt rounds (10 for imports vs 12 for register) | `user.controller.ts:310` |
| S-H4 | RM row-level scoping is advisory — services must remember to merge `req.rmScopeFilter` | `rmScope.middleware.ts:19` |

## Medium
S-M1 No CSRF tokens with cookie auth (sameSite-dependent) · S-M2 upload validation is MIME/extension only, no magic-bytes · S-M3 no encryption key versioning/rotation (single env key forever) · S-M4 unlimited concurrent sessions · S-M5 default `helmet()` (no CSP) · S-M6 audit hash-chain bypass paths (services writing `CreditAuditEvent` directly) · S-M7 CORS origin unvalidated.

## Low
S-L1 HIBP breach check fails open · S-L2 `console.log` PII leak paths · S-L3 export filename path-traversal risk (`crm-import-export.service.ts`) · S-L4 reset-token reuse unverified.

## Remediation plan
- **Week 1:** rotate ALL exposed keys; purge `.env` from git history (filter-repo) + add to .gitignore; randomize import passwords with forced reset; move AV endpoint to service API key. (S-C1–C3)
- **Month 1:** MFA (TOTP) at least for approve/disburse roles; account lockout; bcrypt 12 everywhere; magic-bytes upload validation; CSRF tokens; explicit helmet/CSP config. (S-C4, S-H1–H3, S-M1–M2, S-M5)
- **Quarter:** key versioning (KMS-backed) + rotation; make RM scoping enforced (Prisma client extension/global filter); close audit-chain bypass paths; session caps + device listing. (S-M3–M4, S-M6, S-H4)

**Security score: 48/100** — good architecture (encryption, SOD, hash chain, DLP, PII logging) undermined by operational basics: committed secrets, no MFA, advisory enforcement.

---

# PART 8 — PRODUCTION READINESS AUDIT

| Area | Verdict | Notes |
|---|---|---|
| Performance | 🟡 Partial | Pagination correct; 7 indexes on CreditApplication; **CreditAuditEvent has no applicationId index** (full scans at volume); dashboard in-memory post-filtering |
| Scalability | 🟢 Ready* | 7 BullMQ queues, resilient Redis, graceful shutdown; *no queue-depth alerting |
| Error handling | 🔴 Not ready | **No `process.on('unhandledRejection')`** (`index.ts`) — crash risk; fire-and-forget audit writes swallow failures |
| Logging | 🟢 Ready | Winston JSON in prod, DLP masking, PII read logs; add log rotation |
| Monitoring | 🔴 Not ready | `/health` is liveness-only; no metrics endpoint, no APM, no alerting |
| Backup/DR | 🔴 Not ready | Docker volumes only; no backup script, no PITR, no DR runbook |
| Data retention | 🟢 Ready | Soft deletes consistent; 7-year audit retention job with hash-chain verification (monitor-only, compliance-safe) |
| Deployment | 🟢 Ready | Multi-stage Docker, compose with healthchecks, certbot, startup secret validation (exit(1) on missing) |
| Config management | 🟢 Ready | Centralized, validated; minor hardcodes (50MB payload, log paths) |
| **PDF generation** | 🔴 Bottleneck | Fresh Puppeteer launch per request (`htmlToPdf.service.ts:22`) — memory exhaustion under concurrency |
| Tests/CI | 🔴 Not ready | 49 backend test files but credit module critically undertested vs 69 services; 5 frontend tests; **no CI pipeline**, no E2E, no load tests |

**Capacity verdicts:**
- **100 users:** ✅ viable after unhandledRejection fix + secret rotation (controlled pilot).
- **1,000 users:** ❌ needs PDF queue offload, metrics+alerting, backups, audit-event indexes, CI gate.
- **10,000 applications/month:** ❌ all of the above + composite indexes `(state, branchId, createdAt)`, queue backpressure, load testing, managed DB with PITR.

**Production readiness score: 55/100.**

---

# PART 9 — MALAYSIA COMPLIANCE AUDIT

| Requirement | Status | Detail |
|---|---|---|
| **PDPA consent** | 🔴 Missing | Zero consent models/fields anywhere — no processing-purpose consent, no bureau-pull consent, no third-party-sharing consent, no withdrawal tracking. PDPA §10 exposure. PII *protection* is strong (AES-256 + HMAC, reveal endpoints audited) but *consent* is absent. |
| PDPA data-subject rights | 🔴 Missing | No export/erasure workflow for borrower data. |
| **AML/CFT (AMLA)** | 🟡 Partial | Quarterly rescreen cadence + outcome/action audit trail is genuinely good; but screening adapter is a stub (always CLEAR), no sanctions/PEP watchlist integration, and `FILED_STR` action has **no SuspiciousTransaction record-keeping model**. |
| **Credit reporting (CCRIS/CTOS)** | 🟢 Mostly | Structured CCRIS/CTOS fields, 90-day freshness, bureau rating caps, maker-checker checklist; correctly designed around borrower self-pull eCCRIS (non-banks lack BNM CCRIS access). Gap: no consent capture before pull; freshness not re-checked at approval moment. |
| Consent management | 🔴 Missing | (Same as PDPA row — no infrastructure to build on.) |
| **Document retention** | 🟡 Partial | 7-year audit-event retention job exists; but no retention policy per document class, no ≥5-year post-closure credit-file retention rule, no archive workflow, no deletion reason/actor on soft deletes. |
| **Audit trail** | 🟢 Strong | Hash-chained CreditAuditEvent, auto-audit middleware, per-app verification, PII read logging — exceeds non-bank norms. Close the direct-write bypass paths. |

**Compliance score: 50/100** — strong on tamper-evidence and credit-bureau mechanics, failing on consent and STR/retention record-keeping, which are the first items a regulator or PDPA complaint will test.

---

# PART 10 — EXECUTIVE SUMMARY

## Scores

| Dimension | Score | One-line rationale |
|---|---|---|
| **Overall** | **56 / 100** | Bank-grade skeleton, non-bank gaps |
| Business Fit | 62 | Corporate strong, personal serviceable, SME (likely core book) unsupported as a segment |
| User Experience | 58 | Great components, overloaded architecture (25 tabs, 200+ fields) |
| Credit Risk | 60 | Excellent scorecard/audit; approval matrix, DSR, LTV, guarantor controls decorative or missing |
| Security | 48 | Strong design, broken operational basics (secrets in repo, no MFA) |
| Production Readiness | 55 | Good deploy/queue/logging foundation; no CI/backups/metrics; crash + PDF risks |
| Compliance (Malaysia) | 50 | CCRIS/CTOS/audit strong; PDPA consent and STR record-keeping absent |

## Top 20 Findings

| # | Finding | Sev | Effort |
|---|---|---|---|
| 1 | Live API keys + DB password committed in `backend/.env` | Critical | Easy |
| 2 | Approval matrix `requiredApproverCount`/`authorityLevel` not enforced at decision | Critical | Medium |
| 3 | No PDPA consent capture anywhere (incl. bureau pulls) | Critical | Medium |
| 4 | No MFA on a system holding NRIC + financial PII | Critical | Medium |
| 5 | Hardcoded `abc@123` for bulk-imported users | Critical | Easy |
| 6 | AV-status endpoint spoofable by any admin | Critical | Easy |
| 7 | DSR computed on gross income; EPF captured but never deducted | High | Easy |
| 8 | No SME borrower segment; sole props mis-routed to retail-only path | High | Medium |
| 9 | No LTV cap / collateral haircuts / stale-valuation block at approval | High | Medium |
| 10 | No guarantor capacity validation (net worth vs guarantee) | High | Easy |
| 11 | No `unhandledRejection` handler — process crash risk | High | Easy |
| 12 | No STR/SuspiciousTransaction record-keeping (AMLA) | High | Medium |
| 13 | AML screening adapter always returns CLEAR (stub) | High | Complex |
| 14 | No account lockout; distributed brute force feasible | High | Easy |
| 15 | RM row-level scoping advisory, not enforced | High | Medium |
| 16 | 25-tab application detail; ~200–250 fields for every loan size | High | Medium |
| 17 | Synchronous Puppeteer-per-request PDF generation | High | Medium |
| 18 | No CI pipeline, no E2E tests; credit module critically undertested | High | Medium |
| 19 | No backup/DR; Docker volumes only | High | Medium |
| 20 | No document retention policy per class (≥5yr credit-file rule unmodeled) | Medium | Medium |

## Top 20 Quick Wins (all Easy–Medium, high payoff)

| # | Quick Win |
|---|---|
| 1 | Rotate all exposed keys and purge `.env` from history. |
| 2 | Randomize import passwords and force reset. |
| 3 | Add `unhandledRejection` / `uncaughtException` handlers. |
| 4 | Deduct EPF in DSR and add a net-income field. |
| 5 | Add a guarantor net-worth ≥ guarantee warning. |
| 6 | Add LTV computation and a configurable cap warning at decision time. |
| 7 | Add an index on `CreditAuditEvent(applicationId, createdAt)`. |
| 8 | Add account lockout after N failures. |
| 9 | Standardize on bcrypt 12 everywhere. |
| 10 | Add magic-bytes file validation. |
| 11 | Show a "Score outdated" banner when financials are newer than the last score run. |
| 12 | Default Advanced Memo tabs off; hide ECL / ESG / FATCA for non-admin users. |
| 13 | Add a per-application comments thread. |
| 14 | Add bulk document upload. |
| 15 | Add saved filters on the application list. |
| 16 | Add a role-default dashboard tab. |
| 17 | Add approval-turnaround and NPL widgets for management. |
| 18 | Move AV-status behind a service API key. |
| 19 | Add `winston-daily-rotate-file`. |
| 20 | Add a GitHub Actions lint + test gate. |

## Features to Remove (or default-off)
IFRS 9 ECL tab · ESG/SICR/forward-looking risk tab · FATCA/CRS module · Profitability/wallet-share tab · Counterparty-netting tab · committee quorum/voting apparatus (replace with enforced N-eyes) · SYNDICATED + PROJECT_FINANCE product types · one of the two detail view modes.

## Features to Simplify
Sign-off chain → size-tiered (1/2/3 roles by amount) · S5 four tabs → one "Checks & Risk" tab · bureau checklist + verify → fold into document verification · dual KYC tracks → single source · qualitative/industry/risk tabs → one assessment form · 25 tabs → product×amount-driven tab sets.

## Features to Add
PDPA ConsentRecord (incl. bureau-pull consent) · enforced multi-approver workflow + authority check · SME borrower segment + sole-prop dual assessment · net-income DSR · LTV/haircut engine · guarantor capacity checks · SuspiciousTransaction/STR register · DeviationApproval (exception) register · retention policy per document class · application comments · MFA · real AML + OCR adapters.

## Roadmap

**Phase 0 — Stop-the-bleed (1–2 weeks):** secret rotation + history purge; import-password fix; unhandledRejection; account lockout; AV endpoint auth. *Gate for any pilot.*

**Phase 1 — Compliance & control floor (4–6 weeks):** ConsentRecord + consent UI at intake and bureau pull; enforced approval workflow (N decisions + authority validation); net-income DSR; LTV gate; guarantor checks; STR register; MFA for approver/disburser roles.

**Phase 2 — Fit & usability (6–8 weeks):** tiered processing lanes (personal fast-lane / SME / full corporate); SME segment + simplified spread; retire/default-off bank-grade tabs; merged assessment workspace; comments; role dashboards; bulk upload.

**Phase 3 — Scale & automation (8–12 weeks):** PDF queue offload; metrics + alerting; backups/PITR + DR runbook; CI with E2E; real AML/sanctions adapter; OCR for payslips + financials; CTOS API integration; auto-rescore; exception register reporting.

**Phase 4 — Growth (opportunistic):** customer self-service intake + signed-LOO upload portal; eKYC integration; CBS/payment integration for monitoring; portfolio analytics (vintage, NPL, concentration).

---

## Closing Assessment (Product Owner voice)

This module was built to the spec of a mid-size bank, for a company that is a non-bank lender with at most 50 users. The result is paradoxical: it has hash-chained audit trails and ESG risk tabs, but cannot enforce that two people approve a RM5M loan, cannot prove a borrower consented to a CTOS pull, and computes affordability on gross income. The engineering quality of what exists is genuinely high — the fix is not a rebuild but a **re-aim**: strip ~30% of bank-grade surface, finish the 6–8 controls a Malaysian non-bank lender is actually examined on, and re-tier the UX around the personal/SME book that will generate most volume.
