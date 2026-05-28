# ENTERPRISE CRM MODULE AUDIT

**Platform:** Citadel Workplace Connect (CWC)  
**Module:** CRM  
**Date:** 28 May 2026  
**Auditor:** AI Enterprise Consultant  
**Version:** Based on live application + codebase analysis (13 CRM Prisma models, 35+ credit models, 21 frontend files ~8,500 lines)

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

- **Zero edit/delete UI** for any CRM entity — backend supports it, frontend doesn't expose it
- **Silent AI failures** — all AI features catch errors with empty catch blocks; zero user feedback on failure
- **Broken Notes tab** on ContactDetail and AccountDetail — never fetches existing notes, only shows newly created ones
- **No bulk operations** — no multi-select, no bulk update, no bulk assign, no bulk delete
- **Weak form validation** — HTML `required` only; no email format, phone format, or business rule validation
- **Missing UI for 3 data models** — Trust Products, Beneficiaries, Document Checklist have backend APIs but no frontend pages/tabs
- **No mobile-first design** — responsive via Tailwind breakpoints but no mobile-specific layout patterns
- **No real-time updates** — requires manual page refresh; no WebSocket or polling for CRM data

### Enterprise Maturity Level

**3.5 / 5** — Functional but with operational gaps

### Key Risk Areas

1. **Data quality risk** — no edit UI means stale data accumulates; no dedup/merge tools
2. **User adoption risk** — sales rep friction from missing edit flows creates shadow CRM usage
3. **AI trust risk** — silent failures erode confidence in AI features; users stop using them
4. **Compliance risk** — KYC tab exists but Notes don't persist display; broken audit trail for manual changes
5. **Scalability risk** — no pagination on detail page activity lists; no indexing strategy for large datasets

### Scores

| Metric | Score |
|--------|-------|
| Overall UI | 6.5/10 |
| Overall UX | 5.5/10 |
| Enterprise Readiness | 4.5/10 |
| Sales Productivity | 5/10 |

### Immediate Improvement Priorities

1. Fix Notes tab data fetching (broken — shows nothing)
2. Add Edit modals for Leads, Contacts, Accounts, Opportunities
3. Add user-facing error handling for AI features (toast notifications)
4. Add Trust Products and Beneficiaries UI tabs (API layer already exists)
5. Add Delete with confirmation dialogs
6. Add form validation with error messages

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
| No empty state illustrations | Medium | All list views | When tables are empty, users see blank whitespace — feels broken | Add illustration + CTA text ("No opportunities yet. Create your first deal.") | User confidence |
| Reports have no charts | High | Reports page | 7 report types are all tables. No bar charts, pie charts, or sparklines. | Add Recharts visualizations for by-source, by-status, trend lines | Decision-making speed |
| Kanban cards lack thumbnail/owner avatar | Medium | Pipeline | Cards show text only; no company logo placeholder or owner avatar for quick visual scan | Add avatar circle with initials, company logo placeholder | Scan speed |
| Lost reason uses native browser `prompt()` | High | Pipeline | Drag-to-lost triggers `window.prompt()` — jarring, unstyled, breaks UX flow | Replace with a proper modal dialog | Professionalism |
| No loading skeleton on initial page loads | Medium | Multiple pages | Some pages show nothing during API fetch (blank white) before jumping to content | Add SkeletonLine components as used in CrmDashboard | Perceived performance |

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
| Edit a lead | **Impossible** — no edit button exists | High — must contact admin or re-create | Critical |
| Delete a lead | **Impossible** — no UI | High | Critical |
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
| Assign/reassign leads | **Missing** — no owner change UI | **Critical** |
| Approve/reject deals | **Missing** — no approval workflow in CRM | **High** |
| Compare rep activity levels | Partial — Activity Summary report shows by-agent table but no comparison visualization | Medium |
| AI manager briefing | Available but generates on-demand (not auto-refreshed) | Low |
| Drill-down from aggregate to detail | Missing — cannot click a KPI number to see the underlying list | **High** |

