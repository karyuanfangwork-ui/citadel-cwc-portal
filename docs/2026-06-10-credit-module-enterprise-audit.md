# Credit Assessment Module — Enterprise Audit (2026-06-10)

Branch: `dev2.0` @ f12e389. Method: 5 parallel code-verified audit passes (Dashboard/Reports, IA/Listing, Borrower Profile, Assessment/Financials, Documents/Approvals) + cross-cutting spot checks. Supersedes `2026-06-07-credit-assessment-uiux-audit.md`; re-verifies its findings against current code.

---

## PHASE 1 — Module Understanding

**Purpose:** Full-lifecycle corporate + retail credit origination and assessment for a Malaysian lender (CCRIS/CTOS, BNM, IFRS 9, FATCA/CRS context): borrower onboarding → application → financial spreading → scoring → risk review → committee approval → LOO → disbursement → monitoring.

**Users/roles (current, post-simplification — seed.ts:340-343):** 4 roles × 8 permissions:
- CREDIT_RM: read, write, create, export, disburse
- CREDIT_ANALYST: read, write, export
- CREDIT_MANAGER: read, write, approve, export
- CREDIT_ADMIN: all 8 (incl. admin, compliance)

**Process supported:** 17-state machine (DRAFT→…→CLOSED incl. REFERRED_BACK), 9 product types, versioned scorecards, exposure-and-rating-based approval matrix with multi-approver counting, committee with quorum/voting, CP/condition tracking, SLA policies with breach table.

**Assumptions made:** single-entity lender (multi-branch but no multi-entity); MYR-primary book (currency field exists but UI hardcodes MYR); pilot-scale volumes (backend aggregations are in-memory).

**Missing business context:** target portfolio size and concurrency; regulatory submission obligations (BNM reporting not modeled); whether bureau API contracts (CCRIS/CTOS) are planned or permanently manual; delegation policy; committee terms of reference (quorum/recusal/casting-vote rules are not encoded).

---

## PHASE 2 — Information Architecture (Score: 7/10)

**Current state:** 18 routes under `/credit` (App.tsx:291-307), 9-item responsive CreditNav with overflow "More" dropdown (ResizeObserver-based — polished), breadcrumbs on list+detail, max 2-level depth. Group Exposure is now in nav AND deep-linked from borrower profile (**prior orphan finding RESOLVED** — CreditNav.tsx:18, BorrowerProfileDetail.tsx:389).

| Issue | Evidence | Priority |
|---|---|---|
| `/credit/financials` and `/credit/collateral` still absent from nav — reachable only via contextual links | CreditNav.tsx:14-24 vs App.tsx:297,305 | High |
| `/credit/applications/new` is a dead-end interstitial: Dashboard CTA and Borrower "New Application" land on a redirect page and **lose borrower context** (caller sends `borrowerId`, list reads `borrowerProfileId`) | CreditApplicationDetail.tsx:347-367; CreditApplicationList.tsx:107 | High |
| Committee gating mismatch: route allows `credit:read`, nav requires `credit:approve` — analysts/RMs have access with zero discoverability | App.tsx:300 vs CreditNav.tsx:20 | Medium |
| `/credit/m/applications/:id` has no credit permission guard at all | App.tsx:304 | Medium |
| Dead import `CreditApplicationWizard` in App.tsx:89 | — | Low |

---

## PHASE 3 — Dashboard (Score: 5/10; Effectiveness 50/100)

5 tabs: My Work (default) / Pipeline / Approval Inbox / Exposure / Committee Calendar, plus branch filter and New Application CTA. Operational-vs-management separation is conceptually right; SLA visible in 3 places; exposure-vs-limit breach/approaching alerts with borrower deep links are genuinely useful.

**Answers to the four questions:**
1. *Actions possible:* navigate, filter by branch, create application. Nothing else — no approve/reject/reassign/bulk/export from the dashboard.
2. *Decisions supported:* which case to open next (weakly — urgency ignores amount/rating).
3. *Critical missing:* trends/time-series, NPL/watchlist/SICR widget (services exist, invisible), aging buckets, analyst workload distribution, approval-bottleneck analytics, group exposure rollup, funded/unfunded split.
4. *Unnecessary:* "Active States" KPI (filler); same-page self-links on KPI cards.

