# ENTERPRISE CRM MODULE AUDIT

**Platform:** Citadel Workplace Connect (CWC)  
**Module:** CRM  
**Date:** 28 May 2026  
**Auditor:** AI Enterprise Consultant  
**Version:** Based on live application + codebase analysis (13 CRM Prisma models, 35+ credit models, 21 frontend files ~8,500 lines)  
**Last Updated:** 28 May 2026 — Remediation tracker added; Phases 1 & 2 sprint fixes applied (5 commits)

---

## REMEDIATION TRACKER

> Sprint work completed 28 May 2026 — 5 commits across Phase 1 (Sprints 1–3) and Phase 2 (Sprints 1–2).

| # | Audit Finding | Severity | Sprint | Status |
|---|---------------|----------|--------|--------|
| 1 | Notes tab never fetches existing notes (ContactDetail, AccountDetail) | Critical | Phase 1 S1 | ✅ FIXED — GET `/crm/notes` endpoint added; `listNotes` wired to both detail pages |
| 2 | Silent AI failures — all 9 catch blocks empty | Critical | Phase 1 S1 | ✅ FIXED — Inline error display on LeadDetail, OppDetail, ContactDetail, Dashboard |
| 3 | No Edit modals for any CRM entity | Critical | Phase 1 S1 | ✅ FIXED — Edit modals on all 4 list pages + all 4 detail pages, pre-populated via `cleanFormPayload` |
| 4 | No Delete with confirmation | Critical | Phase 1 S1 | ✅ FIXED — Shared `ConfirmDialog` component; delete buttons on all 8 pages gated by `crm:delete` |
| 5 | No Trust Products UI (model exists, no frontend) | Critical | Phase 1 S2 | ✅ FIXED — Full CRUD tab on CrmAccountDetail (card layout, status badges, create/edit/delete modals) |
| 6 | No Beneficiaries UI (model exists, no frontend) | Critical | Phase 1 S2 | ✅ FIXED — Full CRUD tab on CrmContactDetail (table, allocation bar, NRIC masking, guardian field) |
| 7 | No empty state components | Medium | Phase 1 S2 | ✅ FIXED — `EmptyState` component across all CRM list/detail pages |
| 8 | No loading skeletons on initial page loads | Medium | Phase 1 S2 | ✅ FIXED — `CrmCardSkeleton` + `CrmTableSkeleton` applied to all CRM pages |
| 9 | Kanban lost reason uses native `window.prompt()` | High | Phase 1 S2 | ✅ FIXED — Replaced with `ConfirmDialog` modal (textarea for reason) |
| 10 | KPI cards not clickable / no drill-down from dashboard | High | Phase 1 S3 | ✅ FIXED — Stats Cards, My Performance, Won/Lost cards navigate on click; hover arrow indicator |
| 11 | Weak form validation (HTML `required` only) | Medium | Phase 1 S3 | ✅ FIXED — `crmValidation.ts` with 6 validators; red border + inline errors on all Create/Edit modals |
| 12 | No lead reassignment UI | Critical | Phase 2 S1 | ✅ FIXED — Team Dashboard Actions column with Reassign button; expandable row with owner dropdown + toast |
| 13 | Reports have no charts (7 tabs, tables only) | High | Phase 2 S1 | ✅ FIXED — Recharts added; BarChart/PieChart/donut for LeadConversion, SalesPerformance, PipelineForecast, LeadAging, WinLoss; original tables preserved in collapsible `<details>` |
| 14 | No inline editing on detail pages | High | Phase 2 S1 | ✅ FIXED — `InlineEdit` component (text/number/date/select); applied to overview fields on Lead, Opp, Account, Contact detail pages; owner fields gated by `crm:admin` |
| 15 | No activity reminder/notification system | High | Phase 2 S2 | ✅ FIXED — `reminderSent` field, 15-min cron job, overdue badges on activity list |
| 16 | No bulk operations | High | Phase 2 S2 | ✅ FIXED — `BulkActionBar` component on Leads, Opportunities, Contacts, Accounts |
| 17 | No drill-down from Team Dashboard (cannot click agent) | High | Phase 2 S2 | ✅ FIXED — Clickable agent names expand to show leads, deals, stale leads with drill-down |
| 18 | No mobile-first design | Medium | — | 🔴 OPEN — Tailwind breakpoints only; no mobile nav patterns or touch-optimized interactions |
| 19 | No real-time updates (polling/SSE for CRM data) | Low | — | 🔴 OPEN — Manual page refresh still required |
| 20 | No audit trail for CRM entity changes | High | — | 🔴 OPEN — No field-change log model |
| 21 | No email/calendar integration | High | — | 🔴 OPEN — Phase 3 scope |
| 22 | No workflow automation engine | High | — | 🔴 OPEN — Phase 3 scope |
| 23 | Document Checklist UI missing (API exists) | Medium | — | 🔴 OPEN — Backend only |
| 24 | No bulk merge/duplicate detection UI | Medium | — | 🔴 OPEN — Backend warns on match but no merge flow |
| 25 | No configurable dashboard widgets | Medium | — | 🔴 OPEN — Phase 3 scope |
| 26 | Activity edit/delete missing | Medium | — | 🔴 OPEN — Not yet implemented |
| 27 | No pagination on detail page activity lists | Low | — | 🔴 OPEN — Still loads all items |
| 28 | No import/export tool (CSV) | Medium | — | 🔴 OPEN — Phase 3 scope |

**Summary:** 17 of 28 tracked items resolved (61%). All Critical and most High-severity items from original audit are closed.

---

## SECTION 1 — EXECUTIVE SUMMARY

### Overall Assessment

The CWC CRM is a **functionally solid, domain-specialized CRM** with trust/estate-industry depth that generic CRMs cannot match out-of-the-box. It has a clear data model, meaningful AI integration (10+ features), and a well-structured pipeline engine. However, it suffers from **significant UX gaps in edit/delete flows, underutilized data models (Trust Products, Beneficiaries, Document Checklist), weak form validation, and silent AI error handling** that collectively erode daily sales productivity. The UI is competent but not yet competitive with modern SaaS CRMs.

### Main Strengths

- Domain-specific models (CrmTrustProduct, CrmBeneficiary, CrmKycRecord, BorrowerProfile bridge) — deeply relevant to Malaysian trust/estate/financial services
- 10+ AI features embedded contextually (lead scoring, win probability, daily briefing, KYC gap detection, risk classification, note analysis, message drafting, win/loss debrief, pipeline briefing, document checklist)
- Kanban pipeline with drag-and-drop, collapsible columns, and AI probability badges
- Comprehensive reporting (7 report types with CSV export)
- Strong data model: 13 CRM models, 35+ credit models, polymorphic activities/notes, soft deletes, encrypted PII
- Credit module bridge from CRM Account → BorrowerProfile → CreditApplication — unique vertical integration

### Main Weaknesses

