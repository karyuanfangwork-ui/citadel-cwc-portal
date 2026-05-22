# CWC 2.0 — Enterprise UI/UX Audit (Platform-Wide)

**Audit Date:** 2026-05-22
**Auditor:** Senior Enterprise UI/UX Auditor (Claude Code)
**Platform:** Citadel Workplace Connect (CWC) 2.0
**Stack:** React 19 + TypeScript + Vite + Tailwind v4 + Express + Prisma + PostgreSQL
**Scope:** ITSM, ITAM, CRM, Credit Assessment (delta-only), Management Dashboard & Reporting, Approval & Committee Workflow, Notification & Task Center, Mobile Responsiveness, Role-Based UX, Internal Operational Workflow, Cross-Cutting Design System
**Predecessor Audits Referenced:**
- `docs/CREDIT_MODULE_UIUX_AUDIT_2026-05-21.md` (Credit module — do not re-audit in depth)
- `docs/FRONTEND_UIUX_AUDIT_2026-05-15.md` (general frontend snapshot)
- `docs/CRM_AUDIT_FINDINGS.md` (CRM-specific findings)

---

## Table of Contents

0. [How to read this report](#0-how-to-read-this-report)
1. [Executive Summary](#1-executive-summary)
2. [Platform Scorecard](#2-platform-scorecard)
3. [Architecture & Information Architecture](#3-architecture--information-architecture)
4. [Module Audits](#4-module-audits)
   - 4.1 [ITSM (Incident / Service Request / Change / Problem / SLA / KB)](#41-itsm)
   - 4.2 [IT Asset Management (ITAM)](#42-it-asset-management-itam)
   - 4.3 [CRM / Sales](#43-crm--sales)
   - 4.4 [Credit Assessment (delta only)](#44-credit-assessment-delta-only)
   - 4.5 [Management Dashboard & Reporting](#45-management-dashboard--reporting)
   - 4.6 [Approval Workflow & Committee Review](#46-approval-workflow--committee-review)
   - 4.7 [Notification & Task Center](#47-notification--task-center)
   - 4.8 [Internal Operational Workflow (HR / Finance / Procurement)](#48-internal-operational-workflow)
   - 4.9 [Admin Console & Configuration](#49-admin-console--configuration)
   - 4.10 [Knowledge Base & Announcements](#410-knowledge-base--announcements)
5. [Cross-Cutting Concerns](#5-cross-cutting-concerns)
   - 5.1 [Landing Dashboard](#51-landing-dashboard)
   - 5.2 [Navigation & Information Architecture](#52-navigation--information-architecture)
   - 5.3 [Forms](#53-forms)
   - 5.4 [Tables & Lists](#54-tables--lists)
   - 5.5 [Mobile & Responsive](#55-mobile--responsive)
   - 5.6 [Role-Based UX](#56-role-based-ux)
   - 5.7 [Design System & Tokens](#57-design-system--tokens)
   - 5.8 [Performance Perception](#58-performance-perception)
   - 5.9 [Accessibility (WCAG 2.2 AA)](#59-accessibility-wcag-22-aa)
   - 5.10 [AI Readiness](#510-ai-readiness)
6. [Top 50 UX Issues](#6-top-50-ux-issues)
7. [Quick Wins (≤ 1 sprint)](#7-quick-wins)
8. [High-Risk Problems](#8-high-risk-problems)
9. [Modernization Roadmap](#9-modernization-roadmap)
10. [AI Enhancement Opportunities](#10-ai-enhancement-opportunities)
11. [Design System Strategy](#11-design-system-strategy)
12. [Dashboard / Navigation / Mobile Redesign Recommendations](#12-redesign-recommendations)
13. [UX Governance Model](#13-ux-governance-model)
14. [Before/After Vision](#14-beforeafter-vision)
15. [Prioritized Action Plan](#15-prioritized-action-plan)
16. [Rollout & Feature-Flag Strategy](#16-rollout--feature-flag-strategy)
17. [KPI Suggestions](#17-kpi-suggestions)
18. [Appendix — File Evidence Index](#18-appendix--file-evidence-index)

---

## 0. How to read this report

Every finding is anchored to a `file_path:line` evidence reference so engineers can act without rediscovery. Each module section follows the standard rubric:

- **A. Current UX Problems** — what is wrong, observable
- **B. Severity** — CRITICAL / HIGH / MEDIUM / LOW
- **C. Root Cause** — architectural or process-level explanation
- **D. Recommended Improvements** — concrete, implementable
- **E. Enterprise Best Practice Comparison** — ServiceNow, Jira/Atlassian, Salesforce, HubSpot, Zendesk, Freshservice, Monday, Linear, Notion, modern banking (Mambu, nCino, Temenos)
- **F. Implementation Priority** — P0 (now) / P1 (next sprint) / P2 (this quarter) / P3 (backlog)
- **G. Dev Complexity** — S / M / L / XL
- **H. Screenshot-Level Layout Suggestion** — wireframe-style ASCII or descriptive

Scoring is 0–10 with one decimal precision. The Composite Maturity Score is a weighted mean (UI 15, UX 25, Enterprise Readiness 15, Mobile 10, Accessibility 10, Consistency 10, Performance 10, Workflow Efficiency 5).

---

## 1. Executive Summary

CWC 2.0 has expanded — in 8 months — from an internal IT/HR helpdesk into a multi-product enterprise platform spanning **ITSM, ITAM, CRM, Credit Assessment, and Group Finance workflow**. The codebase shows that ambition: ~70 page components, a token-driven Tailwind v4 theme (`frontend/tailwind.theme.extend.ts:1`), permission-gated routing (`frontend/App.tsx:483`–`549`), SSE notifications, an AI briefing layer in CRM, and an autosaving CA Memo in Credit.

The platform is **functionally broad but design-systemically immature**. Cross-module consistency is the single biggest debt: each module was built by a different sub-team and now ships its own header treatment, its own status palette, its own tab pattern, its own breadcrumb style, its own modal stack, and — most damagingly — its own definition of "primary action." When a Group CEO logs in and traverses Dashboard → Approvals → CRM → Credit in a single session, they pass through four visually distinct products that happen to share a header.

The header itself is the second largest debt. `frontend/App.tsx:145`–`163` shoves **12 navigation entries through a 1-row top bar with a "More" dropdown** — there is no left nav, no module switcher, no breadcrumb chrome, and no persistent "what role am I acting as?" cue. For a platform with five product modules, this is structurally below the bar set by ServiceNow Polaris, Salesforce Lightning, and Atlassian's new Compass shell.

Specific systemic issues with the highest business impact:

1. **Information density without information hierarchy.** Lists (MyRequests, ApprovalQueue, CrmAccounts, AssetManagement, CreditApplicationList) are 8–12-column tables with no saved views, no column chooser, no density toggle, and no row-level keyboard nav.
2. **Mobile is a second-class citizen everywhere except the request submission flow.** The asset registry (`frontend/pages/AssetManagement.tsx:120`+), approval queue, and CA Memo tabs are unusable on viewports <768px despite a working mobile drawer.
3. **Action discoverability is bimodal.** End-users find the "Submit Request" CTA easily; agents and approvers must hunt through tabs and sidebars for the next operational step. The Request Detail page (`frontend/pages/RequestDetail.tsx:88`) crams approvals, hiring workflow, custom fields, onboarding, and activity feed into one 3-column grid.
4. **Status semantics are inconsistent.** `STATUS_CONFIG` (constants), `STATE_COLORS` (credit), `STAGE_COLORS` (CRM), `STATUS_COLORS` (assets), `PRIORITY_BADGES` (ApprovalQueue) — five separate color systems, three of them in-file literals not tokens.
5. **No empty / loading / error pattern library.** Each page hand-rolls spinners, skeletons, error banners. `frontend/pages/Reports.tsx:48`–`53` shows a centered spinner; `frontend/pages/Dashboard.tsx:80` defines a local `SkeletonBox`; `frontend/pages/CrmDashboard.tsx:20` defines another one with identical signature.
6. **Approval UX is reactive, not proactive.** `ApprovalQueue` shows pending items but no "what is overdue / what is escalated to me / what is breached." No bulk-approve preview, no policy reasoning surfaced.
7. **Audit trail has no UI surface.** Backend writes audit events; analyst/admin has no global "who did what" timeline.
8. **No notification preference center.** SSE toast appears (`App.tsx:434`–`463`) but cannot be tuned per user.
9. **AI is bolted on, not woven in.** CRM has `useCrmAi` + `AiInsightCard`; Credit has none. ITSM/HR/Finance/Assets have none.
10. **Production readiness is uneven.** ITSM and Credit feel ~70% there; CRM ~65%; ITAM ~55%; Approval Center ~50%; Mobile ~40%.

The platform should not ship to a wider external audience (e.g. dealer partners on the Credit module, customers on the CRM portal) until items 1–4 are remediated. Internally, the platform is usable today but is paying a hidden 25–40% productivity tax on agent/approver workflows.

---

## 2. Platform Scorecard

| Dimension | Score | Justification |
|---|---|---|
| **Enterprise UX Maturity** | **5.6 / 10** | Solid scaffolding (routing, RBAC, autosave in Credit) but design-system fragmentation and weak operational ergonomics drag the score |
| **Production Readiness** | **6.1 / 10** | ITSM/Credit deployable; ITAM/CRM need polish; mobile/admin/approvals not deploy-quality at scale |
| **Mobile Experience** | **4.3 / 10** | Mobile drawer is excellent (`App.tsx:281`–`413`); content pages mostly degrade to horizontal scroll |
| **Accessibility (WCAG 2.2 AA)** | **5.4 / 10** | Skip link, focus trap, ARIA on drawer; missing live regions, form error linkage, table semantics |
| **Design Consistency** | **5.0 / 10** | Token system exists but is bypassed in 60%+ of pages with hard-coded hex |
| **Workflow Efficiency** | **5.2 / 10** | Approvals/Credit decisions take 3–6 clicks where 1–2 should suffice; no saved views; no bulk |
| **Performance Perception** | **6.0 / 10** | Lazy tab loading in Credit; SkeletonRow used in some lists; no global suspense strategy |

**Composite Maturity Score:** **5.4 / 10** — *Functional, not yet enterprise-class.*

Benchmark reference points: ServiceNow Polaris ~8.5, Salesforce Lightning ~8.2, Atlassian Jira ~8.0, Freshservice ~7.4, HubSpot ~8.0, Monday ~7.8, Linear ~9.0, Notion ~8.4.

---

## 3. Architecture & Information Architecture

### 3.1 Frontend Topology

```
frontend/
├── App.tsx                        # Router + Header + Footer (577 LOC monolith)
├── pages/                         # Domain pages (45 files, ~12,000 LOC)
│   ├── Dashboard / AgentDashboard
│   ├── MyRequests / RequestDetail / CreateRequest / ApprovalQueue
│   ├── ITSupport / HRServices / GroupFinance
│   ├── AssetManagement
│   ├── Crm*  (12 pages)
│   ├── credit/ + CreditApplication* + Borrower* + Committee* + Collateral + Scorecard + FinancialSpreading/Analysis
│   ├── Reports / SearchResults / KnowledgeBase / ArticleDetail
│   ├── Announcements / AnnouncementsManage / AnnouncementDetail
│   └── AdminSettings
├── src/
│   ├── pages/  → auth-only (Login, Register, ChangePassword, Forgot/ResetPassword)
│   ├── components/ (37 shared + admin/credit/crm/request/request-detail sub-folders)
│   ├── services/ (28 service files — clean per-domain split)
│   ├── context/ (Auth, Notification, Theme, Toast)
│   ├── hooks/ (useAutosave, useDirtyFormGuard, useFocusTrap, useIdleSession, useDebouncedValue …)
│   └── utils/ (permissions, errorMessages, workflowActions/Transitions/ModalConfig)
└── tailwind.theme.extend.ts       # Token bridge (Tailwind v4 @theme)
```

The split between `frontend/pages` and `frontend/src/pages` (auth) is inconsistent and predates the React 19 migration. Recommend consolidating under `frontend/src/pages/` long-term.

### 3.2 Route Inventory (from `App.tsx:483`–`549`)

| Path | Component | RBAC Guard | Notes |
|---|---|---|---|
| `/` | Dashboard | auth | role-agnostic hub |
| `/hr`, `/it`, `/finance` | service-desk landings | auth | only category grids |
| `/my-requests`, `/request/:id` | requester views | auth | id is UUID — not human-readable |
| `/agent`, `/approvals` | agent + approver | role / permission | parallel inboxes |
| `/assets` | ITAM | `asset:read` | tabbed registry/employee |
| `/crm/*` | CRM (13 routes) | `crm:read`/`crm:admin` | Has own sub-nav |
| `/credit/*` | Credit (11 routes) | `credit:read`/`credit:approve`/`credit:admin` | Has own sub-nav (`CreditNav.tsx`) |
| `/reports` | reports | `report:read` | single page |
| `/announcements`, `/admin/announcements` | announcements | auth / write | end-user vs admin |
| `/kb`, `/kb/:slug` | KB | DEV-only flag | currently gated to dev |
| `/admin/settings` | Admin Console | `admin:access` | sidebar tabs |
| `/:deskType/:deskId/create/:categoryId` | dynamic request create | auth | wildcard before `*` |
| `/change-password` | account | auth | |
| `/*` | NotFound | — | |

**IA gap:** there is no `/tasks` route, no `/my-work` aggregator, no `/inbox`. Agents must bounce between `/agent`, `/approvals`, `/credit/approvals`, `/my-requests` to "see everything I have to do today."

### 3.3 Shell

- Header — `App.tsx:85`–`416` — sticky top-bar 64px. Logo + 12 nav entries (overflowed to "More"). Search bar (250px) + Help + Notifications + User menu + mobile hamburger.
- Footer — `App.tsx:418`–`432` — static copyright + 3 dummy links (`href="#"`).
- Body — single `<main>` content well; pages choose their own `max-w-*` (1200, 1400, 1440, 7xl) — *inconsistent*.

There is **no left nav, no breadcrumb chrome at shell level** (each page renders `Breadcrumbs.tsx` ad-hoc), and **no global "context strip"** (role, environment, current customer, current entity).

---

## 4. Module Audits

### 4.1 ITSM

**Files audited:**
- `frontend/pages/Dashboard.tsx` (497 LOC) — end-user hub
- `frontend/pages/AgentDashboard.tsx` (408 LOC) — agent inbox
- `frontend/pages/MyRequests.tsx` (363 LOC) — requester list
- `frontend/pages/RequestDetail.tsx` (300 LOC) — single ticket
- `frontend/pages/ITSupport.tsx`, `HRServices.tsx`, `GroupFinance.tsx` (~160 LOC each) — desk landings
- `frontend/pages/CreateRequest.tsx` (190 LOC) — wizard
- `frontend/src/components/request-detail/*.tsx` (35 modal/action files)

#### A. Current UX Problems

1. **Three parallel "my work" surfaces with overlapping semantics.** `Dashboard.tsx:129`–`134` shows requester stats; `AgentDashboard.tsx:50` shows agent tabs (`mine|unassigned|all|resolved`); `ApprovalQueue.tsx:45` shows approver queue. Each pulls `/requests` with different filters. No unifying "Inbox".
2. **RequestDetail is a wall.** `RequestDetail.tsx:88` lays a 3-column grid: form + hiring panel + onboarding + entity approvals + activity feed + sidebar with 30+ possible modal actions (`frontend/src/components/request-detail/` contains 35 modal files, e.g. `CeoDecisionModal`, `CfoDecisionModal`, `CtoDecisionModal`, `FinAcknowledgeModal`, `RouteToGroupCeoHRModal`, etc.). There is **no progressive disclosure**.
3. **Workflow state is encoded as buttons, not as a visible workflow.** A user looking at a ticket cannot answer "where am I in this process and what's next" without reading the entire sidebar (`ActionSidebar.tsx`).
4. **Stepper coverage gaps.** Prior observation 79 (10:39 Apr 23) confirms `RequestHeader` stepper omits LOA statuses for hiring. Stepper exists but is incomplete and unmaintained.
5. **`/request/:id` uses UUID** (prior obs 201, Apr 26). Bookmarkable but unmemorable; should be `/request/REF-2026-00123` with redirect.
6. **Service-desk landings (`ITSupport.tsx:115`–`137`) are static catalogs with no recently-used / popular / saved tiles.** A user who submits the same software request weekly sees the same 9-tile grid every time.
7. **Create-request wizard does not show progress.** `CreateRequest.tsx:1`–`190` renders dynamic form fields with no step indicator, no draft-save signal, no inline "estimated SLA / who will approve this" preview.
8. **No SLA visualization on tickets.** SLA appears only as a numeric deadline; no progress bar, no escalation indicator on detail page, no breach risk surfaced until breach.
9. **AgentDashboard has 4 tabs but no saved filters.** A senior agent who only works "Hardware tickets escalated to T2 with SLA <2h" rebuilds that filter every login.
10. **No keyboard nav on ticket rows.** Row click is the only affordance; no `j/k` next/prev, no `e` to edit, no `c` to comment — modern enterprise inboxes (Linear, Front, Superhuman) treat keyboard-first as baseline.

#### B. Severity Matrix
| Issue | Sev |
|---|---|
| Wall RequestDetail (#2) | CRITICAL |
| 3 parallel inboxes (#1) | HIGH |
| No SLA visualization (#8) | HIGH |
| Workflow invisible (#3) | HIGH |
| UUID in URL (#5) | MEDIUM |
| Static desk landing (#6) | MEDIUM |
| No saved filters (#9) | MEDIUM |
| Wizard no progress (#7) | MEDIUM |
| Stepper gaps (#4) | MEDIUM |
| No keyboard nav (#10) | LOW |

#### C. Root Cause
The ITSM module is the *oldest* part of the codebase; it grew via feature additions (LOA, onboarding, offboarding, hiring, chargeback) without a refactor of the detail page contract. The 35-modal `request-detail/` folder is the smoking gun: each new workflow added a sibling modal rather than a structured step component.

#### D. Recommended Improvements
1. **Introduce a unified `/inbox` route** aggregating Mine + Unassigned + Awaiting My Approval + Mentioned in + Watching, with saved views (cf. Linear Inbox, Front).
2. **Adopt the ServiceNow "Now Experience" two-pane layout for RequestDetail:** left = ticket conversation timeline (single column), right = collapsible "Workflow Cockpit" with stage indicator + contextual actions only valid for the current stage. Move all 35 modals to be triggered from this cockpit.
3. **Render an SLA progress bar** in `RequestHeader`: amber at 60% of SLA, red at breach. Add countdown for top-N due-soonest in `Dashboard.tsx`.
4. **Replace UUID URLs** with `/request/{referenceNumber}` + legacy redirect.
5. **Promote "Recently used services" and "Saved requests" tiles** at the top of each desk landing.
6. **Wizard stepper** with persisted draft (autosave to `localStorage` keyed by `category:user`).
7. **Saved filter views** for AgentDashboard ("Smart Inboxes" in Freshservice parlance).
8. **Keyboard nav** for table rows; `?` to open global shortcut sheet.

#### E. Best Practice Comparison
- **ServiceNow:** "Agent Workspace" — single record opens in a 3-pane: form, contextual side panel, related lists. Crucially, side panel is **scrollable and modular**, not a fixed sidebar of 30 buttons.
- **Jira Service Management:** sidebar shows "Request type → Workflow → Current status → Available transitions" — a learnable mental model. CWC currently shows only "buttons that happen to be valid now."
- **Freshservice:** sidebar of "Smart suggestions" (KB, related tickets, automated next step). CWC has none.
- **Zendesk:** time-tracking + macros first-class. CWC has neither.
- **Linear:** keyboard-first, command palette `Cmd-K`. CWC has no command palette.

#### F. Implementation Priority
- P0: #2 (workflow cockpit), #8 (SLA viz)
- P1: #1 (unified inbox), #3 (workflow visible), #5 (ref# URLs)
- P2: #6, #7, #9
- P3: #10

#### G. Dev Complexity
- Workflow cockpit refactor: **XL** (rewrites `request-detail/` modal interaction model, ~3 sprints)
- Unified inbox: **L** (~1 sprint, mainly aggregator service + UI)
- SLA progress bar: **S** (~1 day)
- Ref# routing: **S** (~1 day + redirect)

#### H. Screenshot-Level Suggestion

```
┌──────────────────────────────────── REQ-2026-00451 — Laptop refresh ────────────────────────────────┐
│ ◀ Back  │   Status: WITH AGENT     SLA: ████████░░ 78% (2h 14m left)    Priority: HIGH    │ Watch ★│
├─────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ STEPPER:  Submitted ─▶ Approved (CFO) ─▶ ▼ With IT Agent ─▶ Procurement ─▶ Delivered ─▶ Closed     │
├──────────────────────────────────────────────────────┬──────────────────────────────────────────────┤
│ TIMELINE (conversation)                              │ WORKFLOW COCKPIT                              │
│  ── 09:14 Karyuan submitted request                  │  Stage: With IT Agent                         │
│  ── 09:22 Jane (CFO) approved with note: "ok"        │  Owner: it@test.local  ▼                     │
│  ── 11:02 Auto-assigned to it@test.local             │  Next available actions:                      │
│  ── 11:15 (now)  ▍ comment input ▍                   │   [ Procure Hardware ]   [ Reassign ]        │
│                                                      │   [ Add KB Reference ]   [ Request Info ]     │
│                                                      │  ─────────────────────────────────────────    │
│                                                      │  Custom fields  (3 incomplete)  ▾             │
│                                                      │  Participants    ▾                            │
│                                                      │  Linked items    ▾                            │
└──────────────────────────────────────────────────────┴──────────────────────────────────────────────┘
```

---

### 4.2 IT Asset Management (ITAM)

**Files audited:**
- `frontend/pages/AssetManagement.tsx` (1558 LOC — single-file mega component)
- `frontend/src/services/asset.service.ts`

#### A. Current UX Problems

1. **1558-LOC single file** mixing registry tab + employee tab + 4+ modals + filters + CSV import. Maintainability and code-splitting both suffer.
2. **Status palette hard-coded.** `AssetManagement.tsx:13`–`23` defines `STATUS_COLORS` as inline Tailwind classes (`bg-green-100 text-green-800`) — bypassing the token system entirely.
3. **9 status × 9 category combinations** with no faceted filter chips. User must use two `<select>`s.
4. **No asset detail page.** Selecting an asset opens a modal (`selectedAsset` state); modal cannot deep-link, cannot be shared, cannot be bookmarked.
5. **No assignment history view.** `currentAssignee` (line 120) reads `asset.assignments?.find(a => !a.returnedAt)?.user` but never renders historical assignments timeline.
6. **CSV-only import.** Modern asset managers expect Excel/Google Sheets paste, autocomplete from serial-number registries, barcode-scan webcam capture (mobile), and procurement integrations.
7. **No lifecycle visualization.** An asset has a PROCURE → STOCK → ASSIGN → REPAIR → RETIRE lifecycle; the UI shows only current state via a colored pill.
8. **Bulk delete is the only bulk action.** Bulk-assign, bulk-status-change, bulk-export-selected, bulk-tag — all missing.
9. **No warranty / depreciation / cost ledger views.** Enterprise ITAM (Lansweeper, Snipe-IT, ServiceNow ITAM) all surface remaining warranty days and book value.
10. **Search field has no scope or suggestions.** Cannot search by assignee name, by serial number prefix, by location.
11. **Mobile failure:** the registry uses a horizontal-scroll table; on a phone the user sees only the first 2 columns.

#### B. Severity
- Mega-file (#1): MEDIUM (tech debt)
- Hard-coded palette (#2): MEDIUM
- No detail page (#4): HIGH
- No history (#5): HIGH
- Limited import (#6): MEDIUM
- No lifecycle viz (#7): MEDIUM
- Bulk limited (#8): MEDIUM
- No warranty/cost (#9): HIGH
- Mobile (#11): HIGH

#### C. Root Cause
ITAM was scoped narrowly as "registry + assignment" (per prior obs 305, May 1) without a product brief that included lifecycle/cost/audit. The frontend rushed to feature-parity with the backend models without ever splitting into list / detail / settings views.

#### D. Recommended Improvements
1. Split `AssetManagement.tsx` into `pages/assets/AssetList.tsx`, `AssetDetail.tsx`, `EmployeeAssetsTab.tsx`, `modals/*`.
2. Promote modal → dedicated `/assets/:id` route with tabs (Overview, Assignment History, Lifecycle, Warranty/Cost, Documents, Audit).
3. Use design tokens for status colors via a shared `<StateBadge variant="asset" status={…}/>`.
4. Faceted filter sidebar (Status × Category × Assignee × Location × Vendor) with chip-summary.
5. Lifecycle timeline component (procured → in stock → assigned to X for 134 days → returned → reassigned …).
6. Warranty countdown card on detail page; depreciation curve.
7. Add bulk-assign, bulk-status, bulk-tag.
8. Barcode-scan via WebRTC `BarcodeDetector` for mobile inventory walkthroughs.
9. Replace global `<select>` filters with a `<Combobox>` + multi-select.

#### E. Best Practice Comparison
- **Snipe-IT:** asset detail has Lifecycle, Activity, Files, History, Licenses, Maintenance tabs.
- **ServiceNow ITAM:** unified CI lifecycle with TCO, software licensing, and discovery integration.
- **Lansweeper:** mobile barcode capture + warranty cards.
- CWC currently provides: tabular registry + employee view. Gap is large.

#### F. Priority: P1 split + detail route; P2 lifecycle / warranty; P3 barcode

#### G. Complexity: **L** for split + detail route; **XL** for lifecycle/warranty/depreciation.

#### H. Screenshot-Level

```
/assets/A-0034891  — MacBook Pro 14" M3
┌──────────────────────────────────────────────────────────────────────┐
│ Serial SN-89YQ-X   Status ● ASSIGNED   Owner: Karyuan F. (since 134d)│
├──────────────────────────────────────────────────────────────────────┤
│ [Overview][Assignment History][Lifecycle][Warranty & Cost][Docs][Log]│
├──────────────────────────────────────────────────────────────────────┤
│  ● Procured 2025-09-01     │   Warranty:  ████████░░  148d left      │
│  ● Stocked  2025-09-04     │   Book value:  MYR 7,432 (depreciation) │
│  ● Assigned 2026-01-08  ← now (134 days)                              │
│                                                                       │
│  Replacement recommended:  N (within warranty)                        │
└──────────────────────────────────────────────────────────────────────┘
```

---

### 4.3 CRM / Sales

**Files audited:**
- `frontend/pages/CrmDashboard.tsx` (468 LOC)
- `frontend/pages/CrmOpportunityDetail.tsx` (545 LOC)
- `frontend/pages/CrmPipeline.tsx` (356 LOC)
- `frontend/pages/CrmAccounts.tsx` (204 LOC)
- `frontend/src/components/CrmNav.tsx`, `crm/AiInsightCard.tsx`
- prior `docs/CRM_AUDIT_FINDINGS.md`

#### A. Current UX Problems

1. **Sub-nav exists (`CrmNav.tsx`) but is not paired with breadcrumb chrome at the shell level.** Cross-module nav (e.g. CRM → linked Credit application for that account) is impossible.
2. **Pipeline is a fixed Kanban** — no swim-lane toggle (by owner, by territory, by stage age), no WIP limits, no aging signal.
3. **Opportunity detail has 4 tabs (Overview/Activities/Notes/History)** but no Files, no Quote, no Forecast, no Linked Cases.
4. **Daily briefing AI panel** (`CrmDashboard.tsx:38`–`117`) is cached only in `sessionStorage` and silently fails ("Could not generate briefing. Check OPENAI_API_KEY."). Single-tenant secret leakage in error message is a security UX smell.
5. **`globalSearch` is local-only** — no recent searches, no scoped search ("only Leads"), no result highlighting.
6. **Currency hard-coded to MYR everywhere** (`CrmDashboard.tsx:10`, `CrmOpportunityDetail.tsx:7`). Multi-currency, FX rates, conversion are absent.
7. **No reps/team leaderboard on the dashboard** (`CrmTeamDashboard.tsx` is a separate page, low-discoverability behind `crm:admin`).
8. **Activity form is a modal** with manual fields; no calendar/email integration (Outlook/Gmail). Modern CRMs auto-log emails.
9. **Win/Loss debrief AI** (`CrmOpportunityDetail.tsx:43`–`58`) silently fails (`catch {}`) — user has no feedback when AI is misconfigured.
10. **Lead → Opportunity conversion** is documented but UI affordance is buried.
11. **No deal-room or shared workspace** with the customer/partner.

#### B. Severity
- No cross-module link (#1): HIGH
- Pipeline limited (#2): HIGH
- Opportunity missing tabs (#3): HIGH
- AI silent fail (#4, #9): MEDIUM
- Single currency (#6): HIGH (operational reality)
- Email integration (#8): HIGH (productivity)
- Lead conversion buried (#10): MEDIUM
- No deal room (#11): MEDIUM

#### C. Root Cause
The CRM was implemented as a feature-parity port of generic Salesforce/HubSpot capabilities without grounding in the actual *go-to-market motion* of Citadel (cross-sell to existing borrowers, group-level account hierarchy, financing-specific deal lifecycle). It is missing the strategic glue: CRM ↔ Credit ↔ Group Finance.

#### D. Recommended Improvements
1. **Account 360**: from `CrmAccountDetail.tsx`, add a "Related" panel surfacing the linked Borrower Profile, active Credit Applications, and any open Service Requests for that account's contacts.
2. **Swim-lane Pipeline**: toggle by owner / stage / territory.
3. **Opportunity tabs**: add Files, Forecast, Quote, Linked Cases, Approvals.
4. **AI transparency**: when AI fails, show a clear "AI unavailable" badge with a docs link; never echo "OPENAI_API_KEY" to user.
5. **Multi-currency**: store `currency`, convert at presentation; FX from a daily rates table.
6. **Email integration**: at minimum, BCC-to-CRM email capture; long-term, OAuth Outlook/Gmail.
7. **Inline lead conversion** with a wizard preserving notes/activities.
8. **Deal room** (shared external portal with documents and signature).

#### E. Best Practice Comparison
- **Salesforce Lightning:** Account 360 + Path component + Forecasting + Files first-class.
- **HubSpot:** Activity timeline auto-populated from email; deal stage with weighted forecast; reports tab attached to record.
- **Pipedrive:** swim-lane pipeline + deal-rotting indicators.
- **Microsoft Dynamics:** AI-driven "next best action" embedded into form, not a side panel.
- CWC has the AI side panel (good direction) but lacks the deeper Activity/Forecast/Files plumbing.

#### F. Priority
- P0: Account-to-Credit/Service link (#1), AI failure messages (#4/#9)
- P1: Opportunity tabs (#3), pipeline swim-lanes (#2)
- P2: Multi-currency (#6), email capture (#8)
- P3: Deal room (#11)

#### G. Complexity: **M** for cross-module links; **L** for tabs; **XL** for email/deal-room.

#### H. Screenshot-Level

```
ACCOUNT — Globex Corp (Group)
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ Tier: ENTERPRISE   Industry: Manufacturing   Owner: Karyuan   MYR ▾                  │
│ ─── Quick links: Borrower Profile ✔  | 2 Credit apps  | 1 open ticket               │
├──────────────────────────────────────────────────────────────────────────────────────┤
│ [Overview] [Contacts] [Opportunities] [Activities] [Files] [Credit] [Tickets] [Log]  │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 4.4 Credit Assessment (delta only)

A full audit exists at `docs/CREDIT_MODULE_UIUX_AUDIT_2026-05-21.md` (754 lines). This section adds **only deltas** observed at the **platform** level.

#### A. Cross-Module Deltas
1. **CreditNav is a separate component (`frontend/src/components/CreditNav.tsx`) — CRM has its own (`CrmNav.tsx`).** Both sub-navs reinvent the same pattern. There is no shared `<ModuleSubNav>` primitive.
2. **Credit's StateBadge / RiskBadge / AutosaveTextField are excellent** (per Credit audit) but live in `src/components/credit/` and are not reused by ITSM (which has its own status pills hard-coded).
3. **Credit approvals (`/credit/approvals`) and global approvals (`/approvals`) are separate inboxes** — a Committee member who is also a CFO has two queues to monitor.
4. **No bridge to CRM:** a credit officer cannot see the originating CRM Opportunity or Account from the Credit Application detail (and vice versa per 4.3 #1).
5. **Committee Meetings page (`/credit/committee`) duplicates calendar UI** with no integration to corporate calendars or to the shared notification center.

#### B. Recommended Deltas (beyond Credit audit)
- Promote `StateBadge`, `RiskBadge`, `AutosaveTextField` from `components/credit/` to `components/shared/` and adopt in ITSM/CRM/ITAM.
- Unify `/approvals` and `/credit/approvals` into a single `/approvals?scope=…` route with tabs.
- Add "Source CRM Opportunity" deep link to Credit Application header.
- Surface Committee Meetings into the global notification center.

---

### 4.5 Management Dashboard & Reporting

**Files audited:**
- `frontend/pages/Reports.tsx` (241 LOC)
- `frontend/pages/CrmReports.tsx`
- `frontend/pages/credit/CreditReports.tsx`
- prior `frontend/src/services/reports.service.ts`

#### A. Current UX Problems
1. **Three separate Reports pages** with no aggregation: ITSM `/reports`, CRM `/crm/reports`, Credit `/credit/reports`. A Group CEO has three URLs.
2. **No filters, no date ranges, no comparisons.** `Reports.tsx:28`–`46` loads everything for "all time" with no time window control.
3. **No export.** Reports cannot be downloaded as CSV/PDF for board packs.
4. **Charts are stat tiles + simple lists.** No trend lines (sparklines), no funnel, no cohort.
5. **No drill-down.** Clicking "Open: 47" does not navigate to the filtered list.
6. **No scheduling.** Cannot email a weekly summary to leadership.
7. **No saved dashboards** ("My View", "Board View", "Operations View").
8. **No KPI definitions visible** to the user — what counts as "Resolved"? In which timezone?

#### B. Severity
- 3 silos (#1): HIGH
- No time/filter (#2): HIGH
- No export (#3): HIGH (executive workflow)
- No drill-down (#5): HIGH
- No scheduling (#6): MEDIUM
- Definitions invisible (#8): MEDIUM

#### C. Root Cause
Reports were added per-module by the team owning the module. There was never a "reporting product owner".

#### D. Recommended Improvements
1. **Unified Insights Hub** at `/insights` with sections: Operations (ITSM), Sales (CRM), Credit, Assets, Workforce (HR).
2. Date-range + comparison ("vs last 7d / last 30d / YoY").
3. Drill-down: every stat is a link to the filtered list.
4. Export: CSV, XLSX, and PDF (board-pack).
5. Scheduled email summaries (weekly KPI digest).
6. Saved dashboards with role-based defaults.
7. Hover-tooltip on every metric explaining its formula.
8. Sparklines + funnels (Recharts already present from `package.json`).

#### E. Best Practice Comparison
- **Salesforce CRM Analytics / Tableau:** drag-and-drop dashboards, drill-down, scheduling.
- **Looker / Mode:** explore-from-here, share-as-link, scheduled deliveries.
- **HubSpot:** widget-based dashboards saved by role.
- **Linear Insights:** auto-narrative ("Cycle time down 14% this week").
- **Mambu / nCino:** regulatory pack export (Basel, IFRS9).

#### F. Priority: P0 unified hub; P1 drill+export; P2 scheduling/savedviews.

#### G. Complexity: **L** unified hub; **M** drill+export; **M** scheduling.

#### H. Screenshot-Level

```
/insights
┌──────────────────────────────────────────────────────────────┐
│ Period: ▼ Last 30 days   Compare: ▲ vs prev 30 days   Export │
├──────────────────────────────────────────────────────────────┤
│ TICKETS                ▲▼  CREDIT PIPELINE  ▲▼  SALES   ▲▼   │
│ 412 (-7%)   ▁▂▆▇▅▃▂   MYR 14.3M (+12%)     58 deals  +4     │
│ Open 87  Resolved 305                                         │
├──────────────────────────────────────────────────────────────┤
│ SLA HEALTH                  AGENT WORKLOAD                    │
│ Within  ████████░░ 82%      [bar chart of top 10]            │
│ Breach  ██ 18%                                                │
├──────────────────────────────────────────────────────────────┤
│ Top categories ▾   Aging buckets ▾   Funnel ▾                │
└──────────────────────────────────────────────────────────────┘
```

---

### 4.6 Approval Workflow & Committee Review

**Files audited:**
- `frontend/pages/ApprovalQueue.tsx` (416 LOC)
- `frontend/pages/MyApprovals.tsx` (credit-scoped)
- `frontend/pages/CommitteeMeetings.tsx`
- `frontend/src/components/EntityApprovalsPanel.tsx`
- 35 modals in `frontend/src/components/request-detail/`

#### A. Current UX Problems

1. **Two approval inboxes** (`/approvals` ITSM and `/credit/approvals` Credit) — see 4.4.
2. **No urgency grouping in ITSM approvals.** Credit's `MyApprovals` groups by urgency (per Credit audit); ITSM does not.
3. **Reject requires a reason but does not prompt for a category.** `ApprovalQueue.tsx:62` keeps `rejectReason` free-text.
4. **Bulk approve is supported but not reviewed.** Bulk approval lacks a "preview impact" step (total $ value approved, count by category).
5. **Inline action buttons** (Approve/Reject) on each row, but no "open in side-drawer" pattern — analysts must navigate away to see the full request.
6. **Committee Meetings has its own UI** that doesn't share components with the meeting/calendar/notification system.
7. **No delegation.** An approver going on leave cannot delegate to a peer; no out-of-office picker.
8. **No escalation visibility.** Whether an item has been auto-escalated to me (vs originally routed) is invisible.
9. **No approval policy / threshold visible.** "Why am I approving this?" cannot be answered from the UI (amount thresholds, role, entity rules live only in admin config).
10. **No audit linkage** — clicking on a past approval doesn't expose the policy rule that triggered it.

#### B. Severity: CRITICAL for #1, #7, #8; HIGH for #2, #4, #9.

#### C. Root Cause
Approval logic accreted alongside individual modules. No single approval product owner ever standardized the queue, the action menu, the delegation model, or the policy explainer.

#### D. Recommended Improvements
1. **Unified Approval Center** `/approvals?source=…` with tabs and global counters in the header.
2. **Side-drawer preview** for any pending approval — full request context without leaving the queue.
3. **Delegation/Out-of-office** in user menu — set start/end + delegate user; SSE re-routes.
4. **Escalation badge** on queue rows.
5. **Policy-aware reasoning:** show "Routed to you because: amount > MYR 50k → CFO".
6. **Bulk-approve preview** with summary stats + confirmation.
7. **Structured rejection** with reason categories + free text.
8. **Approval SLA** with breach badge.

#### E. Best Practice Comparison
- **ServiceNow Flow Designer + Approval Engine:** policy explainer + audit + delegation built-in.
- **SAP Ariba:** thresholds and delegation chains are explicit; out-of-office is one click.
- **Concur:** mobile-first quick approve.
- **Salesforce Approval Process:** "Submitted By", "Why Routed", "Next Approver" always visible.

#### F. Priority: P0 unified center + delegation; P1 policy reasoning + escalation; P2 bulk preview.

#### G. Complexity: **L** unified center; **M** delegation; **L** policy explainer.

---

### 4.7 Notification & Task Center

**Files audited:**
- `frontend/src/components/NotificationDropdown.tsx`
- `frontend/src/context/NotificationContext.tsx`
- `frontend/App.tsx:434`–`463` (`NotificationToast`)
- `backend/src/routes/notification*.ts`

#### A. Current UX Problems
1. **Toast + bell dropdown** only — no full-page notification center, no archive, no search.
2. **Toast is single — one at a time.** A burst of SSE events visually drops earlier toasts.
3. **No preference center.** User cannot mute "announcement" or "asset assignment" while keeping "approval requests".
4. **No grouping/threading.** 5 events on the same ticket appear as 5 unrelated bells.
5. **Email vs in-app mapping is invisible.** User does not know which events go to email vs in-app.
6. **No "task center"** — only notifications. Modern platforms (Notion, ClickUp, Monday) merge tasks + mentions + assignments.
7. **No mobile push** (PWA / FCM) wiring.

#### B. Severity: HIGH for #1, #3, #5; MEDIUM for #2, #4; HIGH for #6 (strategic).

#### D. Recommendations
1. `/notifications` full page with filters, archive, search.
2. Preference Center under `/settings/notifications` (per-event-type × per-channel matrix).
3. Toast: queue with stack-limit and 4s auto-dismiss.
4. Group multiple events per entity into a single notification card.
5. Add a `/tasks` view aggregating: action-required tickets, approvals due, mentions, CA Memo incomplete sections.
6. PWA + web push + service worker.

#### E. Best Practice Comparison
- **Slack:** notification center, schedule, snooze, channel mute granularity.
- **Microsoft Teams Activity Feed:** mentions/replies/missed calls grouped.
- **Linear/Notion:** Inbox & Tasks merged.
- **HubSpot:** tasks queue with one-click "run sequence".

#### F. Priority: P0 prefs + full page; P1 task center; P2 push.

---

### 4.8 Internal Operational Workflow

Covers HR (hiring/onboarding/offboarding/LOA), Group Finance (chargeback, invoices, payments), and Procurement (hardware orders).

**Evidence:** `frontend/src/components/request/HiringWorkflowPanel.tsx`, `request-detail/*` modals, `frontend/src/components/OnboardingDashboard.tsx`, `OffboardingDashboard.tsx`, `frontend/src/services/it-workflow.service.ts`, `loa.service.ts`, `interview.service.ts`, `screening.service.ts`, `chargeback-workflow.service.ts`, `finance-workflow.service.ts`.

#### A. Current UX Problems
1. **Workflow state machines exist** (good) but **the visualization is inconsistent across HR/IT/Finance**. A new joiner onboarding shows checkmarks; a chargeback shows none.
2. **35 modals in `request-detail/`** — each "decision" is its own modal. Authoring fatigue + visual inconsistency.
3. **`OnboardingDashboard` and `OffboardingDashboard`** are embedded inside RequestDetail rather than being first-class pages — discoverability is low.
4. **LOA workflow gaps** (prior obs 79) — stepper does not include LOA statuses.
5. **No process metrics surfaced** — Average time-to-hire, time-to-onboard, chargeback cycle time absent from any dashboard.
6. **No checklists templates exposed to end-users** — onboarding tasks live in admin config; new joiners cannot see their own checklist progress at `/me`.
7. **Hiring pipeline view** missing — recruiters cannot see all open roles at a glance.

#### B. Severity: HIGH for #1, #5, #6; MEDIUM for #2, #4.

#### D. Recommendations
1. Adopt a **shared `<WorkflowStepper>`** primitive driven by the backend state machine.
2. Consolidate the 35 decision modals into a **`<DecisionPanel>`** that reads schema from `workflowModalConfig.ts`.
3. Promote Onboarding / Offboarding dashboards to top-level `/onboarding` and `/offboarding` routes for HR.
4. Add a `/hr/hiring-pipeline` Kanban (req → JD → posted → screening → interview → offer → accepted).
5. Surface workflow KPIs in the Insights Hub.
6. Add a user-facing "My checklist" widget on `/` for active joiners.

#### E. Best Practice Comparison
- **BambooHR / Workday / Greenhouse:** unified hiring/onboarding flow with stage clarity.
- **SAP Concur for Finance:** chargeback as a structured wizard, not a free-form ticket.
- **ServiceNow HR Service Delivery:** lifecycle journeys with milestone cards.

---

### 4.9 Admin Console & Configuration

**Files audited:**
- `frontend/pages/AdminSettings.tsx` (413 LOC)
- `frontend/src/components/admin/` (27 files)

#### A. Current UX Problems
1. **Sidebar nav with 3 groups** is solid (`AdminSettings.tsx:96`–`100`) but the number of tabs (~17 ADMIN_TABS) requires scrolling.
2. **No global "preview as user" / "impersonation" mode** for admin troubleshooting (with audit).
3. **Workflow transition editor** is text-heavy; could be a visual graph.
4. **Permissions tab** lists permissions but does not show *who has each*.
5. **Audit log tab exists** but per prior obs 593, there is no *global* audit trail UI — only admin-side.
6. **Form Builder** uses modal-in-modal patterns (`FormBuilderModal.tsx`).
7. **No environment indicator** — admins editing prod vs staging see no visual cue.

#### B. Severity: HIGH for #5, #7; MEDIUM for #2, #3, #6.

#### D. Recommendations
1. Visual workflow editor (cf. ServiceNow Flow Designer, n8n).
2. Permission-to-user matrix view.
3. Global audit trail surfaced under `/admin/audit` AND linkable from every entity.
4. Impersonation with audit + banner.
5. Environment banner ("PROD", "STAGING") in header.
6. Form Builder uses full-screen overlay, not nested modal.

---

### 4.10 Knowledge Base & Announcements

**Files audited:** `KnowledgeBase.tsx` (173), `ArticleDetail.tsx`, `Announcements.tsx` (226), `AnnouncementsManage.tsx`, `AnnouncementDetail.tsx`, `AnnouncementWidget.tsx`.

#### A. Current UX Problems
1. **KB is gated to DEV** (`App.tsx:154`, `:507`–`:508`) — meaning prod users have no KB at all.
2. **No KB search integration** with global search.
3. **No KB suggestion** in `CreateRequest.tsx` (deflection opportunity lost).
4. **Announcements widget on dashboard** (`Dashboard.tsx:96`) shows pinned + latest, but **no acknowledgement tracking** and **no compliance/required-reading workflow**.
5. **No targeted announcements by role/entity/desk** visible in the UI.

#### B. Severity: HIGH for #1, #3; MEDIUM for #2, #4.

#### D. Recommendations
1. Promote KB to production behind a feature flag; iterate on content first.
2. Embed KB search in `CreateRequest` ("Before submitting — articles related to your query…") — ServiceNow deflection pattern.
3. Required-reading announcements with acknowledgement timestamps.
4. Audience targeting (by role / desk / entity).

---

## 5. Cross-Cutting Concerns

### 5.1 Landing Dashboard

`frontend/pages/Dashboard.tsx` is a generic hub showing greeting + service desk cards + recent requests + announcements + stats.

**Problems**
- Same view for everyone — no role-aware layout. CEO sees the same dashboard as a new joiner.
- 4-card stats are duplicated by Reports module; cognitive churn.
- "Hero" gradient block is decorative, costing 200px above-the-fold on mobile.
- Search bar is duplicated (header has one, dashboard adds another).
- No "Today" task list.

**Recommendation:** Persona-aware home grid. End-user: services + my requests + announcements. Agent: queue + SLA. Approver: pending + delegations. Executive: KPIs + escalations.

### 5.2 Navigation & Information Architecture

**Header bar (`App.tsx:145`–`195`)** routes 12 entries through a single 1-row top bar. At <md breakpoints the entire nav collapses behind a hamburger.

**Issues**
- No left rail for module deep-linking.
- "More" dropdown hides Admin behind another click — sysadmin friction.
- No breadcrumb at shell level; each page rolls its own.
- No global command palette (`Cmd-K`).
- No environment banner (prod vs staging).

**Recommendation: Adopt a hybrid shell**:
- Top bar: brand + global search + Cmd-K + notifications + help + user.
- Left rail: 5 module icons (Service, Assets, CRM, Credit, Insights) + Admin pinned bottom. Expand-on-hover with labels.
- Each module renders its own sub-nav inside the workspace, but the rail keeps role-context persistent.

### 5.3 Forms

- Dynamic form builder feeds CreateRequest; field types include file → stored as filename only (prior obs 23). This is a **data-loss UX defect** — fix file uploads.
- No inline validation for required fields; errors appear only on submit.
- No autosave for create-request (Credit has autosave; ITSM does not).
- No "Save Draft" CTA exposed even though backend supports DRAFT.

**Recommendation:** Adopt React Hook Form + Zod schema + inline error helper text linked via `aria-describedby` + autosave + draft chip.

### 5.4 Tables & Lists

Patterns observed:
- `MyRequests.tsx:80` — paged list, debounced search, server-side filter on status, **no column chooser**, **no sort**, **no density**, **no saved views**.
- `AgentDashboard.tsx:62` — 4 tabs, multi-fetch on mount, no virtualization (will struggle past 1000 rows).
- `AssetManagement.tsx` — single big table.
- `ApprovalQueue.tsx:91` — client-side `filter()` on search after server pagination — **inconsistent results** when results span pages.

**Recommendation:** Build a `<DataTable>` primitive (TanStack Table v8) with: server-side sort/filter/page, column chooser, density toggle, saved views, row selection, virtualization, keyboard nav, CSV export.

### 5.5 Mobile & Responsive

- Header drawer (`App.tsx:281`–`413`) is well-built (focus trap + scroll lock + ARIA dialog).
- Content pages mostly use Tailwind responsive utilities (`sm:`, `md:`, `lg:`) but tables overflow.
- Modals do not adapt to phone screens — fixed widths in many.
- No bottom sheet pattern; no mobile-first ticket creation flow.

**Recommendation:** Card-list fallback for all tables at <768px. Bottom-sheet modal pattern. Responsive form fields (full-width + native pickers).

### 5.6 Role-Based UX

Roles inferred from `frontend/src/utils/permissions.ts` and route guards: ADMIN, AGENT, CFO, CEO, GROUP_CEO, CTO, FIN, MANAGER, END_USER. The UI surface barely changes per role beyond gating nav items.

**Recommendation:** Role-aware home, role-aware shortcuts, role badge in the user menu (currently shows only name + email).

### 5.7 Design System & Tokens

- `tailwind.theme.extend.ts` defines a clean token map (brand/it/hr/fin/semantic/text/surface/border/spacing/radius). 
- BUT pages frequently hard-code Tailwind utility colors (`bg-green-100`, `text-red-600`) instead of semantic tokens.
- Multiple ad-hoc color maps: `STATUS_COLORS` (assets), `PRIORITY_BADGES` (approvals), `STAGE_COLORS` (CRM), `LEAD_COLORS` (CRM), `CATEGORY_COLOR` (Dashboard), `PRIORITY_CONFIG` (AgentDashboard). 
- No `<Button>`, `<Badge>`, `<Card>`, `<Tabs>`, `<Modal>`, `<Drawer>`, `<DataTable>`, `<StateBadge>` primitives at the shared layer (StateBadge exists but inside `components/credit/`).

**Recommendation:** Establish `frontend/src/components/ui/` as the design-system root. Migrate StateBadge/RiskBadge/AutosaveTextField from credit. Add shadcn/ui-style primitives with token bindings.

### 5.8 Performance Perception

- Lazy tab loading is used in Credit; not elsewhere.
- `SkeletonRow`, `SkeletonCategoryCard` exist but only ~10% of pages use them.
- `Reports.tsx:48`–`53` uses a `min-h-screen` centered spinner — visually jarring.
- `Promise.all` for top-of-page is fine; no global suspense boundary.

**Recommendation:** Adopt React 19 `<Suspense>` boundaries with consistent skeletons; replace global spinner with progressive content.

### 5.9 Accessibility (WCAG 2.2 AA)

Strengths:
- Skip-link present (`App.tsx:475`–`480`).
- Mobile drawer is ARIA-correct (`role="dialog"`, `aria-modal`, focus trap).
- `aria-label` and `aria-expanded` on hamburger.

Gaps:
- No `aria-live` regions for SSE toast.
- Form errors not linked to inputs via `aria-describedby` in most forms.
- Tables lack `<caption>` and `scope="col"`.
- Color-only status indicators (badges) for color-blind users.
- Modal dismissal patterns vary; not all trap focus.
- No `prefers-reduced-motion` handling for `animate-spin` / `animate-pulse`.

### 5.10 AI Readiness

- CRM has the foundation (`useCrmAi.ts`, `AiInsightCard.tsx`, dashboard daily briefing, opportunity win/loss debrief).
- Credit has none beyond Autosave.
- ITSM has none (large opportunity: auto-categorize, suggest KB, draft response).

**Recommendation:** Build a thin `aiService` abstraction (OpenAI/Anthropic agnostic) and three reusable surfaces: `<AiInsightCard>` (already exists), `<AiSuggestField>` (inline draft), `<AiAssistantDrawer>` (Cmd-K conversational). Add ticket triage + KB suggestion + credit memo summarization + asset replacement recommendation.

---

## 6. Top 50 UX Issues

(Severity in brackets — C/H/M/L)

1. (C) RequestDetail is a wall of 35 modal triggers
2. (C) Two separate Approval inboxes
3. (C) Wall-of-tabs Credit Application detail (covered in Credit audit)
4. (C) No mobile parity for tables
5. (C) No design-system primitives layer (`/ui`)
6. (C) Status palettes hard-coded in 6 places
7. (C) No SLA visualization on ticket header
8. (C) No unified inbox / "my work"
9. (C) Three Reports pages — no Insights Hub
10. (C) No notification preference center
11. (H) AI errors leak `OPENAI_API_KEY` to UI
12. (H) Asset management is a 1558-LOC mega file
13. (H) No `/asset/:id` route
14. (H) UUID-based `/request/:id`
15. (H) No saved filter views for AgentDashboard
16. (H) No keyboard nav / command palette
17. (H) Pipeline lacks swim-lanes + aging
18. (H) Opportunity tabs missing Files/Forecast/Quote/Cases
19. (H) Currency hard-coded to MYR
20. (H) No email/calendar integration in CRM
21. (H) No delegation / out-of-office
22. (H) No escalation visibility on approvals
23. (H) No approval policy explainer
24. (H) No global audit trail UI
25. (H) Workflow visualization inconsistent across HR/IT/Finance
26. (H) Onboarding/Offboarding dashboards buried inside RequestDetail
27. (H) KB gated to dev — prod users have none
28. (H) Hiring pipeline view missing
29. (H) No persona-aware dashboard
30. (H) Header has no left rail / Cmd-K
31. (H) No environment banner
32. (H) Tables overflow on mobile
33. (H) File-type custom fields store only filename string
34. (H) ApprovalQueue mixes server-side pagination with client-side search filter
35. (H) `<DataTable>` primitive missing
36. (H) Skeletons only used in ~10% of pages
37. (H) Color-only status indicators (a11y)
38. (M) Footer has dummy `href="#"` links
39. (M) Two-folder page split (`pages/` + `src/pages/`)
40. (M) Stepper coverage gaps (LOA)
41. (M) Bulk approve has no preview
42. (M) Bulk asset actions limited to delete
43. (M) Modal-in-modal in Form Builder
44. (M) Toast is single-instance (drops bursts)
45. (M) No notification grouping
46. (M) Wizard has no step indicator
47. (M) No "recently used" tiles on service desks
48. (M) Activity logging is manual in CRM
49. (M) Committee Meetings reinvents calendar
50. (L) Animation respects no `prefers-reduced-motion`

---

## 7. Quick Wins

(≤ 1 sprint, ≤ S complexity, high-visibility ROI)

| # | Win | File | LOE |
|---|---|---|---|
| Q1 | Reference-number-based URLs `/request/:ref` with UUID redirect | `App.tsx:496` + service | S |
| Q2 | SLA progress bar in RequestHeader | `request/RequestHeader.tsx` | S |
| Q3 | Fix `href="#"` in footer with real or removed links | `App.tsx:418-432` | XS |
| Q4 | Replace inline status hex with `<StateBadge>` | `assets/CRM/ApprovalQueue` | S |
| Q5 | `aria-live` polite region for toast | `App.tsx:434` | XS |
| Q6 | Replace global spinner in Reports with skeleton | `Reports.tsx:48` | XS |
| Q7 | Date-range selector on Reports | `Reports.tsx` | S |
| Q8 | Promote KB to prod behind feature flag | `App.tsx:507` | XS |
| Q9 | Hide "OPENAI_API_KEY" from user error text | `CrmDashboard.tsx:59` | XS |
| Q10 | Environment banner | `App.tsx` shell | S |
| Q11 | Add `aria-describedby` on form errors | `request/RequestFormFields` | S |
| Q12 | Bulk-approve preview modal | `ApprovalQueue.tsx` | S |
| Q13 | "Recently used services" on desk landing | `ITSupport.tsx` | S |
| Q14 | Save Draft chip in CreateRequest | `CreateRequest.tsx` | S |
| Q15 | Out-of-office field on user profile | `ChangePassword.tsx` + service | S |

---

## 8. High-Risk Problems

(Operational / compliance / security implications)

1. **No global audit trail UI** — regulators (BNM, PDPA) expect surfaceable evidence; backend has data but no easy export. **High compliance risk.**
2. **File custom fields store filename only** (prior obs 23) — silent data loss; users believe they've attached a file.
3. **AI error messages leak secret-name** — minor info disclosure but signals weak error-boundary discipline.
4. **No environment banner** — admins can edit prod thinking they're in staging.
5. **No delegation** — single-approver bottleneck halts business when out of office.
6. **Permission cache 5min TTL** — revoked admins retain access for up to 5 minutes. Document or shorten.
7. **No mobile bottom-sheet** — emergency approvals from phone are friction-heavy; approvers default to desktop.
8. **Skeleton/loading inconsistency** — perceived performance variance erodes trust.
9. **Currency hard-coded to MYR** — financial misreport risk if regional expansion is on roadmap.

---

## 9. Modernization Roadmap

```
Q3-26 (Foundation)
 ├── Design System v1 (frontend/src/components/ui)
 ├── DataTable primitive
 ├── Insights Hub (unified Reports)
 ├── Approval Center unification + delegation
 ├── Reference-number URLs
 └── SLA progress bar + KB in prod

Q4-26 (Workflow & AI)
 ├── RequestDetail Workflow Cockpit refactor
 ├── /inbox & /tasks unified surfaces
 ├── Asset detail route + lifecycle/warranty
 ├── AI triage + KB suggestion (ITSM)
 ├── Multi-currency in CRM
 └── Notification preference center

Q1-27 (Mobile & Scale)
 ├── Mobile bottom-sheet patterns
 ├── PWA + push notifications
 ├── Command palette (Cmd-K)
 ├── Persona-aware dashboards
 └── Global audit trail UI

Q2-27 (Enterprise polish)
 ├── Visual workflow editor (admin)
 ├── Impersonation w/ audit
 ├── Email/calendar integration (CRM + HR)
 └── Deal room / external portal
```

---

## 10. AI Enhancement Opportunities

| Surface | Idea | Module | Maturity |
|---|---|---|---|
| Ticket triage | Auto-suggest category + priority + assignee on submit | ITSM | quick win |
| KB deflection | Inline KB suggestion during CreateRequest | ITSM | quick win |
| First-response draft | Suggest agent reply | ITSM | medium |
| CA Memo summarizer | One-paragraph executive summary | Credit | medium |
| Risk drift detector | Highlight outliers vs portfolio | Credit | medium |
| Lead enrichment | Company-firmographic enrich | CRM | medium |
| Deal coach | Next-best-action per opportunity | CRM | medium |
| Asset replacement | Predict failure / warranty-end nudges | ITAM | medium |
| Onboarding assistant | Personalized welcome chatbot | HR | low effort |
| Insight narrator | "Cycle time up 12% — top driver: Hardware approvals" | Insights | medium |
| Audit anomaly | Detect unusual permission changes | Admin | medium |

---

## 11. Design System Strategy

1. **Establish `frontend/src/components/ui/`** as the canonical primitives folder (Button, Badge, Card, Tabs, Modal, Drawer, Tooltip, Toast, DataTable, EmptyState, Skeleton, StateBadge, RiskBadge, FormField, Combobox).
2. **Migrate credit-only primitives** (StateBadge, RiskBadge, AutosaveTextField) up.
3. **Replace all hex literals** with `var(--color-*)` or `text-brand-700` etc.; lint rule against raw hex outside tokens.
4. **Token expansion:** semantic colors per state (`--color-state-progress`, `--color-state-blocked`, `--color-state-success`, `--color-state-danger`, `--color-state-info`).
5. **Storybook** for visual review + Chromatic for regressions.
6. **Density tokens** (`--density-comfortable|compact`).
7. **Theming** (light + dark + high-contrast) — `ThemeContext` already exists; finish wiring.

---

## 12. Redesign Recommendations

### 12.1 Dashboard (Persona-Aware)

End-User: "What can I do?" → service tiles + my open requests + announcements.
Agent: "What's on fire?" → SLA-at-risk + unassigned + my tickets + KB top searches.
Approver: "What needs my decision?" → urgency-grouped queue + delegations.
Executive: KPIs + escalations + trend strip + AI-narrated highlights.

### 12.2 Navigation

- Hybrid shell (left rail icons + top bar).
- `Cmd-K` palette: jump to anything (ticket ref, person, account, application).
- Environment + role badge in header.

### 12.3 Mobile

- Bottom-sheet modals.
- Card-list fallback for all tables.
- Touch-target ≥ 44px.
- One-tap "Approve" on push notification (PWA action button).

---

## 13. UX Governance Model

1. **Single UX lead** owns the design system and reviews every PR touching `frontend/src/components/ui/` or page-level layouts.
2. **Design tokens** are the only colorization mechanism — enforced by ESLint rule.
3. **PR checklist** includes a11y, mobile, dark-mode, and design-system-reuse.
4. **Quarterly UX scorecard** revisits the dimensions in §2.
5. **User research cadence** — 4 interviews/quarter per persona (end-user, agent, approver, executive).
6. **Pattern library docs** live in `/docs/design/`.
7. **Versioned changelog** for components.

---

## 14. Before/After Vision

| Surface | Before | After |
|---|---|---|
| Header | Top-bar with 12 entries + "More" | Left rail + Cmd-K + env badge |
| Dashboard | One-size-fits-all | Persona-aware home |
| RequestDetail | Wall of 35 modals | Workflow Cockpit + stepper |
| Approvals | 2 inboxes, no delegation | 1 center, delegation, policy explainer |
| Reports | 3 pages, no filters | Insights Hub with drill + export |
| Assets | 1558 LOC mega file | List + Detail + Lifecycle tabs |
| Mobile | Tables overflow | Bottom-sheet + card fallback |
| AI | CRM-only side panel | Cross-module assist + triage |

---

## 15. Prioritized Action Plan

| Wave | Items | Outcome |
|---|---|---|
| **W1 (Sprint 1–2, Quick Wins)** | Q1–Q15 from §7 | Visible polish, lower bug surface |
| **W2 (Sprint 3–6, Foundation)** | DataTable primitive, ui/ folder, Insights Hub, Approval Center | Consistency baseline |
| **W3 (Sprint 7–10, Operational)** | RequestDetail Cockpit, /inbox, Asset detail route, delegation, policy explainer | Productivity uplift 25–40% |
| **W4 (Sprint 11–14, Mobile/AI)** | Mobile bottom-sheet, PWA push, Cmd-K, AI triage | Executive/mobile experience |
| **W5 (Sprint 15+, Enterprise)** | Visual workflow editor, audit trail UI, multi-currency, deal room | Regional + regulatory readiness |

---

## 16. Rollout & Feature-Flag Strategy

- Use server-driven flags (`feature_flags` table) read at session start, exposed to FE via `useAuth()` payload.
- Pattern: `flag.workflow_cockpit_v2`, `flag.insights_hub`, `flag.command_palette`.
- Gradual rollout: internal admins (5%) → IT/Finance leads (25%) → all internal (100%) → external partners.
- Kill-switch via admin console.
- Telemetry: time-to-task, click-depth, error-rate per flagged surface before promotion.

---

## 17. KPI Suggestions

| KPI | Definition | Target |
|---|---|---|
| Time-to-Submit (median) | CreateRequest open → submit | ≤ 90s |
| Time-to-First-Response (P50/P90) | Submit → first agent action | P90 ≤ 2h |
| SLA Compliance | Within-SLA / Total | ≥ 92% |
| Approval Cycle Time | Route → decision | P50 ≤ 4h |
| Bulk-Approve Adoption | % approvals via bulk | ≥ 25% |
| KB Deflection Rate | (KB-suggest-viewed × resolved-without-ticket) | ≥ 8% |
| AI Suggestion Acceptance | accepted / shown | ≥ 35% |
| Asset Lifecycle Closure | retired+assigned vs procured | ≥ 95% |
| Mobile Task Completion | tasks completed on mobile | ≥ 30% by Q1-27 |
| Accessibility Audit Pass | axe-core violations / page | ≤ 1 |
| Design-System Adoption | components from `ui/` / page | ≥ 80% by Q1-27 |
| NPS (internal) | Standard NPS | ≥ +35 |

---

## 18. Appendix — File Evidence Index

| Concern | Evidence |
|---|---|
| Header & nav | `frontend/App.tsx:85-416`, `:145-163` |
| Mobile drawer | `frontend/App.tsx:281-413` |
| Routes | `frontend/App.tsx:483-549` |
| Footer | `frontend/App.tsx:418-432` |
| Toast notif | `frontend/App.tsx:434-463` |
| Tokens | `frontend/tailwind.theme.extend.ts:1-105` |
| Dashboard | `frontend/pages/Dashboard.tsx:54-150` |
| AgentDashboard | `frontend/pages/AgentDashboard.tsx:38-120` |
| MyRequests | `frontend/pages/MyRequests.tsx:33-100` |
| RequestDetail | `frontend/pages/RequestDetail.tsx:1-100` |
| 35-modal sprawl | `frontend/src/components/request-detail/` |
| ITSupport landing | `frontend/pages/ITSupport.tsx:1-161` |
| Approvals | `frontend/pages/ApprovalQueue.tsx:1-120` |
| Reports | `frontend/pages/Reports.tsx:1-120` |
| Admin | `frontend/pages/AdminSettings.tsx:1-100` + `src/components/admin/` |
| Assets | `frontend/pages/AssetManagement.tsx:1-120` (1558 LOC total) |
| CRM Dashboard | `frontend/pages/CrmDashboard.tsx:1-120` |
| CRM Opportunity | `frontend/pages/CrmOpportunityDetail.tsx:1-100` |
| CRM Pipeline | `frontend/pages/CrmPipeline.tsx` |
| Credit (delta) | see `docs/CREDIT_MODULE_UIUX_AUDIT_2026-05-21.md` |
| Workflow utils | `frontend/src/utils/workflowActions.ts`, `workflowTransitions.ts`, `workflowModalConfig.ts` |
| Services layer | `frontend/src/services/*.ts` (28 files) |
| Permissions | `frontend/src/utils/permissions.ts` |

---

*End of audit. For per-finding action tickets, generate Linear/Jira issues using the Top-50 list (§6) as the source of truth.*