**Critical defects:**
- **My Work KPIs are wrong above 10 items** — counts are `.length` of `take:10` queries (dashboard.service.ts:347,377,432-433).
- **Approval Inbox leaks the whole bank's queue** — no authority/branch scoping; any `credit:read` user sees all pending apps with amounts (dashboard.service.ts:482-506).
- Exposure tab mixes branch-filtered and unfiltered data when branch filter active (frontend:171 vs service:679-683).
- Two disagreeing SLA computations on the same widget (heuristic count vs CreditSlaBreach table rows); days-in-state proxied by `updatedAt` — any edit resets the aging clock (service:240-249).
- "Pending Approvals" means different things on My Work vs Approval Inbox tabs.

**Recommended layout:** Executive row (portfolio exposure + trend, limit utilization, NPL/Stage-2 migration, approvals aging P90) above operational row (my queue with inline actions, my SLA risks, my drafts), with persona defaults per role; fix counts with `count()` queries; scope inbox by approval authority.

---

## PHASE 4 — Screen-by-Screen UI (avg 6.8/10)

| Screen | UI | What works | Top UI issues |
|---|---|---|---|
| Dashboard | 6 | Consistent card system, empty states, aria on tabs | Bare `Loading...`/error text, dead KPI links, single visual weight everywhere, 3 copies of STATE_LABELS |
| Application Listing | 8 | Skeletons, StateBadge/SLA strip, dual table/kanban persisted, good pagination | Unlabeled actions column; no analyst column; fixed density |
| Borrower Profile | 7 | Polished cards/badges/skeletons/empty states | **Dead "Add Director/Shareholder/UBO" buttons** (no onClick, :441-556); "CRM linking coming soon" stub behind primary CTA; GroupExposurePage hardcoded hex palette off design tokens; `confirm()`/`alert()` dialogs |
| Application Detail (classic) | 7 | CaMemoSection chrome, progress ring, completion dots | Emoji ✓/⛔ mixed with material icons; inline-style/Tailwind drift; tab panels rendered in two divergent code paths (renderTab vs L1078-1276) |
| Wizard mode | 6 | Clean 3-step shell, mobile dropdown | Completion icons permanently empty (props never passed) |
| FinancialSpreading | 7 | Master-detail, 5 chart types, maker-checker states | Fully inline-styled tables vs Tailwind elsewhere |
| Documents | 5 | Clean upload/verify/reject | No version-history UI, no AV/expiry badges |
| Approvals/Committee | 7 | Chain panel, quorum badge, vote tallies | SLA thresholds hardcoded in MyApprovals.tsx:17-21 |
| Reports | 7 | Best polish in module: spinner/error/empty, export UX | KPI color rainbow; unsorted static tables; ratings alphabetically ordered (A, AA, AAA, B…) — service:664 |

**Overall UI: 68/100.**

---

## PHASE 5 — Screen-by-Screen UX (avg 5.2/10)

| Screen | UX | Top UX issues (impact → fix) |
|---|---|---|
| Dashboard | 4 | KPIs lie; zero actions possible → fix counts, add inline approve/reassign |
| Listing | 5 | **Quick filters + sorting are client-side over one server page** — "Overdue SLA"/"My Applications" silently miss everything past page 1; **kanban ignores quick filters entirely** (:160-161, :257-260) → move to server params |
| Borrower Profile | 6 | Excellent 1-click → new application (when it works); UUID-paste to add group members (GroupExposurePage.tsx:185-193); pagination unreachable past page 5 (BorrowerProfileList.tsx:230-233) |
| Application Detail | 6 | Strong guidance (onboarding banner, Next-Incomplete FAB, URL-persisted tabs, section autosave "Saved Xs ago") undermined by 19–27 tab load, 3 separate financial-entry surfaces, FAB and readiness modal navigating to different tabs for the same section (creditUtils.ts:433 vs 441-452) |
| Wizard | 4 | Defaults to hidden legacy 'header' section; no dirty guard; misleads more than guides |
| FinancialAnalysis | 5 | 100-borrower unsearchable dropdown; read-only cul-de-sac, no link to applications |
| Reports | 5 | Exports lose/corrupt on-screen data; no rejected-deal view |

**Overall UX: 55/100.**

---

## PHASE 6 — User Journey (Score: 6/10; Journey 58/100)

Journey: borrower creation (wizard, layered dup-check — good) → application (modal, 6 fields, smart RM default) → docs → spreading → scoring → checks → signoff → committee → LOO → disbursement → monitoring → clone/renew (exists) → closure (admin-only).