- ~~**Zero edit/delete UI** for any CRM entity~~ ✅ **RESOLVED** — Edit modals + Delete with confirmation on all 8 pages (Phase 1 S1)
- ~~**Silent AI failures**~~ ✅ **RESOLVED** — Inline error display on all AI features (Phase 1 S1)
- ~~**Broken Notes tab**~~ ✅ **RESOLVED** — GET `/crm/notes` backend + `listNotes` frontend wired (Phase 1 S1)
- ~~**No bulk operations**~~ ✅ **RESOLVED** — `BulkActionBar` on Leads, Opportunities, Contacts, Accounts (Phase 2 S2)
- ~~**Weak form validation**~~ ✅ **RESOLVED** — `crmValidation.ts` with 6 validators + inline errors (Phase 1 S3)
- ~~**Missing UI for Trust Products and Beneficiaries**~~ ✅ **RESOLVED** — Full CRUD tabs added (Phase 1 S2). Document Checklist still open.
- **No mobile-first design** — responsive via Tailwind breakpoints but no mobile-specific layout patterns *(still open)*
- **No real-time updates** — requires manual page refresh; no WebSocket or polling for CRM data *(still open)*

### Enterprise Maturity Level

**4.0 / 5** — Operationally capable; Phase 3 enterprise integrations remaining *(was 3.5 pre-sprints)*

### Key Risk Areas

1. **Data quality risk** — no edit UI means stale data accumulates; no dedup/merge tools
2. **User adoption risk** — sales rep friction from missing edit flows creates shadow CRM usage
3. **AI trust risk** — silent failures erode confidence in AI features; users stop using them
4. **Compliance risk** — KYC tab exists but Notes don't persist display; broken audit trail for manual changes
5. **Scalability risk** — no pagination on detail page activity lists; no indexing strategy for large datasets

### Scores

| Metric | Original | Post-Sprints | Change |
|--------|----------|--------------|--------|
| Overall UI | 6.5/10 | 7.5/10 | +1.0 — charts, empty states, skeletons, inline editing |
| Overall UX | 5.5/10 | 7.5/10 | +2.0 — edit/delete flows, notes fix, validation, KPI drill-down |
| Enterprise Readiness | 4.5/10 | 6.0/10 | +1.5 — bulk ops, reassignment, reminders, trust/beneficiary UI |
| Sales Productivity | 5/10 | 7.0/10 | +2.0 — inline edit, reassignment, chart reports, activity reminders |

### Immediate Improvement Priorities (Original)

> All 6 original priorities have been resolved as of 28 May 2026.

1. ~~Fix Notes tab data fetching~~ ✅ DONE
2. ~~Add Edit modals for Leads, Contacts, Accounts, Opportunities~~ ✅ DONE
3. ~~Add user-facing error handling for AI features~~ ✅ DONE
4. ~~Add Trust Products and Beneficiaries UI tabs~~ ✅ DONE
5. ~~Add Delete with confirmation dialogs~~ ✅ DONE
6. ~~Add form validation with error messages~~ ✅ DONE

### Remaining Priorities (Phase 3)

1. Mobile-optimized CrmNav + bottom navigation
2. Audit trail for CRM entity changes
3. Document Checklist UI (API exists)
4. Activity edit/delete
5. Email/calendar integration (Gmail, Outlook)
6. Workflow automation engine

---

## SECTION 2 — UI DESIGN AUDIT

### Visual Design

| Aspect | Assessment | Score |
|--------|------------|-------|
| Visual Hierarchy | Moderate. H1 headings and card headers create some structure, but KPI cards on Dashboard lack differentiation. Data tables blend together. | 6/10 |
| Layout Balance | Acceptable. max-width containers (900-1200px) center content well, but pipeline Kanban is constrained on wider screens. CrmLeadDetail at 961 lines suggests layout sprawl. | 6/10 |
| Whitespace | Adequate. Cards use `p-5` and `rounded-xl`. Gap between sections is consistent. Dashboard hero has good breathing room. | 7/10 |
| Information Density | Low-to-moderate. Dashboard KPIs are sparse (6 accounts, 20 leads). Opportunity table shows 1 row. Reports are tabular with no charts. Kanban cards are concise. | 6/10 |
| Typography | Uses system font (Inter-like). H1, H3, and body sizes create hierarchy. UPPERCASE labels ("OVERALL CONVERSION RATE") are used for KPIs — good for scanability. Consistent. | 7/10 |
| Color System | Uses CSS custom properties (`--color-brand-700`, `--color-danger`, etc.). Consistent brand color. Status badges use semantic colors. However, no design token system documented. | 7/10 |
| Contrast Accessibility | Generally good for body text. Status badges with small text on colored backgrounds may fail WCAG AA. Light gray secondary text on white cards may be borderline. | 6/10 |
| Icon Consistency | Material Symbols Outlined throughout — consistent. Icons are well-chosen (lightbulb for Leads, monetization_on for Opportunities). | 8/10 |
| Card Component Design | Uniform `bg-bg-surface border border-border rounded-xl p-5`. Clean, professional. No variant system (no selected state, hover state, urgency border). | 6.5/10 |
| Modern SaaS Appearance | Professional but generic. Lacks the polish of Salesforce Lightning, HubSpot, or Pipedrive. No micro-animations, no skeleton-to-content transitions, no hover lift effects. | 5.5/10 |
| Enterprise Professionalism | Acceptable for internal use. Malaysian-specific fields (NRIC, trust deed references) add domain credibility. Currency formatting (RM/MYR) is correct. | 7/10 |
| Design Consistency | Good within CRM module. Consistent card patterns, button styles, modal overlays (`bg-black/30 backdrop-blur-sm`). But inconsistent with the main platform Dashboard (which is request-centric). | 6/10 |

### Navigation Design

| Aspect | Assessment | Severity |
|--------|------------|----------|
| Sidebar usability | Deep sidebar (18+ items across all modules). CRM is item #13 under "Tools". Hard to discover for new users. Sidebar auto-hide mitigates clutter. | Moderate |
| CrmNav tab bar | Sticky horizontal 10-item tab bar. Works on desktop but overflows on mobile with `overflow-x-auto` — no hamburger/collapsible. Good active state styling. | Moderate |
| Module discoverability | CRM is buried in a generic "Tools" group alongside IT Assets and Reports. No visual cue that it's a major module. | High |
| Breadcrumbs | Present on all detail pages (`CRM / Leads / [Title]`). Good. But missing on list pages. | Low |
| Navigation overload | 18+ side items + 10 CRM sub-tabs = 28+ navigation points. Cognitive load is high for infrequent users. | High |

### Severity Matrix — UI Issues

| Issue | Severity | Area | Why | Redesign | Business Impact |
|-------|----------|------|-----|----------|-----------------|
| Card hover/selection states missing | Medium | Lead/Opportunity cards | No visual feedback on hover; users unsure if cards are interactive until click | Add box-shadow/transform on hover, border highlight on focus | Click-through rate |
| Status badges too small on mobile | Low | All list views | Badge text is tiny on mobile; cannot scan pipeline status at a glance | Use pill badges with min-width; consider icon+text combo on mobile | Mobile usability |
| ~~No empty state illustrations~~ ✅ FIXED | Medium | All list views | `EmptyState` component added across all CRM list/detail pages | — | User confidence |
| ~~Reports have no charts~~ ✅ FIXED | High | Reports page | Recharts added — BarChart/PieChart/donut across 5 of 7 report tabs; original tables preserved | — | Decision-making speed |
| Kanban cards lack thumbnail/owner avatar | Medium | Pipeline | Cards show text only; no company logo placeholder or owner avatar for quick visual scan | Add avatar circle with initials, company logo placeholder | Scan speed |
| ~~Lost reason uses native browser `prompt()`~~ ✅ FIXED | High | Pipeline | Replaced with `ConfirmDialog` modal (textarea for reason) | — | Professionalism |
| ~~No loading skeleton on initial page loads~~ ✅ FIXED | Medium | Multiple pages | `CrmCardSkeleton` + `CrmTableSkeleton` applied to all CRM pages | — | Perceived performance |