### Credit Team Perspective

| Capability | Status | Severity |
|------------|--------|----------|
| View KYC status on a contact | Available (ContactDetail → KYC tab) | Covered |
| AI KYC gap detection | Available (auto-loads on KYC tab) | Covered |
| AI risk classification | Available (auto-loads on KYC tab) | Covered |
| Bridge from CRM to Credit module | Available (AccountDetail → Credit tab) | Covered |
| Initiate credit application from CRM | **Missing** — only a link to `/credit/borrowers?accountId=X` | Medium |
| View trust product details | **Missing** — no UI for trust products despite API | **Critical** |
| View/manage beneficiaries | **Missing** — no UI for beneficiaries despite API | **Critical** |

### UX Severity Matrix

| Severity | Issues |
|----------|--------|
| Critical | No edit flows for any entity; No delete flows; Notes tab broken (never fetches existing notes); No lead reassignment; No trust product/beneficiary UI |
| High | No bulk operations; Silent AI error handling; No drill-down from KPIs; Reports are tables-only (no charts); Native `prompt()` for lost reason |
| Medium | Weak form validation; No empty state illustrations; No loading skeleton on some pages; CrmNav overflows on mobile |
| Low | No optimistic updates; AI features not cached (except daily briefing); Pagination missing on detail activity lists |

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
| Lead assignment | **Partial** — ownerId set at creation, but no reassignment UI | Needs work |
| Lead routing | **Missing** — No round-robin, territory, or rules-based routing | Missing |
| Lead aging | **Exists** — "Overdue" / "Stale" / "Due Today" badges | Good |
| Lead source tracking | **Exists** — 8 sources (WEBSITE, REFERRAL, etc.) + filter | Good |
| Lead prioritization | **Exists** — AI Score with color coding | Good |
| Lead scoring | **Exists** — AI Lead Score (0-100) with reason text | Good |
| Duplicate prevention | **Partial** — Warns on email/phone match but no merge UI | Needs work |
| Lead conversion | **Exists** — QUALIFIED → Convert to Opportunity | Good |
| Lead edit | **Missing** — No edit modal | Critical gap |
| Lead delete | **Missing** — No UI (backend supports) | Critical gap |
| Lead bulk actions | **Missing** | Missing |

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
| Opportunity edit | **Missing** | Critical gap |
| Opportunity delete | **Missing** | Critical gap |
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
| Account edit | **Missing** | Critical gap |
| Contact edit | **Missing** | Critical gap |
| Contact delete | **Missing** | Critical gap |
| Trust Products tab | **Missing** — Model exists, UI doesn't | Critical gap |
| Beneficiaries tab | **Missing** — Model exists, UI doesn't | Critical gap |

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
| Lead Conversion | Table only (by source, by status) | Poor — needs bar/pie chart |
| Sales Performance | Table only (by agent) | Poor — needs bar chart, sparkline |
| Pipeline Forecast | Table only (by stage) | Poor — needs funnel chart |
| Activity Summary | Table + bar chart (by type) | Acceptable |
| Lead Aging | Table with >30d/>60d/>90d columns | Acceptable |
| Win/Loss | Table + win rate percentage | Poor — needs comparison chart |
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

### PHASE 1 — QUICK WINS (1-2 weeks each)