**Friction points:**
1. 2 of 3 application entry points dead-end and drop borrower context (HIGH, Phase 2).
2. **No exposure/group context at the decision point** — analyst must leave the application to see borrower limit utilization or group membership; the in-app ExposureSummary is manually keyed, not derived (RequestsFacilitiesTab.tsx:348-360).
3. Duplicate data entry: financials enterable in 3 places with 2 incompatible key schemas (snake_case modal vs camelCase spread view — FinancialsTab.tsx:95-134 vs :392-396).
4. No duplicate-application check at creation (only borrower-level dup check exists).
5. SLA math wrong-by-construction on the listing (createdAt vs per-state limit) and updatedAt-proxy on dashboard — analysts can't trust the aging they're triaged by.
6. Approver with 15 items must open each application; no inline decision from inbox (desktop).

**Optimized journey:** fix `/new` routing with borrower prefill → derived exposure panel inside S7 Decision → single financial-entry surface with templated chart of accounts → server-side "my work" + true time-in-state SLA → inline approve/reject with mandatory-comment modal from inbox.

---

## PHASE 7 — Form Design (Score: 4/10)

Frontend forms are decent: borrower wizard has onBlur dup-pre-check with "View Existing Borrower" shortcut; create modal has smart defaults (RM auto-assign); autosave hook (1.5s debounce, blur, beforeunload) on 13 tabs with section-level saved-ago indicators.

**Systemic gap: backend validation is patchy — only 3 of 61 credit route files use Zod.** Controller-level ad-hoc checks exist in places (the previously missing 10-char rejection-comment rule is now enforced server-side — approval.controller.ts:116-118 — **prior finding FIXED**), but most endpoints trust the client. Other issues: structured bureau data form re-initializes empty and overwrites saved values on save (CreditChecksTab.tsx:113); "Create Anyway (Admin Override)" shown to non-admins who then 403 (NewBorrowerWizard.tsx:552-562); free-text lineKey entry breaks ratio computation silently; date-range filters don't validate from ≤ to.

---

## PHASE 8 — Credit Assessment Process (Score: 7/10; Readiness 70/100)

**Strong:** 12-check submission-readiness hard gate (docs by borrower type, bureau ≤90d + second-officer verification, stale collateral valuations, DSR bands, exposure projection incl. new facilities, FATCA/CRS by AML tier) — bank-realistic. Versioned, effective-dated, approval-attributed scorecards. Retail/corporate branching coherent (DSR vs spreading). Multi-period spreading with ratio thresholds, radar/waterfall/sparkline charts. Score-override dual approval. Related-party groups with per-currency exposure tables.

**Gaps:**
| Gap | Severity |
|---|---|
| **Bureau (CCRIS/CTOS) remains manual borrower-upload — no API adapter** (bureau.noop.ts; provider literally `CCRIS_BORROWER_UPLOAD`) | Critical (compliance posture) |
| **`BorrowerProfile.totalExposure` never recomputed** — manual field feeds approval-authority lookup, auto-exception, group aggregation while the Exposure tab computes live from facilities. Two sources of truth; decisions ride the stale one (borrowerProfile.service.ts:413; approvalAction.service.ts:149-151) | Critical |
| **In-tab statement entry broken**: StatementModal initializes zero line-item rows with no add-row control — S3 workflow dead inside the assessment screen (FinancialsTab.tsx:203, 144-183) | Critical |
| S6 collateral completion hardcoded `isSecured: false` — secured deals never flag missing collateral (CreditApplicationDetail.tsx:402) | High |
| ECL/IFRS9, SICR, ESG, sensitivity are manual-keyed CRUD (no computation), hidden behind session-volatile advanced-memo toggle (TODO Wave E) | High |
| Qualitative assessment defaults unrated factors to "Neutral 3" — anchoring bias, no evidence text | Medium |
| Retail "DSCR" is a 100/DSR inversion heuristic mislabeled as statement-derived (RiskScoreTab.tsx:104-108) | Medium |
| No covenant value/headroom tracking, no statement OCR/Excel import, no peer benchmarking, no group financial consolidation | Medium |

---

## PHASE 9 — Approval Workflow (Score: 7/10)

**Strong (genuinely bank-grade core):** exposure×rating×branch matrix, versioned with snapshots; in-transaction distinct-approver counting (race-safe); state-machine bypass closed (approve/reject from COMMITTEE_REVIEW requires full decision chain — creditApplication.service.ts:827-869); layered fail-closed SOD (RM-self-approval + maker-checker on last transition, 503 on DB error); CONDITIONAL decisions auto-create linked conditions; REFER_BACK works end-to-end; signoff sequence PREPARED→REVIEWED→CONCURRED with revoke guards and IP capture.