### Dashboard Design

| Aspect | Assessment |
|--------|------------|
| KPI visibility | Hero banner shows 4 KPIs + 2 secondary (Won/Lost values). Good for a quick pulse. But "0% Win Rate" with no won deals is demoralizing for new teams — needs contextual framing. |
| Widget usefulness | "Leads by Status" is useful. "Recent Activity" (1 item) is sparse. "My Performance" section duplicates hero KPIs. AI Daily Briefing is high-value but shows loading state too long. |
| Information prioritization | Dashboard → Leads → Opportunities → Pipeline is the right priority sequence. But "TODAY'S PRIORITIES" section appears to have placeholder content. |
| Actionability | No direct action buttons on dashboard cards (no "Call now" on leads, no "Follow up" on overdue). Dashboard is read-only. Critical gap. |
| Screen space efficiency | ~40% of visible area is sidebar + header + nav tab bar + hero banner. Content-to-chrome ratio is moderate. Below-the-fold content is rarely seen. |

---

## SECTION 3 — UX / USABILITY AUDIT

### Sales Rep Perspective

| Friction Point | Clicks Needed | User Effort | Severity |
|----------------|---------------|-------------|----------|
| Edit a lead | ✅ 2 clicks — Edit button on card or detail page | Low — pre-populated modal | Resolved |
| Delete a lead | ✅ 2 clicks — Delete button + confirmation dialog | Low | Resolved |
| Log a follow-up activity on a lead | 3 clicks (navigate → Activities tab → Log Activity) | Moderate | Medium |
| Convert lead to opportunity | 2 clicks (QUALIFIED status → Convert) | Low | Good |
| Find overdue leads | Auto-highlighted with red "Overdue" badge | None | Excellent |
| See all contacts for an account | Navigate to Account → Contacts tab | Low | Good |
| Add a note to an opportunity | 2 clicks (Notes tab → Add Note) | Low | Good |
| Update opportunity stage | 1 drag on Kanban or "Move Stage" modal | Low | Good |
| Check AI lead score | Auto-loads on LeadDetail | None | Excellent |
| Draft a message via AI | 1 click → select channel → generate | Low | Good |

### Sales Manager Perspective

| Capability | Status | Severity |
|------------|--------|----------|
| See team pipeline overview | Available (Team Dashboard) | Covered |
| See individual rep performance | Available (Agent Performance table) | Covered |
| Forecast view | Available (Reports → Pipeline Forecast tab) | Partial |
| Assign/reassign leads | ✅ **Implemented** — Team Dashboard reassign button with owner dropdown | Resolved |
| Approve/reject deals | **Missing** — no approval workflow in CRM | **High** |
| Compare rep activity levels | Partial — Activity Summary report shows by-agent table but no comparison visualization | Medium |
| AI manager briefing | Available but generates on-demand (not auto-refreshed) | Low |
| Drill-down from aggregate to detail | ✅ **Implemented** — KPI cards navigate on click; Team Dashboard agent rows expand to show deals/leads | Resolved |

### Credit Team Perspective

| Capability | Status | Severity |
|------------|--------|----------|
| View KYC status on a contact | Available (ContactDetail → KYC tab) | Covered |
| AI KYC gap detection | Available (auto-loads on KYC tab) | Covered |
| AI risk classification | Available (auto-loads on KYC tab) | Covered |
| Bridge from CRM to Credit module | Available (AccountDetail → Credit tab) | Covered |
| Initiate credit application from CRM | **Missing** — only a link to `/credit/borrowers?accountId=X` | Medium |
| View trust product details | ✅ **Implemented** — Trust Products tab on AccountDetail with full CRUD | Resolved |
| View/manage beneficiaries | ✅ **Implemented** — Beneficiaries tab on ContactDetail with full CRUD | Resolved |

### UX Severity Matrix

| Severity | Issues | Status |
|----------|--------|--------|
| Critical | ~~No edit flows for any entity~~; ~~No delete flows~~; ~~Notes tab broken~~; ~~No lead reassignment~~; ~~No trust product/beneficiary UI~~ | ✅ All Resolved |
| High | ~~No bulk operations~~; ~~Silent AI error handling~~; ~~No drill-down from KPIs~~; ~~Reports tables-only (no charts)~~; ~~Native `prompt()` for lost reason~~ | ✅ All Resolved |
| High (open) | No audit trail for CRM entity changes; Activity edit/delete missing | 🔴 Open |
| Medium | ~~Weak form validation~~; ~~No empty state illustrations~~; ~~No loading skeletons~~; CrmNav overflows on mobile | Partially resolved — mobile nav still open |
| Low | No optimistic updates; AI features not cached (except daily briefing); ~~Pagination missing~~ Activity list pagination still open | 🔴 Partially open |

### Quick Wins (High Impact, Low Effort)

1. **Fix Notes tab fetching** — 30-minute fix, restore `listNotes` API call
2. **Add Edit buttons** — Reuse Create modal, pre-populate with existing data
3. **Toast on AI failure** — Replace `catch {/* */}` with `catch(e) => toast.error(e.message)`
4. **Empty state components** — Add to all list views with contextual CTAs
5. **Charts in Reports** — Add Recharts bar/pie charts (library likely already available)

---

## SECTION 4 — USER JOURNEY AUDIT

### Sales Representative Journey

**Current Journey (As-Is):**

```
Login → Dashboard (see KPIs) → Click Leads → Browse card list → 
Click a lead → See lead detail → (CANNOT EDIT) → 
Click Activities → Log Activity → Go back → 
Check Pipeline → Drag cards → (CANNOT EDIT deal details) → 
Search for contact → (CANNOT EDIT contact) → 
Draft message via AI → (IF AI FAILS, no feedback) →
```

**Friction Points:**
- 3+ clicks to log a simple follow-up
- No way to edit any record in-place
- No "My Today" focused view — must scan full dashboard
- No activity reminder/notification system
- No quick-action from dashboard KPIs

**Optimized Journey (To-Be):**

```
Login → AI Daily Briefing (auto-loaded) → 
See "3 leads need follow-up today" → Click → Direct to lead with draft message → 
One-click "Log follow-up call" → 
Pipeline view shows probability changes in real-time → 
Click overdue deal → Inline edit to update value → Save
```

**Key Additions Needed:**
- Inline editing or quick-edit modals on all entities
- Dashboard "Today's Priorities" should link directly to action items
- Activity reminders with push/SSE notifications
- Quick-log floating action button (FAB) exists on LeadDetail — extend globally

### Sales Manager Journey

**Current Journey (As-Is):**

```
Login → CRM Dashboard → Switch to Team tab → See agent table → 
(No drill-down to individual deals) → 
Switch to Reports → Select tab → Set date range → Export CSV →
(No trend visualization) → 
(No lead assignment) → 
(No deal approval queue)
```

**Visibility Gaps:**
- Cannot click an agent's name to see their pipeline
- Cannot reassign leads from the team view
- No quota vs. attainment tracking
- No trend charts (week-over-week, month-over-month)
- Pipeline forecast is a table, not a visual funnel or burndown

**Optimized Manager Workflow:**