| # | Improvement | Priority | Business Impact | UX Impact | Complexity | Effort | Risk |
|---|-------------|----------|----------------|----------|------------|--------|------|
| 1 | Fix Notes tab (fetch existing notes) | P0 | High — broken feature | High | Very Low | 0.5 day | None |
| 2 | Add toast notifications for AI failures | P0 | Medium — trust | High | Low | 1 day | None |
| 3 | Add Edit modals (Lead, Contact, Account, Opportunity) | P0 | Very High — daily use | Very High | Medium | 3-5 days | Low |
| 4 | Add Delete with confirmation dialogs | P0 | High — data management | Medium | Low | 2 days | Medium |
| 5 | Add Trust Products tab to AccountDetail | P1 | High — domain-specific | High | Medium | 3 days | Low |
| 6 | Add Beneficiaries tab to ContactDetail | P1 | High — domain-specific | High | Medium | 3 days | Low |
| 7 | Add empty state components | P1 | Medium — professionalism | Medium | Low | 1 day | None |
| 8 | Add loading skeletons on all pages | P1 | Medium — perceived performance | Medium | Low | 1 day | None |
| 9 | Replace native `prompt()` with modal | P1 | Medium — professionalism | Medium | Low | 0.5 day | None |
| 10 | Add KPI click-through (dashboard → list) | P1 | High — actionability | High | Low | 1 day | None |

### PHASE 2 — MID-LEVEL IMPROVEMENTS (2-4 weeks each)

| # | Improvement | Priority | Business Impact | UX Impact | Complexity | Effort | Risk |
|---|-------------|----------|----------------|----------|------------|--------|------|
| 11 | Inline editing on detail pages | P1 | Very High | Very High | Medium | 5 days | Medium |
| 12 | Chart visualizations in Reports | P1 | High — decision-making | High | Medium | 5 days | Low |
| 13 | Lead reassignment UI | P1 | High — manager productivity | High | Medium | 3 days | Low |
| 14 | Activity reminder/notification system | P1 | Very High — follow-up completion | Very High | High | 7 days | Medium |
| 15 | Bulk operations (select, update, assign) | P1 | High — efficiency for managers | High | High | 7 days | Medium |
| 16 | Drill-down from Team Dashboard | P2 | Medium — manager visibility | Medium | Medium | 3 days | Low |
| 17 | Form validation with error messages | P1 | High — data quality | High | Medium | 3 days | Low |
| 18 | Mobile-optimized CrmNav (hamburger) | P2 | Medium — mobile usability | Medium | Medium | 3 days | Low |
| 19 | Document Checklist UI | P2 | Medium — compliance | Medium | Medium | 5 days | Low |
| 20 | Configurable list view (columns, sort, page size) | P2 | Medium — personalization | Medium | Medium | 5 days | Low |

### PHASE 3 — ENTERPRISE ENHANCEMENTS (4-8 weeks each)

| # | Improvement | Priority | Business Impact | UX Impact | Complexity | Effort | Risk |
|---|-------------|----------|----------------|----------|------------|--------|------|
| 21 | Workflow automation engine (triggers, actions) | P1 | Very High — operational efficiency | High | Very High | 4-6 weeks | High |
| 22 | Email/calendar integration (Gmail, Outlook) | P1 | Very High — activity tracking | Very High | Very High | 4-6 weeks | High |
| 23 | Import/Export tool (CSV, Excel) | P2 | Medium — data migration | Medium | Medium | 2 weeks | Low |
| 24 | Configurable dashboard widgets | P2 | High — personalization | High | High | 3-4 weeks | Medium |
| 25 | Custom fields/objects | P2 | High — extensibility | Medium | Very High | 6-8 weeks | High |
| 26 | AI Next Best Action | P2 | Very High — rep productivity | Very High | High | 3-4 weeks | Medium |
| 27 | AI Pipeline Anomaly Detection | P2 | High — deal health | High | High | 3-4 weeks | Medium |
| 28 | Audit trail for CRM entity changes | P1 | High — compliance | Low | Medium | 2 weeks | Low |
| 29 | Territory/quotas model + UI | P2 | High — enterprise sales ops | Medium | High | 3-4 weeks | Medium |
| 30 | Mobile-first redesign (bottom nav, swipe, FAB) | P2 | High — field sales | Very High | Very High | 6-8 weeks | Medium |

---

## SECTION 12 — FINAL SCORECARD