**Defects:**
| Issue | Evidence | Priority |
|---|---|---|
| **Committee vote forgery: castVote accepts `body.memberId` with no ownership check — any `credit:approve` user can vote as any member; ABSENT members can vote; no agenda↔meeting check** | committee.controller.ts:193-197; service:319-342 | Critical |
| ADMIN/CREDIT_ADMIN fully bypass SOD — and committee finalize *requires* credit:admin, so the SOD-exempt role finalizes decisions | sod.middleware.ts:29,54; committee.routes.ts:213 | High |
| Delegation model/inbox exist but are not wired into the decision path; no onBehalfOf on CreditDecision | delegation.controller.ts:96 | Medium |
| Quorum checked only at finalize, not vote time; finalize transition errors swallowed → agenda decision and app state can diverge; tie→DEFER silently; no recusal register | committee.service.ts:419-567 | Medium |
| ESCALATE decision is a no-op (recorded, no routing); REJECT needs one rejector regardless of requiredApproverCount | approvalAction.service.ts:253-256 | Medium |
| No approval-pack snapshot binding decision to the data version reviewed | — | Medium |

---

## PHASE 10 — Reporting & Analytics (Score: 5/10)

3 reports (Pipeline, Exposure, Approval Turnaround) with CSV/XLSX export, export audit logging + dedicated rate limiter (production-grade plumbing). Turnaround report is the best artifact in the module (avg/median/P90, 3 group-bys, drill-down, Zod-validated filters).

**Defects:** Exposure export writes borrower-count under the "Rating" column — corrupt regulated export (reports.routes.ts:92-96); pipeline export drops SLA data shown on screen; "Total Decisions" excludes every rejected application (service:871) — rejection-blind; trend arrows meaningless for alphabetical groupings.

**Missing reports:** Portfolio Risk (ECL/stage distribution — data exists in services), Risk Trend (zero time-series), Limit Utilization (alert widget only, not exportable), Concentration (no HHI/limit comparison), Rejection analysis, Analyst productivity, Vintage/cohort, SLA breach register export, scheduling/subscriptions, PDF (infra exists for CA memos, not wired).

---

## PHASE 11 — Mobile & Responsiveness (Score: 5/10)

Dedicated mobile flows exist for approvers only: `/credit/m/approvals`, `/credit/m/committee/:id` (vote), `/credit/m/applications/:id` (summary), with one-shot mobile redirects from MyApprovals/CommitteeMeetingDetail. Wizard mode has a mobile section dropdown and 44px touch targets; CreditNav overflow adapts. But `useIsMobile` appears in only 4 files; `md:` breakpoints in 10 of ~20 credit pages; the listing table, spreading grid, dashboards, and reports are desktop-only (no card collapse), and the unguarded mobile summary route (Phase 2) is the only mobile view of an application. Analysts/RMs effectively have no mobile experience.

---

## PHASE 12 — Accessibility (Score: 6/10)

Genuine effort in the assessment screen: role=tab/tabpanel with Arrow/Home/End keyboard nav, skip link, focus management + Escape in dialogs, aria-labels, icon+colour state badges (STATE_ICONS + STATE_COLORS — not colour-only). 21 credit files use aria-*. Risks: literal emoji (✓/✗/⛔/⚠️) in interactive contexts read poorly by screen readers; `confirm()`/`alert()` dialogs in GroupExposurePage/FinancialsTab; unlabeled actions `<th>`; dead buttons are still focusable; small grey metadata text (contrast risk); no documented WCAG target or audit tooling in CI.

---

## PHASE 13 — Feature Completeness

**Must Have — present:** state machine w/ refer-back, approval matrix + multi-approver, SOD/maker-checker, versioned scorecards, spreading + ratios, readiness gates, conditions/CP tracking, SLA policies + breach table, clone/renew, dup borrower detection w/ admin override + audit, document verify flow + AV hooks, group exposure, PII encryption + reveal audit, branch dimension.
**Must Have — missing/broken:** bureau API, live totalExposure recomputation, committee vote authentication, working in-tab statement entry, server-side "my work" filtering, delegation enforcement.
**Should Have — missing:** covenant monitoring, portfolio risk reporting/IFRS9 outputs, document expiry/retention, approval-pack snapshots, statement import (OCR/Excel), inline approvals from inbox, saved list views, bulk reassignment.
**Nice to Have:** AI insights tab (present, classic-only), ESG scoring (manual), wallet share/profitability (present, advanced flag), e-signature (placeholder).
**Unnecessary/dead:** "Active States" KPI; dead Add Director/Shareholder/UBO buttons; no-op ESCALATE; dead "Running bureau check…" overlay; legacy Header/Facilities tabs duplicated in two taxonomies.