```
Login → Manager Dashboard (auto-loaded AI briefing) →
See "2 at-risk deals" → Click → See deal detail with risk factors →
Click "Reassign" on stale leads → Assign to top performer →
View pipeline funnel chart → Drill down by stage →
Export to PDF for board meeting
```

**Key Additions Needed:**
- Clickable agent names → agent's pipeline view
- Reassignment UI on Team Dashboard
- Quota/territory targets model (currently missing in Prisma schema)
- Visual funnel chart for pipeline forecast
- Trend sparklines on KPI cards

### Credit Team Journey

**Current Journey (As-Is):**

```
CRM → Accounts → Select account → Credit tab → 
Link to Credit module (separate navigation) →
Credit app list → Select application → Full credit workflow
```

**Workflow Delays:**
- Context switch between CRM and Credit modules (different nav, different mental model)
- No inline KYC approval from CRM — must navigate to separate module
- No trust product management from CRM despite model existing
- No beneficiary management from CRM despite model existing

**Optimized Credit Workflow:**

```
CRM → Accounts → Select account → Credit tab →
Inline KYC approval (CRM) →
Inline trust product management (CRM) →
Create credit application (CRM Credit tab) →
Auto-populate from account/contact data →
Seamless transition to full Credit module for underwriting
```

---

## SECTION 5 — FEATURE AUDIT

### Lead Management

| Capability | Status | Assessment |
|------------|--------|------------|
| Lead capture | **Exists** — Create Lead modal with all fields | Good |
| Lead assignment | ✅ **Exists** — ownerId at creation + reassignment via Team Dashboard | Resolved |
| Lead routing | **Missing** — No round-robin, territory, or rules-based routing | Missing |
| Lead aging | **Exists** — "Overdue" / "Stale" / "Due Today" badges | Good |
| Lead source tracking | **Exists** — 8 sources (WEBSITE, REFERRAL, etc.) + filter | Good |
| Lead prioritization | **Exists** — AI Score with color coding | Good |
| Lead scoring | **Exists** — AI Lead Score (0-100) with reason text | Good |
| Duplicate prevention | **Partial** — Warns on email/phone match but no merge UI | Needs work |
| Lead conversion | **Exists** — QUALIFIED → Convert to Opportunity | Good |
| Lead edit | ✅ **Exists** — Edit modal on list page + detail page | Resolved |
| Lead delete | ✅ **Exists** — Delete with ConfirmDialog, gated by `crm:delete` | Resolved |
| Lead bulk actions | ✅ **Exists** — BulkActionBar with multi-select | Resolved |

### Opportunity Management

| Capability | Status | Assessment |
|------------|--------|------------|
| Pipeline stages | **Exists** — Configurable pipelines with stages | Good |
| Deal tracking | **Exists** — Full CRUD + Kanban + list view | Good |
| Opportunity health | **Partial** — AI Win Probability exists, but no health score/at-risk indicator | Needs work |
| Follow-up reminders | **Missing** — No reminder system linked to activities | Missing |
| Deal probability | **Exists** — Manual + AI probability | Good |
| Forecasting | **Partial** — Reports show pipeline by stage, not weighted forecast | Needs work |
| Pipeline aging | **Missing** — No "days in stage" indicator on deal cards | Missing |
| Deal risk indicators | **Partial** — Win Probability serves as risk proxy, no dedicated risk model | Needs work |
| Opportunity edit | ✅ **Exists** — Edit modal on list page + detail page | Resolved |
| Opportunity delete | ✅ **Exists** — Delete with ConfirmDialog, gated by `crm:delete` | Resolved |
| Win/Loss debrief | **Exists** — AI debrief for closed deals | Good |
| Stage history | **Exists** — Full stage transition timeline | Good |

### Account & Contact Management

| Capability | Status | Assessment |
|------------|--------|------------|
| Customer 360 | **Partial** — Account has Contacts, Deals, Activities, Notes, Credit tab; but no unified timeline | Needs work |
| Relationship mapping | **Missing** — No org chart or relationship map | Missing |
| Communication tracking | **Partial** — Activities log CALL/EMAIL/WHATSAPP, but no email sync or inbound tracking | Needs work |
| Organization structure | **Missing** — No hierarchy (parent company, subsidiaries) | Missing |
| Account history | **Partial** — Activity log exists but not full change audit | Needs work |
| Account edit | ✅ **Exists** — Edit modal on list page + detail page | Resolved |
| Contact edit | ✅ **Exists** — Edit modal on list page + detail page | Resolved |
| Contact delete | ✅ **Exists** — Delete with ConfirmDialog, gated by `crm:delete` | Resolved |
| Trust Products tab | ✅ **Exists** — Full CRUD tab on AccountDetail | Resolved |
| Beneficiaries tab | ✅ **Exists** — Full CRUD tab on ContactDetail | Resolved |

### Activity Management

| Capability | Status | Assessment |
|------------|--------|------------|
| Calls | **Exists** — Log CALL activity | Basic |
| Meetings | **Exists** — Log MEETING activity | Basic |
| Tasks | **Exists** — Log TASK activity | Basic |
| Notes | **Exists** — Add note on any entity | Basic |
| Timeline tracking | **Exists** — Activity type icons + chronological list | Good |
| Calendar integration | **Missing** — No iCal/Google Calendar sync | Missing |
| Reminder system | **Missing** — No notification for scheduled activities | Missing |
| Activity edit/delete | **Missing** | Missing |
| Quick-log FAB | **Exists** on LeadDetail only | Partial |

### Reporting & Analytics

| Report | Visualization | Assessment |
|--------|---------------|------------|
| Lead Conversion | ✅ BarChart by source + PieChart by status (table preserved) | Resolved |
| Sales Performance | ✅ BarChart by owner (won/lost deals) (table preserved) | Resolved |
| Pipeline Forecast | ✅ Horizontal BarChart funnel by stage (table preserved) | Resolved |
| Activity Summary | Table + bar chart (by type) | Acceptable |
| Lead Aging | ✅ Stacked BarChart by age buckets >30d/>60d/>90d (table preserved) | Resolved |
| Win/Loss | ✅ Donut PieChart (won vs lost) + BarChart (lost reasons) (table preserved) | Resolved |
| KYC Compliance | Status chips, expiring list, PEP flagged | Good |

**Missing Reports:**
- Revenue trend (monthly/quarterly)
- Rep leaderboard with activity metrics
- Deal velocity (average days in stage)
- Lead source ROI (cost per conversion)
- Customer retention/churn
- Forecast accuracy (predicted vs. actual)

---

## SECTION 6 — AI ENHANCEMENT AUDIT

### Current AI Features (10+)

| Feature | Location | Hook/Service | Business Value | Maturity |
|---------|----------|--------------|-----------------|----------|
| AI Lead Score | LeadDetail | `useLeadScore` | High — tells reps which leads to prioritize | Implemented, silent failures |
| AI Win Probability | OppDetail, OppList, Kanban | `useWinProbability` | High — shows deal health at a glance | Implemented |
| AI Daily Briefing | CrmDashboard | `useDailyBriefing` | High — reduces morning prep time | Implemented, cached in sessionStorage |
| AI Note Analyzer | LeadDetail, OppDetail | `useAnalyzeNote` | Medium — extracts insights from call notes | Implemented |
| AI Draft Message | LeadDetail, ContactDetail | `useDraftMessage` | High — saves rep time on follow-ups | Implemented, supports WhatsApp/Email |
| AI Lead Summary | LeadDetail | `useLeadSummary` | Medium — auto-summarizes lead context | Implemented |
| AI KYC Gap Detector | ContactDetail | `useKycGaps` | High — compliance risk reduction | Implemented |
| AI Risk Classification | ContactDetail | `useRiskProfile` | High — automates risk assessment | Implemented |
| AI Manager Briefing | TeamDashboard | `getManagerBriefing` | Medium — gives managers at-a-glance | Implemented, on-demand only |
| AI Win/Loss Debrief | OppDetail | `getWinLossDebrief` | High — learning from won/lost deals | Implemented |
| Document Checklist | API only | `getDocumentChecklist` | High — compliance automation | **No UI** |