| Dimension | Score | Key Driver |
|-----------|-------|------------|
| UI Design | 6.5/10 | Clean but generic. Lacks micro-interactions, hover states, charts, empty states. Professional but not differentiated. |
| UX | 5.5/10 | Good creation flows, but broken edit/delete, silent AI errors, no bulk ops, and broken Notes tab significantly hurt usability. |
| Mobile Experience | 4/10 | Basic Tailwind responsiveness. No mobile-specific patterns. CrmNav overflows. Kanban drag not touch-optimized. |
| Sales Productivity | 5/10 | AI features are strong but cannot edit records in-place. Daily briefing is good but dashboard is not actionable. No reminders. |
| Dashboard Effectiveness | 5.5/10 | Good KPI visibility, AI briefing is strong. But read-only, no drill-down, no charts, duplicated metrics, no action buttons. |
| Enterprise Readiness | 4.5/10 | Strong data model and domain specificity. Weak on: audit trails, sharing rules, import/export, workflow automation, bulk operations. |
| AI Readiness | 8/10 | 10+ contextual AI features. Strong breadth. But silent failures erode trust. Needs explainability and next-best-action. |
| Workflow Efficiency | 5/10 | Creation is smooth. Everything else (edit, delete, bulk, assign, approve) requires workarounds or is missing. |
| Feature Completeness | 6/10 | CRUD creation for all core entities. AI features are rich. But edit/delete/bulk for all entities is missing. 3 models have no UI. |
| Scalability | 5.5/10 | Good Prisma model with indexes. But no team/territory model, no sharing rules, no composite indexes for common queries. |

### Final Overall Score: 5.5/10

### Enterprise Maturity Assessment

**Early Growth Stage**

- Data model is robust and domain-specialized (strength)
- Feature breadth is good but feature depth is shallow (cannot edit what you create)
- AI integration is ahead of most CRM competitors at this stage (significant strength)
- Operational workflows (edit, delete, bulk, assign, approve) are incomplete (critical gap)
- Enterprise capabilities (audit, import/export, integration, custom fields) are absent (blocking gap)

### Top 10 Critical Improvements

1. **Add Edit modals for all CRM entities** — The single biggest UX gap. Users cannot update any record after creation.
2. **Fix Notes tab fetching** — Broken feature (shows empty instead of existing notes).
3. **Add delete with confirmation dialogs** — Basic data management capability.
4. **Add toast notifications for AI failures** — Users see no feedback when AI features fail.
5. **Add Trust Products and Beneficiaries UI** — Backend exists, frontend missing. Domain-critical.
6. **Add chart visualizations in Reports** — Tables alone don't drive decisions.
7. **Add inline editing on detail pages** — Reduce clicks for everyday updates.
8. **Add activity reminder/notification system** — Follow-ups fall through cracks without it.
9. **Add lead reassignment from Team Dashboard** — Managers cannot distribute work.
10. **Add KPI click-through and action buttons on Dashboard** — Dashboard is passive; needs to be active.

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

1. **Notes tab on ContactDetail** — Never fetches existing notes. Comment in code: "Since there's no listNotes endpoint, initialize empty". But `crmService.listActivities({ contactId })` exists and is called but result unused.
2. **Notes tab on AccountDetail** — Same pattern: creates notes but never fetches existing.
3. **AI error handling** — All AI features use `catch {/* fail silently */}`. No toast or inline error shown to user.
4. **Kanban lost reason** — Uses native browser `prompt()` instead of a proper modal.
5. **Activity list on CrmContactDetail** — Calls `crmService.listActivities({ contactId, activityType: 'NOTE' })` but doesn't use the result (lines 210-211).
6. **CrmOpportunities form state** — Casts `form` to `any` for field access, bypassing TypeScript safety.
7. **Reports date picker** — Uses manual from/to state without a proper date picker component.
8. **No pagination on detail pages** — Activity and notes lists load all items without server-side pagination.

---

*End of audit document.*