---

## PHASE 14 — Production Readiness (Score: 5/10; 55/100)

**Strong:** security middleware actually mounted (SOD, field encryption AES-256-GCM, PII read logging, DLP export watermarking, export rate limiter); hash-chained per-application audit events; 7-year retention job; background jobs (SLA checker, AML rescreen, collateral insurance monitor); soft deletes; presigned 15-min S3 URLs.

**Risks:**
| Risk | Evidence | Priority |
|---|---|---|
| **Borrower's own NRIC rendered full-plaintext, unmasked, un-audited** (directors/shareholders/UBOs are encrypted+masked+reveal-logged; the primary borrower is not) | BorrowerProfileDetail.tsx:369; borrowerProfile.service.ts:297 | Critical |
| PII reveal endpoints enforce only `credit:read` despite doc saying `credit:pii`/admin — any reader can bulk-reveal NRICs | director.routes.ts:50-58 | High |
| Document downloads: no borrower/RM scoping, no audit log, unscanned/infected files downloadable; AV scan manual and fail-open | creditDocument.routes.ts; clamav.controller.ts:74-77 | High |
| Audit chain integrity inconsistent: hash omits actorId/states/metadata; several services write events with no hash (breaking chains); retention job verifies with a different formula → false-positive integrity reports; CreditAuditEvent `onDelete: Cascade` contradicts 7-year retention | auditChain.service.ts:16; scoreOverride.service.ts:80,148; schema:3683 | High |
| **Test coverage ≈ nil: 2 test files vs 69 service files**; backend test runner previously noted misconfigured | backend/src/credit | High |
| All 5 external adapters still placeholders (bureau, AML, CBS, e-sign, OCR) | adapters/ | High |
| In-memory full-table aggregations on every dashboard/report request, no caching; exposure graph loaded twice per page view; unpaginated approval inbox | dashboard.service.ts:240,606 TODOs | Medium |
| Zod on 3/61 route files; autoAudit rows have userId null; createMany bypasses audit | autoAudit.middleware.ts:113 | Medium |

---

# FINAL DELIVERABLE

## 1. Executive Summary
The module is architecturally ambitious and unusually deep for an internal build — versioned scorecards, exposure-based approval matrices, transactional multi-approver gating, layered SOD, readiness hard gates, encrypted PII with reveal auditing, and group exposure are all real and largely well-implemented. Since the June 7 audit, several previously-critical gaps were closed (refer-back, group-exposure linkage, backend rejection-comment enforcement, branch dimension, My Work tab). However, the module is **not yet business-ready**: a committee vote can be cast as any member, the exposure figure feeding approval authority is a stale manual field, the in-application financial statement editor cannot accept data, the primary borrower's NRIC ships in plaintext, dashboard KPIs are numerically wrong, listing triage filters only see one page of data, and test coverage is effectively zero. The pattern is consistent: excellent skeletons, unreliable last-mile wiring.

## 2–7. Scores
| Dimension | Score |
|---|---|
| Overall UI | **68/100** |
| Overall UX | **55/100** |
| User Journey | **58/100** |
| Dashboard Effectiveness | **50/100** |
| Credit Assessment Readiness | **70/100** |
| Production Readiness | **55/100** |
| **Overall** | **66/100 — FAIR** |