### Recommended AI Enhancements

| AI Feature | Business Value | Complexity | Data Required | Priority | Risk |
|------------|---------------|------------|----------------|----------|------|
| **AI Next Best Action** | Very High — guides reps on what to do next | Medium | Activity history + deal stage + time patterns | P1 | Low — activity data exists |
| **AI Pipeline Anomaly Detection** | High — flags at-risk deals before they're lost | Medium | Historical stage dwell times + win rates | P1 | Medium — needs historical data |
| **AI Activity Reminder Generation** | High — ensures no follow-up falls through | Low | Activities + follow-up dates | P1 | Low — simple pattern match |
| **AI Relationship Intelligence** | Very High — maps influence networks | High | Email + meeting + org data (not yet collected) | P2 | High — needs email/calendar integration |
| **AI Forecasting (Weighted Pipeline)** | High — improves forecast accuracy | Medium | Deal values × AI probabilities | P2 | Low — data exists |
| **AI Customer Sentiment** | Medium — from activity notes | Medium | Note text + activity descriptions | P2 | Medium — requires NLP training |
| **AI Auto-Duplicate Detection** | High — prevents data rot | Medium | All lead/contact fields | P2 | Low — pattern matching |
| **AI Email Summarization** | Medium — saves reading time | High | Email integration (not yet available) | P3 | High — needs email sync |
| **AI Lead Scoring Explainability** | Medium — builds trust in AI | Low | Same data as lead score | P3 | Low — add explanation panel |
| **AI Quota Tracking** | Medium — motivates reps | Medium | Closed won values + targets (targets not in model) | P3 | Medium — needs quota model |

---

## SECTION 7 — MOBILE RESPONSIVENESS AUDIT

| Aspect | Assessment | Score |
|--------|------------|-------|
| Mobile browser experience | Functional but not optimized. Tailwind breakpoints (`sm:`, `md:`) provide basic responsiveness. Kanban horizontally scrolls. Tables overflow. Forms work but are cramped. | 4/10 |
| Tablet experience | Acceptable. Cards reflow from 3-col to 2-col. Modals use `max-w-lg mx-4`. Reports tables are readable. | 6/10 |
| Sidebar responsiveness | Left rail has auto-hide toggle. On mobile, it should be a hamburger drawer. Current `lock_open` toggle is desktop-only pattern. | 4/10 |
| Table responsiveness | Some tables have `overflow-x-auto` (Opportunities, Team). Others don't (Reports). Cards on small screens are single-column. | 5/10 |
| Form usability on mobile | Create modals use `max-w-lg` which is 32rem — works on phones in portrait. But dropdowns/selects are native HTML `<select>` which have acceptable mobile UX. Date inputs use native spinbuttons — functional but ugly. | 5/10 |
| Touch interactions | Kanban drag-and-drop works with mouse. No explicit touch event handling. Cards use `cursor:pointer` which is mouse-centric. | 4/10 |
| Mobile navigation | CrmNav uses `overflow-x-auto` with hidden scrollbar — works but 10 tabs require horizontal scrolling on mobile with no visual indicator of off-screen tabs. No hamburger/collapsible variant. | 4/10 |
| Performance on slower devices | No lazy loading on images. No virtual scrolling for long lists (20 leads shown, but no infinite scroll). | 5/10 |

### Mobile-First Redesign Priorities

1. Bottom navigation bar for CRM (Dashboard / Pipeline / Add / Activities / Profile)
2. Collapsible CrmNav with hamburger on mobile
3. Card-based list views instead of tables on mobile
4. Swipe gestures for Kanban (instead of drag)
5. Floating Action Button for quick-add on mobile
6. Infinite scroll or "Load More" button for all list views

---

## SECTION 8 — PERFORMANCE & ENTERPRISE READINESS

### Scalability

| Concern | Assessment | Risk |
|---------|------------|------|
| Data growth | Activity/Note tables will grow rapidly. No pagination on detail page lists. Indexes exist on key fields but no composite indexes for common queries. | Medium |
| Multi-team readiness | `ownerId` is a single user. No team/territory ownership model. No sharing/visibility rules. Admin sees all; others see own data only. | High |
| Workflow scalability | No workflow automation engine. Stage transitions are manual (drag or dropdown). No trigger rules (e.g., "auto-create task when stage changes"). | High |
| Modular architecture | CRM module is well-separated (separate routes, service, hooks). But `crm.service.ts` is a monolithic 510-line service object. Could be split by entity. | Low |
| Long-term maintainability | Large page files (CrmLeadDetail: 961 lines, CrmReports: 775 lines). No shared sub-components for common patterns (entity detail, activity timeline). | Medium |
| Enterprise operational readiness | No audit logging for CRM entity changes. No data import/export (except CSV on reports). No webhook/API for external integration. | High |

### UI Scalability Concerns

| Concern | Impact |
|---------|--------|
| 10 CrmNav tabs + adding Trust Products, Beneficiaries = 12+ tabs | Horizontal tab bar will overflow more on mobile |
| No permission-based column visibility on tables | As roles increase, all users see all columns |
| No configurable dashboard widgets | Dashboard content is hardcoded, not user-customizable |
| No list view settings (columns, sort, page size) | Users cannot customize their workspace |

### Enterprise Maturity Assessment

| Dimension | Level (1-5) | Notes |
|-----------|-------------|-------|
| Data Model | 4 | Comprehensive with 13 CRM + 35+ credit models. Missing: tasks, campaigns, quotes, custom fields |
| API Completeness | 4 | Full CRUD + AI + Reports + Automation endpoints. Missing: batch/bulk, webhook |
| UI Feature Coverage | 2.5 | Good listing/creation, but missing edit/delete/bulk for all entities. 3 models have no UI |
| Security & Permissions | 3 | Role-based access (`crm:read`, `crm:admin`), but no field-level security, no sharing rules |
| Integration | 2 | No email sync, no calendar sync, no webhook outbound, no import tool |
| Reporting | 3 | 7 report types but all tables. Missing charts, scheduled delivery, PDF export |
| AI | 4 | 10+ contextual AI features. Strong breadth, but silent error handling |
| Mobile | 2 | Basic responsiveness only. No mobile-optimized workflows |

---

## SECTION 9 — BENCHMARK AGAINST MODERN CRM PLATFORMS

| Dimension | CWC CRM | Salesforce | HubSpot | Pipedrive | Gap |
|-----------|---------|-----------|---------|-----------|-----|
| UI Quality | 6.5/10 | 8/10 | 9/10 | 8.5/10 | Needs polish: hover states, empty states, charts |
| UX Flow | 5.5/10 | 7.5/10 | 8.5/10 | 9/10 | Missing edit/delete, inline editing, quick actions |
| Workflow Efficiency | 5/10 | 8/10 | 7/10 | 9/10 | Too many clicks for basic operations |
| AI Capabilities | 8/10 | 7/10 | 6/10 | 5/10 | **Strength**: More contextual AI features than most |
| Dashboard Quality | 6/10 | 8.5/10 | 8/10 | 7.5/10 | Not configurable, no drill-down, no charts |
| Enterprise Readiness | 4.5/10 | 9.5/10 | 7/10 | 5/10 | Missing: audit, sharing rules, import/export, workflows |
| Mobile Experience | 4/10 | 7/10 | 7.5/10 | 7/10 | No mobile-specific design |
| Reporting/Analytics | 5/10 | 9/10 | 8/10 | 6.5/10 | Tables only, no charts, no scheduled reports |

### Patterns to Adopt

- **Pipedrive**: Single-column Kanban with deal details in side panel (not full page navigation). Activity-centric design.
- **HubSpot**: Inline editing everywhere. Click any field to edit in-place. Predictive deal health scores with visual indicators.
- **Salesforce**: Configurable dashboard widgets. Field-level security. Audit trails on every entity change.
- **HubSpot**: Activity feed with email sync. Timeline view as primary dashboard element.

### Competitive Strengths

- Domain-specific trust/estate models (CrmTrustProduct, CrmBeneficiary, KYC) — no CRM has this natively
- Integrated credit assessment bridge — unique vertical integration
- Malaysian-specific PII handling (NRIC encryption, PDPA consent tracking)
- Contextual AI features embedded directly in entity detail pages

### Competitive Weaknesses

- No inline editing (Salesforce, HubSpot, Pipedrive all have this)
- No email/calendar integration (all competitors have this)
- No workflow automation engine (Salesforce Flows, HubSpot Workflows)
- No custom fields or custom objects (all competitors)
- No mobile app / mobile-optimized experience

---

## SECTION 10 — DASHBOARD-SPECIFIC AUDIT

| Aspect | Assessment |
|--------|------------|
| KPIs are actionable | **No.** KPI numbers are display-only. Clicking "20 Open Leads" does not navigate to leads list. No action buttons. |
| Users can prioritize work quickly | **Partially.** "Today's Priorities" section exists but shows placeholder content. AI Daily Briefing helps but requires waiting for generation. |
| Dashboard improves productivity | **Marginally.** Rep must still navigate to Leads/Opportunities to take action. No quick-log or inline create from dashboard. |
| Dashboard supports decision making | **Weakly.** No trend charts. No comparison views. No forecast confidence intervals. Tables only. |
| Dashboard helps sales reps take action | **No.** No "Call now" or "Send email" buttons. No one-click follow-up. Dashboard is read-only. |
| Dashboard supports managers | **Partially.** Team Dashboard shows agent performance table but no drill-down, no trend lines, no comparison charts. |

### Wasted Space

- "My Performance" section duplicates 4 metrics already in the hero banner (My Leads, My Pipeline, Won This Month — already shown above)
- "Lost Deals RM0" takes equal visual weight to "Pipeline Value RM320,000"
- Below-the-fold space is underutilized

### Missing KPIs

- Average deal cycle time
- Activities per deal (rep activity velocity)
- Forecast vs. actual (quota attainment)
- Pipeline change (new/closed/moved this week)
- Follow-up completion rate
- Lead response time (time from creation to first contact)

---

## SECTION 11 — PRIORITIZED IMPROVEMENT ROADMAP

> **Status as of 28 May 2026:** Phases 1 and 2 (items 1–17) fully completed across 5 sprint commits. Items 18–30 remain open.

### PHASE 1 — QUICK WINS ✅ COMPLETE

| # | Improvement | Status | Delivered In |
|---|-------------|--------|-------------|
| 1 | Fix Notes tab (fetch existing notes) | ✅ Done | Phase 1 Sprint 1 |
| 2 | Add inline error handling for AI failures | ✅ Done | Phase 1 Sprint 1 |
| 3 | Add Edit modals (Lead, Contact, Account, Opportunity) | ✅ Done | Phase 1 Sprint 1 |
| 4 | Add Delete with confirmation dialogs | ✅ Done | Phase 1 Sprint 1 |
| 5 | Add Trust Products tab to AccountDetail | ✅ Done | Phase 1 Sprint 2 |
| 6 | Add Beneficiaries tab to ContactDetail | ✅ Done | Phase 1 Sprint 2 |
| 7 | Add empty state components | ✅ Done | Phase 1 Sprint 2 |
| 8 | Add loading skeletons on all pages | ✅ Done | Phase 1 Sprint 2 |
| 9 | Replace native `prompt()` with modal (pipeline lost reason) | ✅ Done | Phase 1 Sprint 2 |
| 10 | Add KPI click-through (dashboard → list) | ✅ Done | Phase 1 Sprint 3 |

### PHASE 2 — MID-LEVEL IMPROVEMENTS ✅ COMPLETE (items 11–17) / 🔄 PARTIAL (items 18–20)

| # | Improvement | Status | Delivered In |
|---|-------------|--------|-------------|
| 11 | Inline editing on detail pages | ✅ Done | Phase 2 Sprint 1 |
| 12 | Chart visualizations in Reports | ✅ Done | Phase 2 Sprint 1 |
| 13 | Lead reassignment UI | ✅ Done | Phase 2 Sprint 1 |
| 14 | Activity reminder/notification system | ✅ Done | Phase 2 Sprint 2 |
| 15 | Bulk operations (select, update, assign) | ✅ Done | Phase 2 Sprint 2 |
| 16 | Drill-down from Team Dashboard | ✅ Done | Phase 2 Sprint 2 |
| 17 | Form validation with error messages | ✅ Done | Phase 1 Sprint 3 |
| 18 | Mobile-optimized CrmNav (hamburger) | 🔴 Open | — |
| 19 | Document Checklist UI | 🔴 Open | — |
| 20 | Configurable list view (columns, sort, page size) | 🔴 Open | — |

### PHASE 3 — NEXT SPRINT PRIORITIES (carry-forward + promotions)

> Items 18–19 promoted to next sprint due to compliance and mobile usability impact. Items 28 (audit trail) and 26 (AI Next Best Action) promoted from original Phase 3 based on current priority reassessment.

| # | Improvement | Priority | Business Impact | UX Impact | Complexity | Effort | Risk |
|---|-------------|----------|----------------|----------|------------|--------|------|
| 18 | Mobile-optimized CrmNav (hamburger/collapsible) | P1 | Medium — mobile usability | Medium | Medium | 3 days | Low |
| 19 | Document Checklist UI (API already exists) | P1 | High — compliance, trust/estate onboarding | Medium | Medium | 5 days | Low |
| 28 | Audit trail for CRM entity changes | P1 | High — compliance, KYC/trust data changes untracked | Low | Medium | 2 weeks | Low |
| A | Activity edit/delete | P1 | Medium — data quality | Medium | Low | 2 days | None |
| B | Detail page activity list pagination | P1 | Medium — performance at scale | Low | Low | 1 day | None |
| C | Fix `CrmOpportunities` form `as any` TypeScript cast | P1 | Medium — type safety in edit/create | Low | Low | 0.5 day | None |
| D | Reports date picker component | P2 | Low–Medium — manager usability | Medium | Low | 1 day | None |
| 26 | AI Next Best Action | P2 | Very High — rep productivity | Very High | High | 3-4 weeks | Medium |
| 20 | Configurable list view (columns, sort, page size) | P2 | Medium — personalization | Medium | Medium | 5 days | Low |