## 8. Top 20 Findings (priority order)
1. **Committee vote forgery** — castVote trusts client memberId (Critical, governance integrity).
2. **Stale `totalExposure` drives approval authority & auto-exception** while UI shows live-computed figures (Critical, wrong approvals possible).
3. **Borrower NRIC plaintext, unmasked, unaudited** (Critical, PDPA exposure).
4. **In-tab statement entry broken** — empty editor, no add-row (Critical, core workflow dead).
5. **Dashboard KPIs capped at 10 / wrong** (Critical, daily decisions on false numbers).
6. **Approval Inbox unscoped** — bank-wide queue + amounts visible to all credit users (Critical, info exposure).
7. Bureau CCRIS/CTOS manual-upload only, no API (Critical-compliance, accepted interim if hard-gated — it is).
8. Quick filters/sort client-side over one server page; kanban ignores filters (High, triage untrustworthy).
9. `/credit/applications/new` dead-end + borrower context dropped (High, primary CTA broken).
10. Document downloads unscoped, unlogged, AV fail-open (High).
11. Audit hash-chain inconsistent + cascade-deleted with application (High).
12. ADMIN bypasses SOD and is the committee finalizer (High).
13. PII reveal gated only by credit:read (High).
14. S6 collateral completeness hardcoded off for secured deals (High).
15. Wizard mode half-wired: empty completion icons, no dirty guard, hidden default section (High).
16. Test coverage 2/69 files (High).
17. Exposure export data corruption; turnaround report rejection-blind (High).
18. SLA math wrong-by-construction (createdAt/updatedAt proxies; duplicated hardcoded maps) (Medium).
19. Dead Add Director/Shareholder/UBO buttons; UUID-paste group membership (Medium).
20. ECL/SICR/ESG manual-only behind volatile feature toggle (Medium, roadmap).

## 9. Critical Issues — items 1–7 above. None are large builds; 1, 3, 5, 6 are days-of-work fixes.

## 10. High Priority — items 8–17, plus: backend Zod rollout on mutation routes; exposure recomputation hook on facility/disbursement events; scope inbox by approval authority.

## 11. Medium Priority — SLA time-in-state tracking (state-entry timestamps); delegation wired into decision path with onBehalfOf; committee quorum-at-vote + recusal register; document expiry/retention; consolidated single STATE_LABELS/SLA config; FinancialAnalysis/borrower-picker typeahead; report additions (limit utilization, rejection analysis, SLA register).

## 12. Low Priority — design-token cleanup (GroupExposurePage), emoji→icon normalization, dead code removal (ESCALATE no-op, dead overlay, dead imports), pagination next/prev on borrower list, empty-state CTAs.

## 13. Quick Wins (≤1 day each)
- Real `count()` queries for My Work KPIs; KPI cards switch tabs instead of self-linking.
- Route `/credit/applications/new` → open create modal with `borrowerProfileId` prefill.
- Wire completion/dirty props into wizard; default wizard section to first visible.
- Add nav entries for Financial Spreading & Collateral; align Committee gating.
- Sort rating tables via RATING_ORDER in reports; fix exposure export columns.
- onClick handlers for Add Director/Shareholder/UBO (routes already exist).
- Mask borrower NRIC behind existing NricReveal component.
- Gate "Create Anyway" override button by permission.

## 14. Missing Features (build list)
Bureau API integration · live exposure recomputation · covenant monitoring · statement import (Excel/OCR) · portfolio risk & trend reporting · report scheduling/PDF · inline approvals from inbox · bulk reassignment + workload view · saved list views · delegation with expiry + onBehalfOf · approval-pack snapshots · committee minutes & recusal · document retention/legal hold · borrower-level bureau history, documents, FATCA/CRS, rating-history sections on profile.

## 15. UI Redesign Recommendations
Single design-token discipline (kill inline styles/hex), one StateBadge + one STATE_LABELS source, consistent toast-based errors (no alert/confirm), dashboard visual hierarchy (one hero metric per tab), skeleton loaders everywhere the listing already has them, density toggle + column config on tables.

## 16. UX Redesign Recommendations
Server-side "my work" model (assignedTo=me, overdue=true params) as the spine of analyst experience; decision-point context panel (live borrower + group exposure, limit headroom, bureau freshness, conditions) pinned inside S7; one financial-entry surface with chart-of-accounts template; merge classic/wizard into one taxonomy (tabRegistry as single source); inline decisioning with mandatory-comment modal from inbox and dashboard.

## 17. Future Roadmap
- **Phase A (2–3 sprints, → ~78/100):** all Criticals + Highs above; Zod rollout; test harness with coverage on approval/exposure/readiness services.
- **Phase B:** SLA time-in-state engine; computed ECL/staging; covenant module; report suite buildout; delegation & committee governance.
- **Phase C:** bureau/AML/CBS live adapters; statement OCR import; portfolio analytics (concentration, vintage, IFRS9); borrower portal; e-sign LOO.

## 18. Final Verdict
**FAIR — 66/100.** Not production-ready for live lending decisions today: governance integrity (vote forgery, stale exposure in authority lookup) and data-protection (plaintext NRIC) defects are disqualifying until fixed, and near-zero test coverage makes regression risk unacceptable for a credit system. The foundations, however, are above-average for this class of system — the gap to "Good (75–89)" is concentrated, well-identified, and mostly weeks not months of work.