### PHASE 4 — ENTERPRISE ENHANCEMENTS (4-8 weeks each)

| # | Improvement | Priority | Business Impact | UX Impact | Complexity | Effort | Risk |
|---|-------------|----------|----------------|----------|------------|--------|------|
| 21 | Workflow automation engine (triggers, actions) | P1 | Very High — operational efficiency | High | Very High | 4-6 weeks | High |
| 22 | Email/calendar integration (Gmail, Outlook) | P1 | Very High — activity tracking | Very High | Very High | 4-6 weeks | High |
| 23 | Import/Export tool (CSV, Excel) | P2 | Medium — data migration | Medium | Medium | 2 weeks | Low |
| 24 | Configurable dashboard widgets | P2 | High — personalization | High | High | 3-4 weeks | Medium |
| 25 | Custom fields/objects | P2 | High — extensibility | Medium | Very High | 6-8 weeks | High |
| 27 | AI Pipeline Anomaly Detection | P2 | High — deal health | High | High | 3-4 weeks | Medium |
| 29 | Territory/quotas model + UI | P2 | High — enterprise sales ops | Medium | High | 3-4 weeks | Medium |
| 30 | Mobile-first redesign (bottom nav, swipe, FAB) | P2 | High — field sales | Very High | Very High | 6-8 weeks | Medium |

---

## SECTION 12 — FINAL SCORECARD

| Dimension | Original | Post-Sprints | Key Driver |
|-----------|----------|--------------|------------|
| UI Design | 6.5/10 | **7.5/10** | Charts, empty states, skeletons, inline editing added. Hover states still missing. |
| UX | 5.5/10 | **7.5/10** | Edit/delete flows, Notes fix, form validation, KPI drill-down all resolved. |
| Mobile Experience | 4/10 | **4/10** | Unchanged — no mobile-specific design work yet. |
| Sales Productivity | 5/10 | **7.0/10** | Inline editing, reassignment, chart reports, activity reminders all added. |
| Dashboard Effectiveness | 5.5/10 | **7.0/10** | KPI click-through added; team drill-down added. Still no configurable widgets. |
| Enterprise Readiness | 4.5/10 | **6.0/10** | Bulk ops, trust/beneficiary UI, reminders added. Audit trail, import/export still open. |
| AI Readiness | 8/10 | **8.5/10** | Silent failures fixed. 10+ features remain strong. |
| Workflow Efficiency | 5/10 | **7.5/10** | Edit, delete, bulk, assign all resolved. Approve workflow still missing. |
| Feature Completeness | 6/10 | **7.5/10** | Edit/delete/bulk for all entities + trust products + beneficiaries + charts done. |
| Scalability | 5.5/10 | **5.5/10** | Unchanged — no team/territory model or composite index work. |

### Final Overall Score: 5.5/10 → **7.0/10** (post-sprints)

### Enterprise Maturity Assessment

**Growth Stage** *(was Early Growth Stage)*

- Data model is robust and domain-specialized (strength — unchanged)
- ~~Feature depth is shallow (cannot edit what you create)~~ ✅ Edit/delete/bulk/inline editing all implemented
- AI integration is ahead of most CRM competitors (strength — enhanced with error handling)
- ~~Operational workflows incomplete~~ ✅ Edit, delete, bulk, assign all resolved. Approve workflow still open.
- Enterprise capabilities (audit trail, import/export, email integration, custom fields) remain absent (Phase 3 gap)

### Top 10 Critical Improvements (Current — as of 28 May 2026)

> All original 10 items resolved. List refreshed to reflect current open priorities.

| # | Improvement | Severity | Business Impact |
|---|-------------|----------|----------------|
| 1 | **Audit trail for CRM entity changes** | High | Compliance risk — no field-change log for any entity; KYC/trust data edits are invisible and unauditable |
| 2 | **Document Checklist UI** | High | API already exists; domain-critical for trust/estate onboarding; currently backend-only |
| 3 | **Activity edit/delete** | Medium | Users cannot correct a wrongly logged call/meeting; data quality degrades over time |
| 4 | **Mobile-first CrmNav** | Medium | 10-tab bar overflows on mobile; no hamburger/collapsible; field sales reps blocked |
| 5 | **Fix `CrmOpportunities` form `as any` TypeScript cast** | Medium | Silent type safety hole in edit/create flow; could mask field mapping bugs |
| 6 | **Detail page activity list pagination** | Medium | All records load unbounded — performance degrades as data grows; no server-side limit |
| 7 | **Reports date picker component** | Low–Medium | Manual from/to state is fragile; no date range validation; error-prone for managers |
| 8 | **AI Next Best Action** | High | Highest-ROI AI feature not yet built; all required data (activities, stage, time) already exists |
| 9 | **Email/calendar integration (Gmail/Outlook)** | High | Biggest competitive gap vs HubSpot/Pipedrive; blocks automatic communication tracking |
| 10 | **Workflow automation engine** | High | No trigger rules on stage transitions; pipeline management is entirely manual |

---

## APPENDIX A — CRM Data Model Summary

### Core CRM Models (13)

| Model | Table | Key Fields |
|-------|-------|------------|
| CrmAccount | crm_accounts | name, industry, companySize, website, phone, email, address fields, annualRevenue, registrationNumber, taxNumber, bankAccount, purchaseCashTrust, accountType, ownerId |
| CrmContact | crm_contacts | accountId, firstName, lastName, email, phone, mobile, jobTitle, department, isPrimary, followUpDate, nricPassport, dateOfBirth, pdpaConsent, marketingOptIn, riskProfile |
| CrmLead | crm_leads | title, status (LeadStatus), source (LeadSource), accountId?, contactId?, ownerId, contactName/Email/Phone, companyName, estimatedValue, lostReason, convertedAt, convertedToOppId, aiScore, aiScoreReason |
| CrmPipeline | crm_pipelines | name, description, isDefault, isActive |
| CrmPipelineStage | crm_pipeline_stages | pipelineId, name, displayOrder, probability, color, isWonStage, isLostStage |
| CrmOpportunity | crm_opportunities | name, accountId, contactId?, pipelineId, stageId, ownerId, value, currency, probability, expectedCloseDate, lostReason, wonAt, lostAt, aiWinProbability, aiWinReason |
| CrmOpportunityStageHistory | crm_opportunity_stage_history | opportunityId, fromStageName, toStageName, movedByUserId, movedAt |
| CrmActivity | crm_activities | activityType (CrmActivityType), subject, description, userId, accountId?, contactId?, leadId?, opportunityId?, scheduledAt, completedAt, durationMinutes, metadata (JsonB) |
| CrmNote | crm_notes | content, authorId, accountId?, contactId?, leadId?, opportunityId?, isPinned |
| CrmAccountRequest | crm_account_requests | accountId, requestId (junction: CRM ↔ Service Desk) |
| CrmBeneficiary | crm_beneficiaries | contactId, firstName, lastName, relationship, allocationPct, email, phone, nricPassport, dateOfBirth, isMinor, guardianName |
| CrmTrustProduct | crm_trust_products | accountId, contactId?, opportunityId?, trustType, deedRefNumber, status, assetValue, currency, assetDescription, trusteeName, trusteeContact, settlementDate, maturityDate, nextReviewDate, ownerId |
| CrmKycRecord | crm_kyc_records | contactId (1:1), status, riskLevel, isPep, nricVerified, addressVerified, incomeVerified, sourceOfFundsVerified, riskProfileDone, approvedBy, expiresAt, amlRiskTier, screeningStatus, screeningHits |

### Enums

| Enum | Values |
|------|--------|
| LeadStatus | NEW, CONTACTED, QUALIFIED, UNQUALIFIED, CONVERTED, LOST |
| LeadSource | WEBSITE, REFERRAL, COLD_CALL, TRADE_SHOW, LINKEDIN, ADVERTISEMENT, PARTNER, OTHER |
| OpportunityStage | PROSPECTING, QUALIFICATION, PROPOSAL, NEGOTIATION, CLOSED_WON, CLOSED_LOST |
| CrmActivityType | CALL, EMAIL, MEETING, NOTE, TASK, FOLLOW_UP, WHATSAPP, SITE_VISIT |

### Missing Models (Enterprise Gaps)

1. Task/Todo model — no dedicated task assignment with assignee, due date, status
2. Campaign model — no marketing/outreach campaign tracking
3. Product catalog — trust products are ad-hoc; no structured product/service catalog
4. Quote/Proposal — no formal proposal or quote document model
5. Contract/Terms — no contract model for executed agreements
6. Communication/Email template — no email template or mail-merge system
7. Import/Export audit — no data import history model
8. Sharing/visibility rules — no team/object permission model beyond ownerId
9. Tag/custom field — no extensible tagging or custom field definitions
10. Pipeline stage automation — no workflow automation or trigger rules for stage transitions
11. Activity reminder/notification — no CrmActivity-to-Notification linkage
12. Territory/routing rules — no territory-based lead/opportunity assignment
13. Interaction/thread model — no conversation threading for email/call logs
14. Attachment/file model — no CrmAttachment for linking files to entities
15. Revision/history model — no field-change audit log for CRM entities
16. Lead queue/round-robin — no lead distribution or assignment queue
17. Forecasting — no pipeline forecasting or quota/territory target model
18. Duplicate detection/merge — no model for tracking merged/duplicate records
19. Customer satisfaction/NPS — no post-transaction feedback model

---

## APPENDIX B — CRM Frontend File Inventory

| File | Lines | Size | Role |
|------|-------|------|------|
| pages/CrmDashboard.tsx | ~462 | 27KB | CRM Dashboard home |
| pages/CrmLeads.tsx | ~439 | 25.6KB | Lead listing + create |
| pages/CrmLeadDetail.tsx | ~961 | 52.9KB | Lead detail (largest file) |
| pages/CrmAccounts.tsx | ~204 | 13KB | Account listing + create |
| pages/CrmAccountDetail.tsx | ~363 | 21KB | Account detail (with credit bridge tab) |
| pages/CrmContacts.tsx | ~298 | 19KB | Contact listing + create |
| pages/CrmContactDetail.tsx | ~640 | 28.3KB | Contact detail with KYC, AI features |
| pages/CrmOpportunities.tsx | ~297 | 20.1KB | Opportunity listing + create |
| pages/CrmOpportunityDetail.tsx | ~542 | 30.7KB | Opp detail, AI, stage history |
| pages/CrmPipeline.tsx | ~356 | 19.5KB | Kanban pipeline view |
| pages/CrmTeamDashboard.tsx | ~275 | 13.2KB | Manager team dashboard |
| pages/CrmReports.tsx | ~775 | 30.5KB | 7 report tabs |
| pages/CrmGuide.tsx | ~438 | 29KB | Step-by-step user guide |
| src/services/crm.service.ts | ~510 | 21KB | API service layer |
| src/hooks/useCrmAi.ts | ~183 | 7.5KB | AI hooks (8 hooks) |
| src/components/CrmNav.tsx | ~66 | 2.5KB | CRM sub-navigation |
| src/components/crm/AiInsightCard.tsx | ~52 | 1.5KB | Reusable AI insight wrapper |
| src/components/CollapsibleKanbanColumn.tsx | ~84 | 3.5KB | Kanban collapse utility |
| src/components/ui/StateBadge.tsx | ~188 | 6.9KB | Universal status badge |

### AI Hooks (useCrmAi.ts)

| Hook | API Method | Purpose |
|------|-----------|---------|
| `useAnalyzeNote` | `crmService.analyzeActivityNote` | Sentiment + next action + suggested stage + key facts |
| `useDraftMessage` | `crmService.draftLeadMessage` | Draft WhatsApp/email message with tone selection |
| `useLeadSummary` | `crmService.getLeadSummary` | Auto-summarize lead context |
| `useLeadScore` | `crmService.getLeadScore` | AI lead scoring (0-100) |
| `useWinProbability` | `crmService.getWinProbability` | Deal win probability % |
| `useDailyBriefing` | `crmService.getDailyBriefing` | Daily AI briefing for sales rep |
| `useKycGaps` | `crmService.getKycGaps` | KYC compliance gap detection |
| `useRiskProfile` | `crmService.getRiskProfile` | AI risk classification for contacts |

### Navigation Architecture

**Left Rail (navConfig.ts):** CRM appears under "Tools" group, icon `group`, permission `crm:read`

**CrmNav.tsx (sub-tabs):**
1. `/crm` — Dashboard
2. `/crm/leads` — Leads
3. `/crm/opportunities` — Opportunities
4. `/crm/pipeline` — Pipeline (Kanban)
5. `/crm/accounts` — Accounts
6. `/crm/contacts` — Contacts
7. `/credit` — Credit (cross-module, requires `credit:read`)
8. `/crm/team` — Team (requires `crm:admin`)
9. `/crm/reports` — Reports
10. `/crm/guide` — Guide

### State Management

- **No global state store** (no Redux/Zustand/Context for CRM data)
- **Local useState + useEffect** in every component
- **crm.service.ts** as a singleton service object with async methods
- **useCrmAi.ts** hooks for AI features (8 custom hooks)
- **Auth context** (`useAuth`) for permission checks and user data
- **localStorage** for Kanban column collapse state
- **sessionStorage** for AI daily briefing cache

---

## APPENDIX C — Known Bugs

1. ~~**Notes tab on ContactDetail**~~ ✅ **FIXED** (Phase 1 S1) — GET `/crm/notes` endpoint added; `listNotes` wired; both detail pages now fetch existing notes on mount.
2. ~~**Notes tab on AccountDetail**~~ ✅ **FIXED** (Phase 1 S1) — Same fix applied.
3. ~~**AI error handling**~~ ✅ **FIXED** (Phase 1 S1) — All 9 silent catch blocks replaced with inline error display on AI panels.
4. ~~**Kanban lost reason uses `window.prompt()`**~~ ✅ **FIXED** (Phase 1 S2) — Replaced with `ConfirmDialog` modal (textarea for reason).
5. ~~**Activity list unused result on CrmContactDetail**~~ ✅ **FIXED** as part of Notes tab remediation (Phase 1 S1).
6. **CrmOpportunities form state** — Still casts `form` to `any` for field access, bypassing TypeScript safety. *(open)*
7. **Reports date picker** — Still uses manual from/to state without a proper date picker component. *(open)*
8. **No pagination on detail pages** — Activity and notes lists still load all items without server-side pagination. *(open)*

---

*End of audit document.*